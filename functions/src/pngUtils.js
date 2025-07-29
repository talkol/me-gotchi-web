import sharp from 'sharp';

/**
 * Centers icons within their tiles in a 3x3 grid layout
 * @param {Buffer|string} inputImagePath - Input PNG image buffer or file path (1024x1024)
 * @param {string} alignmentMode - 'center' or 'center-bottom'
 * @returns {Promise<Buffer>} - Processed PNG image buffer
 */
export async function centerIconsInTiles(inputImagePath, alignmentMode = 'center') {
  if (!['center', 'center-bottom'].includes(alignmentMode)) {
    throw new Error('Alignment mode must be "center" or "center-bottom"');
  }

  // Load the input image
  const image = sharp(inputImagePath);
  const metadata = await image.metadata();
  
  if (metadata.width !== 1024 || metadata.height !== 1024) {
    throw new Error('Input image must be 1024x1024 pixels');
  }

  // Get raw image data with alpha channel
  const imageData = await image.raw().toBuffer({ resolveWithObject: true });
  const { data, info } = imageData;
  const { width, height, channels } = info;

  if (channels < 4) {
    throw new Error('Input image must have an alpha channel');
  }

  // Each tile is approximately 341.33x341.33 pixels (1024/3)
  const tileSizeFloat = 1024 / 3;

  // Create output buffer
  const outputBuffer = Buffer.alloc(data.length);
  outputBuffer.fill(0); // Initialize with transparent pixels

  // Process each of the 9 tiles
  for (let tileY = 0; tileY < 3; tileY++) {
    for (let tileX = 0; tileX < 3; tileX++) {
      await processTileWithExpandedSearch(
        data, 
        outputBuffer, 
        width, 
        height, 
        channels,
        tileX, 
        tileY, 
        tileSizeFloat,
        alignmentMode
      );
    }
  }

  // Create output image from processed buffer
  return await sharp(outputBuffer, {
    raw: {
      width: width,
      height: height,
      channels: channels
    }
  })
  .png()
  .toBuffer();
}

/**
 * Processes a single tile using the proper algorithm: find parts, assign ownership, center as group
 */
