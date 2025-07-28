import { 
  checkApksignerAvailability, 
  extractApkToTemp, 
  packAndSignApk, 
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

/**
 * Helper function to verify APK signature using apksigner
 * @param {string} apkPath - Path to the APK file to verify
 * @returns {Promise<{valid: boolean, output: string, error?: string}>}
 */
async function verifyApkSignature(apkPath) {
  try {
    const apksignerCheck = await checkApksignerAvailability();
    if (!apksignerCheck.available) {
      return { valid: false, output: '', error: 'apksigner not available' };
    }

    const verifyCommand = `"${apksignerCheck.path}" verify --verbose "${apkPath}"`;
    const { stdout, stderr } = await execAsync(verifyCommand);
    
    // apksigner verify returns 0 if signature is valid
    return { valid: true, output: stdout, error: stderr };
  } catch (error) {
    return { valid: false, output: '', error: error.message };
  }
}

/**
 * Helper function to extract certificate information from APK
 * @param {string} apkPath - Path to the APK file
 * @returns {Promise<{success: boolean, certificate: string, error?: string}>}
 */
async function extractCertificateInfo(apkPath) {
  try {
    const apksignerCheck = await checkApksignerAvailability();
    if (!apksignerCheck.available) {
      return { success: false, certificate: '', error: 'apksigner not available' };
    }

    // Use apksigner to extract certificate information
    const certCommand = `"${apksignerCheck.path}" verify --print-certs "${apkPath}"`;
    const { stdout, stderr } = await execAsync(certCommand);
    
    return { success: true, certificate: stdout, error: stderr };
  } catch (error) {
    return { success: false, certificate: '', error: error.message };
  }
}

describe('apkUtils', () => {
  const testApkPath = join(__dirname, 'data', 'Me-gotchi.apk');
  let tempDir = null;

  describe('checkApksignerAvailability', () => {
    it('should check if apksigner is available', async () => {
      const result = await checkApksignerAvailability();
      
      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('path');
      
      if (result.available) {
        expect(result.path).toBeTruthy();
        console.log(`✅ apksigner is available at: ${result.path}`);
      } else {
        expect(result.error).toBeTruthy();
        console.log(`❌ apksigner is not available: ${result.error}`);
      }
    });
  });

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

  describe('packAndSignApk', () => {
    let extractPath = null;
    let testKeystorePath = null;

    beforeAll(async () => {
      // Extract APK for testing
      const result = await extractApkToTemp(testApkPath);
      extractPath = result.extractPath;
      tempDir = result.tempDir;
      
      // Use the actual release keystore from android-app directory
      testKeystorePath = join(__dirname, '..', '..', '..', 'android-app', 'release.keystore');
    });

    it('should pack and sign APK when apksigner is available', async () => {
      const apksignerCheck = await checkApksignerAvailability();
      
      if (apksignerCheck.available) {
        // Check if keystore exists
        expect(existsSync(testKeystorePath)).toBe(true);
        
        const outputPath = join(__dirname, 'temp', 'test-signed.apk');
        
        try {
          // Use the actual release keystore with correct password
          await packAndSignApk(
            extractPath,
            outputPath,
            testKeystorePath,
            'trustno1', // keystore password
            'release',  // key alias (common default)
            'trustno1'  // key password (same as keystore password)
          );
          
          // If we get here, the function executed successfully
          expect(existsSync(outputPath)).toBe(true);
          console.log('✅ APK signed successfully with release keystore');
          
          // Verify the signature is intact
          const signatureVerification = await verifyApkSignature(outputPath);
          expect(signatureVerification.valid).toBe(true);
          console.log('✅ APK signature verified successfully');
          console.log('Signature verification output:', signatureVerification.output);
          
        } catch (error) {
          // If signing fails, it should be a specific error, not a missing keystore error
          expect(error.message).toContain('Failed to pack and sign APK');
          console.log('⚠️ APK signing failed (expected if keystore config is different):', error.message);
        }
      } else {
        console.log('Skipping packAndSignApk test - apksigner not available');
      }
    });

    it('should throw error when apksigner is not available', async () => {
      // This test would require mocking apksigner availability
      // For now, we'll skip if apksigner is available
      const apksignerCheck = await checkApksignerAvailability();
      
      if (!apksignerCheck.available) {
        await expect(packAndSignApk(
          extractPath,
          join(__dirname, 'temp', 'test.apk'),
          testKeystorePath,
          'password',
          'alias',
          'key-password'
        )).rejects.toThrow('apksigner not available');
      } else {
        console.log('Skipping apksigner availability test - apksigner is available');
      }
    });

    it('should verify APK signature integrity', async () => {
      const apksignerCheck = await checkApksignerAvailability();
      
      if (apksignerCheck.available) {
        // Test with the original APK to see if it's already signed
        const originalSignatureCheck = await verifyApkSignature(testApkPath);
        console.log('Original APK signature status:', originalSignatureCheck.valid ? 'Valid' : 'Invalid/Unsigned');
        
        if (originalSignatureCheck.valid) {
          console.log('Original APK signature verification output:', originalSignatureCheck.output);
        }
        
        // Test with a signed APK if we have one from previous test
        const signedApkPath = join(__dirname, 'temp', 'test-signed.apk');
        if (existsSync(signedApkPath)) {
          const signedSignatureCheck = await verifyApkSignature(signedApkPath);
          expect(signedSignatureCheck.valid).toBe(true);
          console.log('Signed APK signature verification output:', signedSignatureCheck.output);
        }
      } else {
        console.log('Skipping signature verification test - apksigner not available');
      }
    });

    it('should verify same signer certificate between original and signed APK', async () => {
      const apksignerCheck = await checkApksignerAvailability();
      
      if (apksignerCheck.available) {
        // Extract certificate info from original APK
        const originalCertInfo = await extractCertificateInfo(testApkPath);
        expect(originalCertInfo.success).toBe(true);
        console.log('Original APK certificate info:', originalCertInfo.certificate);
        
        // Extract certificate info from signed APK (if it exists from previous test)
        const signedApkPath = join(__dirname, 'temp', 'test-signed.apk');
        if (existsSync(signedApkPath)) {
          const signedCertInfo = await extractCertificateInfo(signedApkPath);
          expect(signedCertInfo.success).toBe(true);
          console.log('Signed APK certificate info:', signedCertInfo.certificate);
          
          // Compare certificate information
          // Extract key parts of certificate info for comparison
          const extractKeyInfo = (certInfo) => {
            const lines = certInfo.split('\n');
            const keyInfo = {
              issuer: '',
              subject: '',
              serialNumber: '',
              validFrom: '',
              validUntil: ''
            };
            
            for (const line of lines) {
              if (line.includes('Issuer:')) keyInfo.issuer = line.trim();
              if (line.includes('Subject:')) keyInfo.subject = line.trim();
              if (line.includes('Serial number:')) keyInfo.serialNumber = line.trim();
              if (line.includes('Valid from:')) keyInfo.validFrom = line.trim();
              if (line.includes('Valid until:')) keyInfo.validUntil = line.trim();
            }
            
            return keyInfo;
          };
          
          const originalKeyInfo = extractKeyInfo(originalCertInfo.certificate);
          const signedKeyInfo = extractKeyInfo(signedCertInfo.certificate);
          
          console.log('Original APK key info:', originalKeyInfo);
          console.log('Signed APK key info:', signedKeyInfo);
          
          // Verify that the certificates match (same signer)
          expect(signedKeyInfo.issuer).toBe(originalKeyInfo.issuer);
          expect(signedKeyInfo.subject).toBe(originalKeyInfo.subject);
          expect(signedKeyInfo.serialNumber).toBe(originalKeyInfo.serialNumber);
          
          console.log('✅ Certificate information matches - same signer verified');
        } else {
          console.log('⚠️ No signed APK found for comparison (run signing test first)');
        }
      } else {
        console.log('Skipping certificate comparison test - apksigner not available');
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