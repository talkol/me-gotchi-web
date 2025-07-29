import { 
  replaceStexWithImage,
  getStexInfo,
  parseStexHeader,
  IMAGE_FORMATS,
  FEATURE_FLAGS,
  TEXTURE_FLAGS 
} from '../src/stexUtils.js';
import { join, dirname } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('stexUtils', () => {
  const testDataDir = join(__dirname, 'data');
  const testStexPath = join(testDataDir, 'activities-atlas.png-e3753df5ccff068a145191c557247b16.stex');
  const testPngPath = join(testDataDir, 'activities-atlas.png');
  const outputStexPath = join(__dirname, 'temp', 'test-output.stex');

  beforeAll(() => {
    // Ensure test files exist
    expect(existsSync(testStexPath)).toBe(true);
    expect(existsSync(testPngPath)).toBe(true);
  });

  afterEach(() => {
    // Clean up any test output files
    if (existsSync(outputStexPath)) {
      unlinkSync(outputStexPath);
    }
  });

  describe('getStexInfo', () => {
    it('should parse STEX file information correctly', () => {
      const info = getStexInfo(testStexPath);
      
      expect(info).toHaveProperty('fileSize');
      expect(info).toHaveProperty('header');
      expect(info).toHaveProperty('pixelDataSize');
      expect(info).toHaveProperty('formatName');
      
      expect(info.header.magic).toBe('GDST');
      expect(info.header.widthA).toBeGreaterThan(0);
      expect(info.header.heightA).toBeGreaterThan(0);
      expect(info.header.widthB).toBe(0); // Should be 0 for uncompressed
      expect(info.header.heightB).toBe(0); // Should be 0 for uncompressed
      
      console.log(`Original STEX: ${info.header.widthA}x${info.header.heightA}, ${info.formatName}, ${info.fileSize} bytes`);
    });

    it('should throw error for non-existent file', () => {
      expect(() => {
        getStexInfo('/non/existent/file.stex');
      }).toThrow('STEX file not found');
    });
  });

  describe('parseStexHeader', () => {
    it('should parse header buffer correctly', () => {
      const buffer = readFileSync(testStexPath);
      const header = parseStexHeader(buffer);
      
      expect(header.magic).toBe('GDST');
      expect(header.widthA).toBeGreaterThan(0);
      expect(header.heightA).toBeGreaterThan(0);
      expect(header.bytesPerPixel).toBeGreaterThan(0);
      expect(header.expectedPixelDataSize).toBeGreaterThan(0);
      
      // Verify pixel data size matches expectation
      const actualPixelDataSize = buffer.length - 20; // 20 bytes header
      expect(header.expectedPixelDataSize).toBeLessThanOrEqual(actualPixelDataSize);
    });

    it('should throw error for invalid magic', () => {
      const invalidBuffer = Buffer.from('FAKE' + '0'.repeat(16));
      expect(() => {
        parseStexHeader(invalidBuffer);
      }).toThrow('Invalid STEX magic');
    });

    it('should throw error for too small buffer', () => {
      const smallBuffer = Buffer.from('GDST');
      expect(() => {
        parseStexHeader(smallBuffer);
      }).toThrow('Invalid STEX file: too small');
    });
  });

  describe('replaceStexWithImage', () => {
    it('should replace STEX contents with PNG data successfully', async () => {
      const originalInfo = getStexInfo(testStexPath);
      
      const result = await replaceStexWithImage(
        testStexPath, 
        testPngPath, 
        { 
          outputPath: outputStexPath,
          format: IMAGE_FORMATS.FORMAT_RGBA8 
        }
      );
      
      // Verify the result object
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('newSize');
      expect(result).toHaveProperty('originalDimensions');
      expect(result).toHaveProperty('newDimensions');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('bytesPerPixel');
      expect(result).toHaveProperty('pixelDataSize');
      expect(result).toHaveProperty('outputPath');
      
      expect(result.originalSize).toBe(originalInfo.fileSize);
      expect(result.outputPath).toBe(outputStexPath);
      expect(result.format).toBe(IMAGE_FORMATS.FORMAT_RGBA8);
      expect(result.bytesPerPixel).toBe(4); // RGBA8 = 4 bytes per pixel
      
      // Verify output file was created
      expect(existsSync(outputStexPath)).toBe(true);
      
      console.log(`Conversion: ${result.originalDimensions.width}x${result.originalDimensions.height} -> ${result.newDimensions.width}x${result.newDimensions.height}`);
      console.log(`Size change: ${result.originalSize} -> ${result.newSize} bytes`);
    });

    it('should create valid STEX file with correct header', async () => {
      await replaceStexWithImage(
        testStexPath, 
        testPngPath, 
        { 
          outputPath: outputStexPath,
          format: IMAGE_FORMATS.FORMAT_RGBA8 
        }
      );
      
      // Parse the new STEX file
      const newInfo = getStexInfo(outputStexPath);
      
      expect(newInfo.header.magic).toBe('GDST');
      expect(newInfo.header.widthB).toBe(0);
      expect(newInfo.header.heightB).toBe(0);
      expect(newInfo.header.imageFormat).toBe(IMAGE_FORMATS.FORMAT_RGBA8);
      expect(newInfo.formatName).toBe('FORMAT_RGBA8');
      
      // Verify pixel data size calculation
      const expectedPixelDataSize = newInfo.header.widthA * newInfo.header.heightA * 4; // RGBA8
      expect(newInfo.pixelDataSize).toBe(expectedPixelDataSize);
      expect(newInfo.fileSize).toBe(expectedPixelDataSize + 20); // 20 bytes header + pixel data
    });

    it('should preserve texture flags from original STEX', async () => {
      const originalInfo = getStexInfo(testStexPath);
      
      await replaceStexWithImage(
        testStexPath, 
        testPngPath, 
        { outputPath: outputStexPath }
      );
      
      const newInfo = getStexInfo(outputStexPath);
      
      // Texture flags should be preserved
      expect(newInfo.header.textureFlags).toBe(originalInfo.header.textureFlags);
    });

    it('should allow custom texture flags', async () => {
      const customFlags = TEXTURE_FLAGS.FLAG_FILTER | TEXTURE_FLAGS.FLAG_REPEAT;
      
      await replaceStexWithImage(
        testStexPath, 
        testPngPath, 
        { 
          outputPath: outputStexPath,
          textureFlags: customFlags 
        }
      );
      
      const newInfo = getStexInfo(outputStexPath);
      expect(newInfo.header.textureFlags).toBe(customFlags);
    });

    it('should handle different image formats', async () => {
      // Test RGB8 format (3 bytes per pixel)
      await replaceStexWithImage(
        testStexPath, 
        testPngPath, 
        { 
          outputPath: outputStexPath,
          format: IMAGE_FORMATS.FORMAT_RGB8 
        }
      );
      
      const info = getStexInfo(outputStexPath);
      expect(info.header.imageFormat).toBe(IMAGE_FORMATS.FORMAT_RGB8);
      expect(info.formatName).toBe('FORMAT_RGB8');
      
      // Verify pixel data size for RGB8 (3 bytes per pixel)
      const expectedSize = info.header.widthA * info.header.heightA * 3;
      expect(info.pixelDataSize).toBe(expectedSize);
    });

    it('should throw error for non-existent STEX file', async () => {
      await expect(
        replaceStexWithImage('/non/existent.stex', testPngPath)
      ).rejects.toThrow('STEX file not found');
    });

    it('should throw error for non-existent image file', async () => {
      await expect(
        replaceStexWithImage(testStexPath, '/non/existent.png')
      ).rejects.toThrow('Image file not found');
    });
  });

  describe('integration test', () => {
    it('should complete full workflow: analyze -> replace -> verify', async () => {
      // Step 1: Analyze original STEX
      const originalInfo = getStexInfo(testStexPath);
      console.log('Original STEX analysis:', {
        dimensions: `${originalInfo.header.widthA}x${originalInfo.header.heightA}`,
        format: originalInfo.formatName,
        size: `${originalInfo.fileSize} bytes`,
        textureFlags: `0x${originalInfo.header.textureFlags.toString(16)}`,
        featureFlags: `0x${originalInfo.header.featureFlags.toString(16)}`
      });
      
      // Step 2: Replace with PNG
      const result = await replaceStexWithImage(
        testStexPath, 
        testPngPath, 
        { 
          outputPath: outputStexPath,
          format: IMAGE_FORMATS.FORMAT_RGBA8 
        }
      );
      
      // Step 3: Verify new STEX
      const newInfo = getStexInfo(outputStexPath);
      console.log('New STEX analysis:', {
        dimensions: `${newInfo.header.widthA}x${newInfo.header.heightA}`,
        format: newInfo.formatName,
        size: `${newInfo.fileSize} bytes`,
        textureFlags: `0x${newInfo.header.textureFlags.toString(16)}`,
        featureFlags: `0x${newInfo.header.featureFlags.toString(16)}`
      });
      
      // Verify the workflow completed successfully
      expect(result.newSize).toBe(newInfo.fileSize);
      expect(result.newDimensions.width).toBe(newInfo.header.widthA);
      expect(result.newDimensions.height).toBe(newInfo.header.heightA);
      
      // The new file should be a valid STEX with proper structure
      expect(newInfo.header.magic).toBe('GDST');
      expect(newInfo.header.imageFormat).toBe(IMAGE_FORMATS.FORMAT_RGBA8);
      expect(newInfo.pixelDataSize).toBe(result.pixelDataSize);
    });
  });
});