async function processTileWithExpandedSearch(inputData, outputData, width, height, channels, tileX, tileY, tileSize, alignmentMode) {
  // Calculate tile boundaries for the entire 3x3 grid
  const tiles = [];
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      const startX = Math.floor(tx * tileSize);
      const endX = Math.floor((tx + 1) * tileSize);
      const startY = Math.floor(ty * tileSize);
      const endY = Math.floor((ty + 1) * tileSize);
      tiles.push({
        x: tx,
        y: ty,
        startX,
        endX,
        startY,
        endY,
        width: endX - startX,
        height: endY - startY
      });
    }
  }

  const currentTile = tiles.find(t => t.x === tileX && t.y === tileY);

  // Step 1: Find ALL parts (connected components) in the entire image
  const allParts = [];
  const visited = new Set();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * channels;
      const alpha = inputData[pixelIndex + 3];
      const key = `${x},${y}`;
      
      if (alpha > 10 && !visited.has(key)) {
        const part = exploreConnectedPixels(inputData, width, height, channels, x, y, visited, 0, width, 0, height);
        if (part.pixels.length > 3) { // Filter out tiny noise
          allParts.push(part);
        }
      }
    }
  }

  // Step 2: For each part, determine which tile it belongs to
  const approvedParts = [];

  for (const part of allParts) {
    // Count pixels of this part in each tile
    const pixelCounts = new Map();
    
    for (const pixel of part.pixels) {
      for (const tile of tiles) {
        if (pixel.x >= tile.startX && pixel.x < tile.endX && 
            pixel.y >= tile.startY && pixel.y < tile.endY) {
          const tileKey = `${tile.x},${tile.y}`;
          pixelCounts.set(tileKey, (pixelCounts.get(tileKey) || 0) + 1);
        }
      }
    }

    // Filter out background elements: ignore parts that span more than 5 tiles
    const tilesSpanned = pixelCounts.size;
    if (tilesSpanned > 5) {
      continue; // Skip this part - it's likely a background element
    }

    // Find which tile has the most pixels of this part
    let maxCount = 0;
    let ownerTile = null;
    
    for (const [tileKey, count] of pixelCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        ownerTile = tileKey;
      }
    }

    // If this part belongs to our current tile, approve it
    const currentTileKey = `${tileX},${tileY}`;
    if (ownerTile === currentTileKey && maxCount > 0) {
      approvedParts.push(part);
    }
  }

  if (approvedParts.length === 0) {
    return; // No approved parts for this tile
  }

  // Step 3: Calculate the combined bounding box of all approved parts
  let combinedBounds = null;
  
  for (const part of approvedParts) {
    if (combinedBounds === null) {
      combinedBounds = { ...part.bounds };
    } else {
      combinedBounds.minX = Math.min(combinedBounds.minX, part.bounds.minX);
      combinedBounds.maxX = Math.max(combinedBounds.maxX, part.bounds.maxX);
      combinedBounds.minY = Math.min(combinedBounds.minY, part.bounds.minY);
      combinedBounds.maxY = Math.max(combinedBounds.maxY, part.bounds.maxY);
    }
  }

  // Step 4: Calculate target position for the entire group
  const groupWidth = combinedBounds.maxX - combinedBounds.minX + 1;
  const groupHeight = combinedBounds.maxY - combinedBounds.minY + 1;

  let targetX, targetY;
  
  if (alignmentMode === 'center') {
    targetX = currentTile.startX + Math.floor((currentTile.width - groupWidth) / 2);
    targetY = currentTile.startY + Math.floor((currentTile.height - groupHeight) / 2);
  } else { // center-bottom
    targetX = currentTile.startX + Math.floor((currentTile.width - groupWidth) / 2);
    // For center-bottom: ensure the bottom pixel of the group aligns with the bottom pixel of the tile
    // But handle cases where the group is taller than the tile
    const idealTargetY = currentTile.startY + currentTile.height - groupHeight;
    
    // If the group is taller than the tile, allow it to extend above the tile boundary
    // but still align the bottom to the tile bottom
    if (groupHeight > currentTile.height) {
      // Group is taller than tile - allow upward overflow
      targetY = currentTile.startY + currentTile.height - groupHeight;
    } else {
      // Normal case - group fits within tile
      targetY = idealTargetY;
    }
  }

  // Step 5: Copy all approved parts to their new positions, preserving relative positions
  for (const part of approvedParts) {
    for (const pixel of part.pixels) {
      const sourcePixelIndex = (pixel.y * width + pixel.x) * channels;
      
      // Calculate new position while preserving relative position within the group
      const newX = targetX + (pixel.x - combinedBounds.minX);
      const newY = targetY + (pixel.y - combinedBounds.minY);
      
      // Make sure we stay within image boundaries
      if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
        const targetPixelIndex = (newY * width + newX) * channels;
        
        // Copy RGBA values
        outputData[targetPixelIndex] = inputData[sourcePixelIndex];         // R
        outputData[targetPixelIndex + 1] = inputData[sourcePixelIndex + 1]; // G
        outputData[targetPixelIndex + 2] = inputData[sourcePixelIndex + 2]; // B
        outputData[targetPixelIndex + 3] = inputData[sourcePixelIndex + 3]; // A
      }
    }
  }
}

/**
 * Explores connected pixels using flood-fill algorithm
 */
function exploreConnectedPixels(inputData, width, height, channels, startX, startY, visited, searchStartX, searchEndX, searchStartY, searchEndY) {
  const pixels = [];
  const bounds = { minX: startX, maxX: startX, minY: startY, maxY: startY };
  const stack = [{ x: startX, y: startY }];
  
  while (stack.length > 0) {
    const { x, y } = stack.pop();
    const key = `${x},${y}`;
    
    if (visited.has(key) || x < searchStartX || x >= searchEndX || y < searchStartY || y >= searchEndY) {
      continue;
    }
    
    const pixelIndex = (y * width + x) * channels;
    const alpha = inputData[pixelIndex + 3];
    
    if (alpha <= 10) { // Changed from === 0 to <= 10 to exclude barely visible pixels
      continue; // Skip transparent or nearly transparent pixels
    }
    
    visited.add(key);
    pixels.push({ x, y });
    
    // Update bounds
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    
    // Add neighboring pixels to stack
    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }
  
  return { pixels, bounds };
}

/**
 * Analyzes an image to detect icon boundaries more intelligently
 * This could be enhanced with more sophisticated edge detection if needed
 */
export async function analyzeImageStructure(inputImagePath) {
  const image = sharp(inputImagePath);
  const metadata = await image.metadata();
  
  return {
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: metadata.channels >= 4,
    tileSize: metadata.width / 3
  };
}