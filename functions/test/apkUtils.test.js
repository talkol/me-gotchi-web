import { 
  extractApkToTemp, 
  packApk, 
  cleanupTempDirectory 
} from '../src/apkUtils.js';
import { join, dirname } from 'path';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



describe('apkUtils', () => {
  const testApkPath = join(__dirname, 'data', 'Me-gotchi.apk');
  let tempDir = null;



  describe('extractApkToTemp', () => {
    it('should extract APK to temporary directory', async () => {
      // Check if test APK exists
      expect(existsSync(testApkPath)).toBe(true);
      
      const result = await extractApkToTemp(testApkPath);
      
      expect(result).toHaveProperty('extractPath');
      expect(result).toHaveProperty('tempDir');
      expect(existsSync(result.extractPath)).toBe(true);
      
      // Check that common APK directories exist
      const extractedContents = readdirSync(result.extractPath);
      expect(extractedContents).toContain('META-INF');
      expect(extractedContents).toContain('res');
      
      // Store tempDir for cleanup
      tempDir = result.tempDir;
    });

    it('should create custom temp directory when provided', async () => {
      const customTempDir = join(__dirname, 'temp', 'custom-extract');
      const result = await extractApkToTemp(testApkPath, customTempDir);
      
      expect(result.tempDir).toBe(customTempDir);
      expect(result.extractPath).toBe(join(customTempDir, 'extracted'));
      expect(existsSync(result.extractPath)).toBe(true);
      
      // Clean up custom temp directory
      await cleanupTempDirectory(customTempDir);
    });
  });

  describe('packApk', () => {
    let extractPath = null;

    beforeAll(async () => {
      // Extract APK for testing
      const result = await extractApkToTemp(testApkPath);
      extractPath = result.extractPath;
      tempDir = result.tempDir;
    });

    it('should pack APK from extracted directory', async () => {
      const outputPath = join(__dirname, 'temp', 'test-unsigned.apk');
      
      try {
        await packApk(
          extractPath,
          outputPath
        );
        
        // Verify the APK was created
        expect(existsSync(outputPath)).toBe(true);
        console.log('✅ APK packed successfully (unsigned)');
        
      } finally {
        // Clean up
        if (existsSync(outputPath)) {
          const {unlinkSync} = await import('fs');
          unlinkSync(outputPath);
        }
      }
    });
  });

  describe('cleanupTempDirectory', () => {
    it('should clean up temporary directory', async () => {
      if (tempDir && existsSync(tempDir)) {
        await cleanupTempDirectory(tempDir);
        expect(existsSync(tempDir)).toBe(false);
      }
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = join(__dirname, 'temp', 'non-existent');
      await expect(cleanupTempDirectory(nonExistentDir)).resolves.not.toThrow();
    });

    it('should handle null/undefined directory gracefully', async () => {
      await expect(cleanupTempDirectory(null)).resolves.not.toThrow();
      await expect(cleanupTempDirectory(undefined)).resolves.not.toThrow();
    });
  });
}); 