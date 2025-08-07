import sharp from 'sharp';

/**
 * Centers icons within their tiles in a 3x3 grid layout
 * @param {Buffer|string} inputImagePath - Input PNG image buffer or file path (1024x1024)
 * @param {string} alignmentMode - 'icons' or 'faces'
 * @returns {Promise<Buffer>} - Processed PNG image buffer
 */
export async function centerIconsInTiles(inputImagePath, alignmentMode = 'icons') {
  if (!['icons', 'faces'].includes(alignmentMode)) {
    throw new Error('Alignment mode must be "icons" or "faces"');
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

  // Apply row-by-row bridge removal for faces mode (ONCE for entire image)
  if (alignmentMode === 'faces') {
    removeBridgesBetweenPartsInRows(data, width, height, channels);
    removeBridgesBetweenPartsInCols(data, width, height, channels);
    
    // Bridge separation complete
  }

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

  // Bridge removal is now done at the image level, not per tile

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

    // Filter out background elements with different rules based on content type
    const tilesSpanned = pixelCounts.size;
    
    if (alignmentMode === 'icons') {
      // For food icons: stricter filtering - food items should be self-contained
      if (tilesSpanned >= 3) {
        continue; // Skip parts that span 3+ tiles for food icons
      }
    } else {
      // For face expressions:
      // Skip parts that span more than 5 tiles or are very large (width > 500 or height > 500)
      const partWidth = part.bounds.maxX - part.bounds.minX + 1;
      const partHeight = part.bounds.maxY - part.bounds.minY + 1;
      if (tilesSpanned >= 5 || partWidth > 400 || partHeight > 400 || partWidth < 200 || partHeight < 200) {
        continue; // Skip parts that are not relevant
      }
      
      // Additional filtering: Skip parts whose edges are too far from tile boundaries
      if (isPartTooFarFromTileBoundaries(part, width, height)) {
        continue; // Skip parts that have any edge too far from tile boundaries
      }
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
  
  if (alignmentMode === 'icons') {
    targetX = currentTile.startX + Math.floor((currentTile.width - groupWidth) / 2);
    targetY = currentTile.startY + Math.floor((currentTile.height - groupHeight) / 2);
  } else { // faces
    targetX = currentTile.startX + Math.floor((currentTile.width - groupWidth) / 2);
    // For faces: ensure the bottom pixel of the group aligns with the bottom pixel of the tile
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
 * Marks bridges between parts in each row for center-bottom mode (in red for debugging)
 * Processes each row independently to ensure we get 3 separate parts per row
 */
function removeBridgesBetweenPartsInRows(inputData, width, height, channels) {
  const rowHeight = Math.floor(height / 3); // Each row is approximately 341 pixels
  
  // Process all 3 rows
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    const rowStartY = rowIndex * rowHeight;
    const rowEndY = rowIndex === 2 ? height : (rowIndex + 1) * rowHeight; // Handle the last row
    
    processRowForBridges(inputData, width, height, channels, rowStartY, rowEndY);
  }
}

/**
 * Marks bridges between parts in each column for center-bottom mode
 * Processes each column independently to ensure we get 3 separate parts per column
 */
function removeBridgesBetweenPartsInCols(inputData, width, height, channels) {
  const colWidth = Math.floor(width / 3); // Each column is approximately 341 pixels
  
  // Process all 3 columns
  for (let colIndex = 0; colIndex < 3; colIndex++) {
    const colStartX = colIndex * colWidth;
    const colEndX = colIndex === 2 ? width : (colIndex + 1) * colWidth; // Handle the last column
    
    processColForBridges(inputData, width, height, channels, colStartX, colEndX);
  }
}

/**
 * Processes a single row to find and remove bridges between connected parts
 */
function processRowForBridges(inputData, width, height, channels, rowStartY, rowEndY) {
  // Step 1: Find connected components within this row
  const rowParts = findConnectedPartsInRow(inputData, width, height, channels, rowStartY, rowEndY);
  
  // Step 2: Remove bridges from all parts
  for (const part of rowParts) {
    removeBridgesFromPartHorizontally(part, inputData, width, height, channels);
  }
}

/**
 * Processes a single column to find and remove bridges between connected parts
 */
function processColForBridges(inputData, width, height, channels, colStartX, colEndX) {
  // Step 1: Find connected components within this column
  const colParts = findConnectedPartsInCol(inputData, width, height, channels, colStartX, colEndX);
  
  // Step 2: Remove bridges from all parts
  for (const part of colParts) {
    removeBridgesFromPartVertically(part, inputData, width, height, channels);
  }
}

/**
 * Finds connected components within a specific row (but allows full face detection across boundaries)
 */
function findConnectedPartsInRow(inputData, width, height, channels, rowStartY, rowEndY) {
  const parts = [];
  const visited = new Set();
  
  // Only start flood-fill from pixels within the row, but allow the flood-fill to explore the entire image
  for (let y = rowStartY; y < rowEndY; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * channels;
      const alpha = inputData[pixelIndex + 3];
      const key = `${x},${y}`;
      
      if (alpha > 10 && !visited.has(key)) {
        const part = exploreConnectedPixels(inputData, width, height, channels, x, y, visited, 0, width, 0, height);
        if (part.pixels.length > 10) { // Filter out tiny noise
          const partHeight = part.bounds.maxY - part.bounds.minY + 1;
          // Only count substantial parts (not thin horizontal strips)
          if (partHeight > 50) {
            // Only include parts that have significant presence in this row
            const pixelsInRow = part.pixels.filter(p => p.y >= rowStartY && p.y < rowEndY).length;
            const percentageInRow = pixelsInRow / part.pixels.length;
            
            // If at least 30% of the part is in this row, consider it belongs to this row
            if (percentageInRow >= 0.3) {
              parts.push(part);
            }
          }
        }
      }
    }
  }
  
  return parts;
}

/**
 * Finds connected components within a specific column (but allows full face detection across boundaries)
 */
function findConnectedPartsInCol(inputData, width, height, channels, colStartX, colEndX) {
  const parts = [];
  const visited = new Set();
  
  // Only start flood-fill from pixels within the column, but allow the flood-fill to explore the entire image
  for (let x = colStartX; x < colEndX; x++) {
    for (let y = 0; y < height; y++) {
      const pixelIndex = (y * width + x) * channels;
      const alpha = inputData[pixelIndex + 3];
      const key = `${x},${y}`;
      
      if (alpha > 10 && !visited.has(key)) {
        const part = exploreConnectedPixels(inputData, width, height, channels, x, y, visited, 0, width, 0, height);
        if (part.pixels.length > 10) { // Filter out tiny noise
          const partWidth = part.bounds.maxX - part.bounds.minX + 1;
          // Only count substantial parts (not thin vertical strips)
          if (partWidth > 50) {
            // Only include parts that have significant presence in this column
            const pixelsInCol = part.pixels.filter(p => p.x >= colStartX && p.x < colEndX).length;
            const percentageInCol = pixelsInCol / part.pixels.length;
            
            // If at least 30% of the part is in this column, consider it belongs to this column
            if (percentageInCol >= 0.3) {
              parts.push(part);
            }
          }
        }
      }
    }
  }
  
  return parts;
}

/**
 * Removes bridges from a large part by finding narrow connection points
 */
function removeBridgesFromPartHorizontally(part, inputData, width, height, channels) {
  const partWidth = part.bounds.maxX - part.bounds.minX + 1;
  
  // Calculate how many bridges we need based on part width
  const expectedSinglePartWidth = width / 3; // ~341 pixels for 1024px image
  let neededSplits;
  
  if (partWidth < expectedSinglePartWidth * 1.5) {
    neededSplits = 0; // Part is small enough, no splits needed
  } else if (partWidth < expectedSinglePartWidth * 2.5) {
    neededSplits = 1; // Part spans ~2 tiles, split into 2 parts
  } else {
    neededSplits = 2; // Part spans ~3 tiles, split into 3 parts
  }
  
  // If no splits needed, return early
  if (neededSplits === 0) {
    return;
  }
  
  if (neededSplits === 1) {
    // Split into 2 parts - find 1 bridge in the middle
    const expectedBridgeX = part.bounds.minX + Math.floor(partWidth / 2);
    const bridge = findNarrowestBridge(part, inputData, width, height, channels, expectedBridgeX - 20, expectedBridgeX + 20);
    
    if (bridge) {
      removeBridgePixels(bridge, inputData, width, channels);
    }
  } else if (neededSplits === 2) {
    // Split into 3 parts - find 2 bridges at 1/3 and 2/3 positions
    const expectedBridgeX1 = part.bounds.minX + Math.floor(partWidth / 3);
    const expectedBridgeX2 = part.bounds.minX + Math.floor(2 * partWidth / 3);
    
    const bridge1 = findNarrowestBridge(part, inputData, width, height, channels, expectedBridgeX1 - 20, expectedBridgeX1 + 20);
    const bridge2 = findNarrowestBridge(part, inputData, width, height, channels, expectedBridgeX2 - 20, expectedBridgeX2 + 20);
    
    if (bridge1) {
      removeBridgePixels(bridge1, inputData, width, channels);
    }
    
    if (bridge2) {
      removeBridgePixels(bridge2, inputData, width, channels);
    }
  }
}

/**
 * Removes bridges from a large part by finding narrow horizontal connection points
 */
function removeBridgesFromPartVertically(part, inputData, width, height, channels) {
  const partHeight = part.bounds.maxY - part.bounds.minY + 1;
  
  // Calculate how many bridges we need based on part height
  const expectedSinglePartHeight = height / 3; // ~341 pixels for 1024px image
  let neededSplits;
  
  if (partHeight < expectedSinglePartHeight * 1.5) {
    neededSplits = 0; // Part is small enough, no splits needed
  } else if (partHeight < expectedSinglePartHeight * 2.5) {
    neededSplits = 1; // Part spans ~2 tiles, split into 2 parts
  } else {
    neededSplits = 2; // Part spans ~3 tiles, split into 3 parts
  }
  
  // If no splits needed, return early
  if (neededSplits === 0) {
    return;
  }
  
  if (neededSplits === 1) {
    // Split into 2 parts - find 1 bridge in the middle
    const expectedBridgeY = part.bounds.minY + Math.floor(partHeight / 2);
    const bridge = findNarrowestHorizontalBridge(part, inputData, width, height, channels, expectedBridgeY - 20, expectedBridgeY + 20);
    
    if (bridge) {
      removeHorizontalBridgePixels(bridge, inputData, width, channels);
    }
  } else if (neededSplits === 2) {
    // Split into 3 parts - find 2 bridges at 1/3 and 2/3 positions
    const expectedBridgeY1 = part.bounds.minY + Math.floor(partHeight / 3);
    const expectedBridgeY2 = part.bounds.minY + Math.floor(2 * partHeight / 3);
    
    const bridge1 = findNarrowestHorizontalBridge(part, inputData, width, height, channels, expectedBridgeY1 - 20, expectedBridgeY1 + 20);
    const bridge2 = findNarrowestHorizontalBridge(part, inputData, width, height, channels, expectedBridgeY2 - 20, expectedBridgeY2 + 20);
    
    if (bridge1) {
      removeHorizontalBridgePixels(bridge1, inputData, width, channels);
    }
    
    if (bridge2) {
      removeHorizontalBridgePixels(bridge2, inputData, width, channels);
    }
  }
}

/**
 * Finds the narrowest bridge (shortest pixel column) in a given X range
 */
function findNarrowestBridge(part, inputData, width, height, channels, searchStartX, searchEndX) {
  let narrowestBridge = null;
  let minHeight = Infinity;
  
  // Search for the narrowest vertical connection
  for (let x = Math.max(searchStartX, part.bounds.minX); x <= Math.min(searchEndX, part.bounds.maxX); x++) {
    const columnHeight = getColumnHeightInPart(part, x);
    
    if (columnHeight > 0 && columnHeight < minHeight) {
      minHeight = columnHeight;
      narrowestBridge = {
        x: x,
        height: columnHeight,
        startY: getColumnStartY(part, x),
        endY: getColumnEndY(part, x)
      };
    }
  }
  
  return narrowestBridge;
}

/**
 * Finds the narrowest horizontal bridge (shortest pixel row) in a given Y range
 */
function findNarrowestHorizontalBridge(part, inputData, width, height, channels, searchStartY, searchEndY) {
  let narrowestBridge = null;
  let minWidth = Infinity;
  
  // Search for the narrowest horizontal connection
  for (let y = Math.max(searchStartY, part.bounds.minY); y <= Math.min(searchEndY, part.bounds.maxY); y++) {
    const rowWidth = getRowWidthInPart(part, y);
    
    if (rowWidth > 0 && rowWidth < minWidth) {
      minWidth = rowWidth;
      narrowestBridge = {
        y: y,
        width: rowWidth,
        startX: getRowStartX(part, y),
        endX: getRowEndX(part, y)
      };
    }
  }
  
  return narrowestBridge;
}

/**
 * Gets the height of pixels in a specific column within a part
 */
function getColumnHeightInPart(part, targetX) {
  const pixelsInColumn = part.pixels.filter(p => p.x === targetX);
  if (pixelsInColumn.length === 0) return 0;
  
  const minY = Math.min(...pixelsInColumn.map(p => p.y));
  const maxY = Math.max(...pixelsInColumn.map(p => p.y));
  
  return maxY - minY + 1;
}

/**
 * Gets the starting Y coordinate of pixels in a column
 */
function getColumnStartY(part, targetX) {
  const pixelsInColumn = part.pixels.filter(p => p.x === targetX);
  return pixelsInColumn.length > 0 ? Math.min(...pixelsInColumn.map(p => p.y)) : 0;
}

/**
 * Gets the ending Y coordinate of pixels in a column
 */
function getColumnEndY(part, targetX) {
  const pixelsInColumn = part.pixels.filter(p => p.x === targetX);
  return pixelsInColumn.length > 0 ? Math.max(...pixelsInColumn.map(p => p.y)) : 0;
}

/**
 * Gets the width of pixels in a specific row within a part
 */
function getRowWidthInPart(part, targetY) {
  const pixelsInRow = part.pixels.filter(p => p.y === targetY);
  if (pixelsInRow.length === 0) return 0;
  
  const minX = Math.min(...pixelsInRow.map(p => p.x));
  const maxX = Math.max(...pixelsInRow.map(p => p.x));
  
  return maxX - minX + 1;
}

/**
 * Gets the starting X coordinate of pixels in a row
 */
function getRowStartX(part, targetY) {
  const pixelsInRow = part.pixels.filter(p => p.y === targetY);
  return pixelsInRow.length > 0 ? Math.min(...pixelsInRow.map(p => p.x)) : 0;
}

/**
 * Gets the ending X coordinate of pixels in a row
 */
function getRowEndX(part, targetY) {
  const pixelsInRow = part.pixels.filter(p => p.y === targetY);
  return pixelsInRow.length > 0 ? Math.max(...pixelsInRow.map(p => p.x)) : 0;
}

/**
 * Actually deletes bridge pixels by making them transparent
 */
function removeBridgePixels(bridge, inputData, width, channels) {
  for (let y = bridge.startY; y <= bridge.endY; y++) {
    const pixelIndex = (y * width + bridge.x) * channels;
    inputData[pixelIndex] = 0;       // R: Black
    inputData[pixelIndex + 1] = 0;   // G: Black
    inputData[pixelIndex + 2] = 0;   // B: Black
    inputData[pixelIndex + 3] = 0;   // A: Transparent (actually removes the pixels)
  }
}

/**
 * Actually deletes horizontal bridge pixels by making them transparent
 */
function removeHorizontalBridgePixels(bridge, inputData, width, channels) {
  for (let x = bridge.startX; x <= bridge.endX; x++) {
    const pixelIndex = (bridge.y * width + x) * channels;
    inputData[pixelIndex] = 0;       // R: Black
    inputData[pixelIndex + 1] = 0;   // G: Black
    inputData[pixelIndex + 2] = 0;   // B: Black
    inputData[pixelIndex + 3] = 0;   // A: Transparent (actually removes the pixels)
  }
}

/**
 * Draws a red box around a bounding rectangle for debugging
 */
function drawRedBox(inputData, width, channels, bounds) {
  // Draw top and bottom horizontal lines
  for (let x = bounds.minX; x <= bounds.maxX; x++) {
    // Top line
    if (bounds.minY >= 0) {
      const topIndex = (bounds.minY * width + x) * channels;
      inputData[topIndex] = 255;     // R
      inputData[topIndex + 1] = 0;   // G
      inputData[topIndex + 2] = 0;   // B
      inputData[topIndex + 3] = 255; // A
    }
    
    // Bottom line
    if (bounds.maxY < 1024) {
      const bottomIndex = (bounds.maxY * width + x) * channels;
      inputData[bottomIndex] = 255;     // R
      inputData[bottomIndex + 1] = 0;   // G
      inputData[bottomIndex + 2] = 0;   // B
      inputData[bottomIndex + 3] = 255; // A
    }
  }
  
  // Draw left and right vertical lines
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    // Left line
    if (bounds.minX >= 0) {
      const leftIndex = (y * width + bounds.minX) * channels;
      inputData[leftIndex] = 255;     // R
      inputData[leftIndex + 1] = 0;   // G
      inputData[leftIndex + 2] = 0;   // B
      inputData[leftIndex + 3] = 255; // A
    }
    
    // Right line
    if (bounds.maxX < 1024) {
      const rightIndex = (y * width + bounds.maxX) * channels;
      inputData[rightIndex] = 255;     // R
      inputData[rightIndex + 1] = 0;   // G
      inputData[rightIndex + 2] = 0;   // B
      inputData[rightIndex + 3] = 255; // A
    }
  }
}

/**
 * DEBUG: Saves intermediate result after bridge marking for inspection
 */
async function saveDebugImageAfterBridgeRemoval(inputData, width, height, channels) {
  try {
    const sharp = (await import('sharp')).default;
    const debugBuffer = await sharp(inputData, {
      raw: {
        width: width,
        height: height,
        channels: channels
      }
    }).png().toBuffer();
    
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    
    const debugPath = path.join(process.cwd(), 'test', 'temp', 'debug-after-bridge-removal.png');
    fs.writeFileSync(debugPath, debugBuffer);
    console.log('🔍 DEBUG: Saved image after bridge marking to:', debugPath);
  } catch (error) {
    console.log('⚠️  Could not save debug image:', error.message);
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

/**
 * Checks if a part's edges are too far from tile boundaries
 * @param {Object} part - The part with bounds property
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {boolean} - True if part should be filtered out
 */
function isPartTooFarFromTileBoundaries(part, width, height) {
  const tileSizeX = width / 3;  // ~341 pixels
  const tileSizeY = height / 3; // ~341 pixels
  const maxDistanceX = tileSizeX * 0.2; // 20% of tile width (~68 pixels)
  const maxDistanceY = tileSizeY * 0.2; // 20% of tile height (~68 pixels)
  
  // Find distances to nearest tile boundaries (considering all tile boundaries in the grid)
  const verticalBoundaries = [0, tileSizeX, tileSizeX * 2, tileSizeX * 3]; // x = 0, 341, 682, 1023
  const horizontalBoundaries = [0, tileSizeY, tileSizeY * 2, tileSizeY * 3]; // y = 0, 341, 682, 1023
  
  // Calculate minimum distance from part's left edge to any vertical boundary
  const leftEdgeDistances = verticalBoundaries.map(boundary => Math.abs(part.bounds.minX - boundary));
  const minLeftEdgeDistance = Math.min(...leftEdgeDistances);
  
  // Calculate minimum distance from part's right edge to any vertical boundary
  const rightEdgeDistances = verticalBoundaries.map(boundary => Math.abs(part.bounds.maxX - boundary));
  const minRightEdgeDistance = Math.min(...rightEdgeDistances);
  
  // Calculate minimum distance from part's top edge to any horizontal boundary
  const topEdgeDistances = horizontalBoundaries.map(boundary => Math.abs(part.bounds.minY - boundary));
  const minTopEdgeDistance = Math.min(...topEdgeDistances);
  
  // Calculate minimum distance from part's bottom edge to any horizontal boundary
  const bottomEdgeDistances = horizontalBoundaries.map(boundary => Math.abs(part.bounds.maxY - boundary));
  const minBottomEdgeDistance = Math.min(...bottomEdgeDistances);
  
  // Return true if ANY edge is too far from boundaries
  return minLeftEdgeDistance > maxDistanceX || minRightEdgeDistance > maxDistanceX || 
         minTopEdgeDistance > maxDistanceY || minBottomEdgeDistance > maxDistanceY;
}