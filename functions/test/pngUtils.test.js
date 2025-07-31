import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { centerIconsInTiles, analyzeImageStructure } from '../src/pngUtils.js';
import sharp from 'sharp';

const TEST_DATA_DIR = path.join(process.cwd(), 'test', 'data');
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test', 'temp');

describe('PNG Utils', () => {
  beforeAll(async () => {
    // Ensure test output directory exists
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    // Clean up test outputs (optional - comment out if you want to inspect outputs)
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      const files = fs.readdirSync(TEST_OUTPUT_DIR);
      files.forEach(file => {
        if (file.endsWith('-output.png')) {
          fs.unlinkSync(path.join(TEST_OUTPUT_DIR, file));
        }
      });
    }
  });

  describe('analyzeImageStructure', () => {
    test('should analyze activities-atlas.png structure correctly', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'activities-atlas.png');
      const result = await analyzeImageStructure(inputPath);

      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.hasAlpha).toBe(true);
      expect(result.channels).toBeGreaterThanOrEqual(4);
      expect(result.tileSize).toBeCloseTo(341.33, 2);
    });

    test('should analyze face-atlas.png structure correctly', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'face-atlas.png');
      const result = await analyzeImageStructure(inputPath);

      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.hasAlpha).toBe(true);
      expect(result.channels).toBeGreaterThanOrEqual(4);
      expect(result.tileSize).toBeCloseTo(341.33, 2);
    });
  });

  describe('centerIconsInTiles', () => {
    test('should center activities icons using "center" mode', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'activities-atlas.png');
      const expectedPath = path.join(TEST_DATA_DIR, 'activities-atlas-RESULT.png');
      const outputPath = path.join(TEST_OUTPUT_DIR, 'activities-centered-output.png');

      // Process the image
      const resultBuffer = await centerIconsInTiles(inputPath, 'center');
      
      // Verify the result is a valid PNG buffer
      expect(Buffer.isBuffer(resultBuffer)).toBe(true);
      expect(resultBuffer.length).toBeGreaterThan(0);

      // Save output for manual inspection if test fails
      fs.writeFileSync(outputPath, resultBuffer);

      // Verify output image properties
      const outputMetadata = await sharp(resultBuffer).metadata();
      expect(outputMetadata.width).toBe(1024);
      expect(outputMetadata.height).toBe(1024);
      expect(outputMetadata.channels).toBeGreaterThanOrEqual(4);

      // Load expected result and compare
      const expectedBuffer = fs.readFileSync(expectedPath);
      const expectedMetadata = await sharp(expectedBuffer).metadata();
      
      // Compare metadata
      expect(outputMetadata.width).toBe(expectedMetadata.width);
      expect(outputMetadata.height).toBe(expectedMetadata.height);
      expect(outputMetadata.channels).toBe(expectedMetadata.channels);
      
      // Compare image content - convert both to raw data for pixel-perfect comparison
      const resultRaw = await sharp(resultBuffer).raw().toBuffer();
      const expectedRaw = await sharp(expectedBuffer).raw().toBuffer();
      
      // Images should be identical
      expect(resultRaw.equals(expectedRaw)).toBe(true);
    });

    test('should center face icons using "center-bottom" mode', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'face-atlas.png');
      const expectedPath = path.join(TEST_DATA_DIR, 'face-atlas-RESULT.png');
      const outputPath = path.join(TEST_OUTPUT_DIR, 'face-centered-bottom-output.png');

      // Process the image
      const resultBuffer = await centerIconsInTiles(inputPath, 'center-bottom');
      
      // Verify the result is a valid PNG buffer
      expect(Buffer.isBuffer(resultBuffer)).toBe(true);
      expect(resultBuffer.length).toBeGreaterThan(0);

      // Save output for manual inspection if test fails
      fs.writeFileSync(outputPath, resultBuffer);

      // Verify output image properties
      const outputMetadata = await sharp(resultBuffer).metadata();
      expect(outputMetadata.width).toBe(1024);
      expect(outputMetadata.height).toBe(1024);
      expect(outputMetadata.channels).toBeGreaterThanOrEqual(4);

      // Load expected result and compare
      const expectedBuffer = fs.readFileSync(expectedPath);
      const expectedMetadata = await sharp(expectedBuffer).metadata();
      
      // Compare metadata
      expect(outputMetadata.width).toBe(expectedMetadata.width);
      expect(outputMetadata.height).toBe(expectedMetadata.height);
      expect(outputMetadata.channels).toBe(expectedMetadata.channels);
      
      // Compare image content - convert both to raw data for pixel-perfect comparison
      const resultRaw = await sharp(resultBuffer).raw().toBuffer();
      const expectedRaw = await sharp(expectedBuffer).raw().toBuffer();
      
      // Images should be identical
      expect(resultRaw.equals(expectedRaw)).toBe(true);
    });

    test('should center face2 icons using "center-bottom" mode with bridge separation', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'face-atlas2.png');
      const expectedPath = path.join(TEST_DATA_DIR, 'face-atlas2-RESULT.png');
      const outputPath = path.join(TEST_OUTPUT_DIR, 'face2-centered-bottom-output.png');

      // Process the image with bridge separation algorithm
      const resultBuffer = await centerIconsInTiles(inputPath, 'center-bottom');
      
      // Verify the result is a valid PNG buffer
      expect(Buffer.isBuffer(resultBuffer)).toBe(true);
      expect(resultBuffer.length).toBeGreaterThan(0);

      // Save output for manual inspection if test fails
      fs.writeFileSync(outputPath, resultBuffer);

      // Verify output image properties
      const outputMetadata = await sharp(resultBuffer).metadata();
      expect(outputMetadata.width).toBe(1024);
      expect(outputMetadata.height).toBe(1024);
      expect(outputMetadata.channels).toBeGreaterThanOrEqual(4);

      // Load expected result and compare
      const expectedBuffer = fs.readFileSync(expectedPath);
      const expectedMetadata = await sharp(expectedBuffer).metadata();
      
      // Compare metadata
      expect(outputMetadata.width).toBe(expectedMetadata.width);
      expect(outputMetadata.height).toBe(expectedMetadata.height);
      expect(outputMetadata.channels).toBe(expectedMetadata.channels);
      
      // Compare image content - convert both to raw data for pixel-perfect comparison
      const resultRaw = await sharp(resultBuffer).raw().toBuffer();
      const expectedRaw = await sharp(expectedBuffer).raw().toBuffer();
      
      // Images should be identical
      expect(resultRaw.equals(expectedRaw)).toBe(true);
    });

    test('should center food icons using "center" mode', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'food-atlas.png');
      const expectedPath = path.join(TEST_DATA_DIR, 'food-atlas-RESULT.png');
      const outputPath = path.join(TEST_OUTPUT_DIR, 'food-centered-output.png');

      // Process the image
      const resultBuffer = await centerIconsInTiles(inputPath, 'center');
      
      // Verify the result is a valid PNG buffer
      expect(Buffer.isBuffer(resultBuffer)).toBe(true);
      expect(resultBuffer.length).toBeGreaterThan(0);

      // Save output for manual inspection if test fails
      fs.writeFileSync(outputPath, resultBuffer);

      // Verify output image properties
      const outputMetadata = await sharp(resultBuffer).metadata();
      expect(outputMetadata.width).toBe(1024);
      expect(outputMetadata.height).toBe(1024);
      expect(outputMetadata.channels).toBeGreaterThanOrEqual(4);

      // Load expected result and compare
      const expectedBuffer = fs.readFileSync(expectedPath);
      const expectedMetadata = await sharp(expectedBuffer).metadata();
      
      // Compare metadata
      expect(outputMetadata.width).toBe(expectedMetadata.width);
      expect(outputMetadata.height).toBe(expectedMetadata.height);
      expect(outputMetadata.channels).toBe(expectedMetadata.channels);
      
      // Compare image content - convert both to raw data for pixel-perfect comparison
      const resultRaw = await sharp(resultBuffer).raw().toBuffer();
      const expectedRaw = await sharp(expectedBuffer).raw().toBuffer();
      
      // Images should be identical
      expect(resultRaw.equals(expectedRaw)).toBe(true);
    });

    test('should center food2 icons using "center" mode with improved filtering', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'food-atlas2.png');
      const expectedPath = path.join(TEST_DATA_DIR, 'food-atlas2-RESULT.png');
      const outputPath = path.join(TEST_OUTPUT_DIR, 'food2-centered-output.png');

      // Process the image with improved multi-tile filtering
      const resultBuffer = await centerIconsInTiles(inputPath, 'center');
      
      // Verify the result is a valid PNG buffer
      expect(Buffer.isBuffer(resultBuffer)).toBe(true);
      expect(resultBuffer.length).toBeGreaterThan(0);

      // Save output for manual inspection if test fails
      fs.writeFileSync(outputPath, resultBuffer);

      // Verify output image properties
      const outputMetadata = await sharp(resultBuffer).metadata();
      expect(outputMetadata.width).toBe(1024);
      expect(outputMetadata.height).toBe(1024);
      expect(outputMetadata.channels).toBeGreaterThanOrEqual(4);

      // Load expected result and compare
      const expectedBuffer = fs.readFileSync(expectedPath);
      const expectedMetadata = await sharp(expectedBuffer).metadata();
      
      // Compare metadata
      expect(outputMetadata.width).toBe(expectedMetadata.width);
      expect(outputMetadata.height).toBe(expectedMetadata.height);
      expect(outputMetadata.channels).toBe(expectedMetadata.channels);
      
      // Compare image content - convert both to raw data for pixel-perfect comparison
      const resultRaw = await sharp(resultBuffer).raw().toBuffer();
      const expectedRaw = await sharp(expectedBuffer).raw().toBuffer();
      
      // Images should be identical
      expect(resultRaw.equals(expectedRaw)).toBe(true);
    });

    test('should handle different alignment modes correctly', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'activities-atlas.png');
      
      // Test both modes
      const centerResult = await centerIconsInTiles(inputPath, 'center');
      const centerBottomResult = await centerIconsInTiles(inputPath, 'center-bottom');

      // Results should be different
      expect(centerResult.equals(centerBottomResult)).toBe(false);

      // Both should be valid PNG buffers
      expect(Buffer.isBuffer(centerResult)).toBe(true);
      expect(Buffer.isBuffer(centerBottomResult)).toBe(true);
    });

    test('should throw error for invalid alignment mode', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'activities-atlas.png');
      
      await expect(centerIconsInTiles(inputPath, 'invalid-mode'))
        .rejects
        .toThrow('Alignment mode must be "center" or "center-bottom"');
    });

    test('should throw error for non-1024x1024 images', async () => {
      // Create a test image with wrong dimensions
      const wrongSizeBuffer = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      }).png().toBuffer();

      await expect(centerIconsInTiles(wrongSizeBuffer, 'center'))
        .rejects
        .toThrow('Input image must be 1024x1024 pixels');
    });

    test('should throw error for images without alpha channel', async () => {
      // Create a test image without alpha channel
      const noAlphaBuffer = await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      }).png().toBuffer();

      await expect(centerIconsInTiles(noAlphaBuffer, 'center'))
        .rejects
        .toThrow('Input image must have an alpha channel');
    });
  });

  describe('integration tests', () => {
    test('should process all test images and verify icon positioning', async () => {
      const activitiesPath = path.join(TEST_DATA_DIR, 'activities-atlas.png');
      const activitiesExpectedPath = path.join(TEST_DATA_DIR, 'activities-atlas-RESULT.png');
      const facePath = path.join(TEST_DATA_DIR, 'face-atlas.png');
      const faceExpectedPath = path.join(TEST_DATA_DIR, 'face-atlas-RESULT.png');
      const foodPath = path.join(TEST_DATA_DIR, 'food-atlas.png');
      const foodExpectedPath = path.join(TEST_DATA_DIR, 'food-atlas-RESULT.png');
      const food2Path = path.join(TEST_DATA_DIR, 'food-atlas2.png');
      const food2ExpectedPath = path.join(TEST_DATA_DIR, 'food-atlas2-RESULT.png');

      // Process all images
      const activitiesResult = await centerIconsInTiles(activitiesPath, 'center');
      const faceResult = await centerIconsInTiles(facePath, 'center-bottom');
      const foodResult = await centerIconsInTiles(foodPath, 'center');
      const food2Result = await centerIconsInTiles(food2Path, 'center');

      // Verify all results are valid
      expect(Buffer.isBuffer(activitiesResult)).toBe(true);
      expect(Buffer.isBuffer(faceResult)).toBe(true);
      expect(Buffer.isBuffer(foodResult)).toBe(true);
      expect(Buffer.isBuffer(food2Result)).toBe(true);

      // Verify we can analyze the output images
      const activitiesAnalysis = await analyzeImageStructure(activitiesResult);
      const faceAnalysis = await analyzeImageStructure(faceResult);
      const foodAnalysis = await analyzeImageStructure(foodResult);
      const food2Analysis = await analyzeImageStructure(food2Result);

      expect(activitiesAnalysis.width).toBe(1024);
      expect(activitiesAnalysis.height).toBe(1024);
      expect(faceAnalysis.width).toBe(1024);
      expect(faceAnalysis.height).toBe(1024);
      expect(foodAnalysis.width).toBe(1024);
      expect(foodAnalysis.height).toBe(1024);
      expect(food2Analysis.width).toBe(1024);
      expect(food2Analysis.height).toBe(1024);

      // Compare against expected results
      const activitiesExpected = fs.readFileSync(activitiesExpectedPath);
      const faceExpected = fs.readFileSync(faceExpectedPath);
      const foodExpected = fs.readFileSync(foodExpectedPath);
      const food2Expected = fs.readFileSync(food2ExpectedPath);

      // Convert to raw data for pixel-perfect comparison
      const activitiesResultRaw = await sharp(activitiesResult).raw().toBuffer();
      const activitiesExpectedRaw = await sharp(activitiesExpected).raw().toBuffer();
      const faceResultRaw = await sharp(faceResult).raw().toBuffer();
      const faceExpectedRaw = await sharp(faceExpected).raw().toBuffer();
      const foodResultRaw = await sharp(foodResult).raw().toBuffer();
      const foodExpectedRaw = await sharp(foodExpected).raw().toBuffer();
      const food2ResultRaw = await sharp(food2Result).raw().toBuffer();
      const food2ExpectedRaw = await sharp(food2Expected).raw().toBuffer();

      // All results should match expected output exactly
      expect(activitiesResultRaw.equals(activitiesExpectedRaw)).toBe(true);
      expect(faceResultRaw.equals(faceExpectedRaw)).toBe(true);
      expect(foodResultRaw.equals(foodExpectedRaw)).toBe(true);
      expect(food2ResultRaw.equals(food2ExpectedRaw)).toBe(true);
    }, 20000);

    test('should preserve image quality and transparency', async () => {
      const inputPath = path.join(TEST_DATA_DIR, 'activities-atlas.png');
      const result = await centerIconsInTiles(inputPath, 'center');

      // Load original and result for comparison
      const originalData = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
      const resultData = await sharp(result).raw().toBuffer({ resolveWithObject: true });

      // Count non-transparent pixels in both images
      const originalPixelCount = countNonTransparentPixels(originalData.data);
      const resultPixelCount = countNonTransparentPixels(resultData.data);

      // Should have similar amounts of content (allowing for some variation due to processing)
      const pixelCountRatio = resultPixelCount / originalPixelCount;
      expect(pixelCountRatio).toBeGreaterThan(0.8); // Allow 20% variation
      expect(pixelCountRatio).toBeLessThan(1.2);
    });
  });
});

// Helper functions
function countNonTransparentPixels(rawData) {
  let count = 0;
  for (let i = 3; i < rawData.length; i += 4) {
    if (rawData[i] > 10) { // Use same threshold as algorithm
      count++;
    }
  }
  return count;
}