import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * STEX (Stream Texture) utility for replacing pixel data with PNG/JPG images
 * Based on Godot Engine STEX uncompressed format specification
 */

// Image format constants (matches Godot's Image::Format enum)
export const IMAGE_FORMATS = {
    FORMAT_L8: 0x00,     // 8-bit luminance
    FORMAT_LA8: 0x01,    // 8-bit luminance + alpha
    FORMAT_R8: 0x02,     // 8-bit red
    FORMAT_RG8: 0x03,    // 8-bit red + green
    FORMAT_RGB8: 0x04,   // 8-bit RGB
    FORMAT_RGBA8: 0x05,  // 8-bit RGBA
    FORMAT_RGB565: 0x06, // 5-6-5 RGB
    FORMAT_RGBA4444: 0x07, // 4-4-4-4 RGBA
    FORMAT_RGBA5551: 0x08  // 5-5-5-1 RGBA
};

// Feature flags for format field (high 24 bits)
export const FEATURE_FLAGS = {
    HAS_MIPMAPS: 0x00010000,
    STREAM: 0x00020000,
    DETECT_3D: 0x00040000,
    DETECT_SRGB: 0x00080000,
    DETECT_NORMAL: 0x00100000
};

// Texture flags
export const TEXTURE_FLAGS = {
    FLAG_MIPMAPS: 0x01,
    FLAG_REPEAT: 0x02,
    FLAG_FILTER: 0x04,
    FLAG_ANISOTROPIC_FILTER: 0x08,
    FLAG_CONVERT_TO_LINEAR: 0x10,
    FLAG_MIRRORED_REPEAT: 0x20,
    FLAG_VIDEO_SURFACE: 0x40
};

/**
 * Parse STEX file header
 * @param {Buffer} buffer - STEX file buffer
 * @returns {Object} Parsed header information
 */
export function parseStexHeader(buffer) {
    if (buffer.length < 20) {
        throw new Error('Invalid STEX file: too small');
    }

    const magic = buffer.subarray(0, 4).toString('ascii');
    if (magic !== 'GDST') {
        throw new Error(`Invalid STEX magic: expected 'GDST', got '${magic}'`);
    }

    // All fields are little-endian
    const header = {
        magic,
        widthA: buffer.readUInt16LE(4),
        widthB: buffer.readUInt16LE(6),
        heightA: buffer.readUInt16LE(8),
        heightB: buffer.readUInt16LE(10),
        textureFlags: buffer.readUInt32LE(12),
        format: buffer.readUInt32LE(16)
    };

    // Extract format components
    header.imageFormat = header.format & 0xFF;
    header.featureFlags = header.format & 0xFFFFFF00;
    header.hasMinmaps = !!(header.featureFlags & FEATURE_FLAGS.HAS_MIPMAPS);

    // Calculate bytes per pixel based on format
    const bytesPerPixelMap = {
        [IMAGE_FORMATS.FORMAT_L8]: 1,
        [IMAGE_FORMATS.FORMAT_LA8]: 2,
        [IMAGE_FORMATS.FORMAT_R8]: 1,
        [IMAGE_FORMATS.FORMAT_RG8]: 2,
        [IMAGE_FORMATS.FORMAT_RGB8]: 3,
        [IMAGE_FORMATS.FORMAT_RGBA8]: 4,
        [IMAGE_FORMATS.FORMAT_RGB565]: 2,
        [IMAGE_FORMATS.FORMAT_RGBA4444]: 2,
        [IMAGE_FORMATS.FORMAT_RGBA5551]: 2
    };

    header.bytesPerPixel = bytesPerPixelMap[header.imageFormat] || 4;
    header.expectedPixelDataSize = header.widthA * header.heightA * header.bytesPerPixel;

    return header;
}

/**
 * Create STEX header buffer
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} imageFormat - Image format (IMAGE_FORMATS)
 * @param {number} textureFlags - Texture flags
 * @param {number} featureFlags - Feature flags
 * @returns {Buffer} Header buffer
 */
export function createStexHeader(width, height, imageFormat = IMAGE_FORMATS.FORMAT_RGBA8, textureFlags = 0, featureFlags = 0) {
    const buffer = Buffer.alloc(20);
    
    // Magic
    buffer.write('GDST', 0, 4, 'ascii');
    
    // Dimensions (little-endian)
    buffer.writeUInt16LE(width, 4);   // widthA
    buffer.writeUInt16LE(0, 6);       // widthB (always 0 for uncompressed)
    buffer.writeUInt16LE(height, 8);  // heightA
    buffer.writeUInt16LE(0, 10);      // heightB (always 0 for uncompressed)
    
    // Flags
    buffer.writeUInt32LE(textureFlags, 12);
    buffer.writeUInt32LE(imageFormat | featureFlags, 16);
    
    return buffer;
}

/**
 * Load and convert image to raw pixel data
 * @param {string} imagePath - Path to PNG or JPG image
 * @param {number} targetFormat - Target image format
 * @returns {Promise<{width: number, height: number, pixelData: Buffer}>}
 */
export async function loadImageAsPixelData(imagePath, targetFormat = IMAGE_FORMATS.FORMAT_RGBA8) {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    let pixelData;
    let channels;
    
    switch (targetFormat) {
        case IMAGE_FORMATS.FORMAT_L8:
            pixelData = await image.greyscale().raw().toBuffer();
            channels = 1;
            break;
        case IMAGE_FORMATS.FORMAT_LA8:
            pixelData = await image.ensureAlpha().greyscale().raw().toBuffer();
            channels = 2;
            break;
        case IMAGE_FORMATS.FORMAT_R8:
            pixelData = await image.extractChannel(0).raw().toBuffer();
            channels = 1;
            break;
        case IMAGE_FORMATS.FORMAT_RG8:
            pixelData = await image.extractChannel([0, 1]).raw().toBuffer();
            channels = 2;
            break;
        case IMAGE_FORMATS.FORMAT_RGB8:
            pixelData = await image.removeAlpha().raw().toBuffer();
            channels = 3;
            break;
        case IMAGE_FORMATS.FORMAT_RGBA8:
        default:
            pixelData = await image.ensureAlpha().raw().toBuffer();
            channels = 4;
            break;
    }
    
    return {
        width: metadata.width,
        height: metadata.height,
        pixelData,
        channels
    };
}

/**
 * Replace STEX file contents with image data
 * @param {string} stexPath - Path to existing STEX file
 * @param {string} imagePath - Path to PNG or JPG image
 * @param {Object} options - Options for conversion
 * @param {number} options.format - Target image format (default: RGBA8)
 * @param {number} options.textureFlags - Texture flags to preserve/set
 * @param {number} options.featureFlags - Feature flags to preserve/set
 * @param {string} options.outputPath - Output path (default: overwrites input)
 * @returns {Promise<Object>} Conversion results
 */
export async function replaceStexWithImage(stexPath, imagePath, options = {}) {
    // Validate input files
    if (!fs.existsSync(stexPath)) {
        throw new Error(`STEX file not found: ${stexPath}`);
    }
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }
    
    // Parse existing STEX to preserve some settings
    const existingStexBuffer = fs.readFileSync(stexPath);
    const existingHeader = parseStexHeader(existingStexBuffer);
    
    // Set up conversion options
    const targetFormat = options.format || IMAGE_FORMATS.FORMAT_RGBA8;
    const textureFlags = options.textureFlags !== undefined ? options.textureFlags : existingHeader.textureFlags;
    const featureFlags = options.featureFlags !== undefined ? options.featureFlags : (existingHeader.featureFlags & ~FEATURE_FLAGS.HAS_MIPMAPS); // Remove mipmaps for now
    const outputPath = options.outputPath || stexPath;
    
    // Load and convert image
    const imageData = await loadImageAsPixelData(imagePath, targetFormat);
    
    // Create new STEX header
    const newHeader = createStexHeader(
        imageData.width,
        imageData.height,
        targetFormat,
        textureFlags,
        featureFlags
    );
    
    // Combine header and pixel data
    const newStexBuffer = Buffer.concat([newHeader, imageData.pixelData]);
    
    // Write new STEX file
    fs.writeFileSync(outputPath, newStexBuffer);
    
    return {
        originalSize: existingStexBuffer.length,
        newSize: newStexBuffer.length,
        originalDimensions: { width: existingHeader.widthA, height: existingHeader.heightA },
        newDimensions: { width: imageData.width, height: imageData.height },
        format: targetFormat,
        bytesPerPixel: imageData.channels,
        pixelDataSize: imageData.pixelData.length,
        outputPath
    };
}

/**
 * Get information about a STEX file
 * @param {string} stexPath - Path to STEX file
 * @returns {Object} STEX file information
 */
export function getStexInfo(stexPath) {
    if (!fs.existsSync(stexPath)) {
        throw new Error(`STEX file not found: ${stexPath}`);
    }
    
    const buffer = fs.readFileSync(stexPath);
    const header = parseStexHeader(buffer);
    
    return {
        fileSize: buffer.length,
        header,
        pixelDataSize: buffer.length - 20,
        formatName: Object.keys(IMAGE_FORMATS).find(key => IMAGE_FORMATS[key] === header.imageFormat) || 'UNKNOWN'
    };
}