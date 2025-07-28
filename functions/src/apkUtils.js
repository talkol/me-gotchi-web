import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";
import AdmZip from "adm-zip";
import {mkdir, rm} from "fs/promises";
import {existsSync} from "fs";
import {join} from "path";
import {tmpdir} from "os";
import {exec} from "child_process";
import {promisify} from "util";

const execAsync = promisify(exec);

/**
 * Helper function to check if apksigner is available and get its path
 * @returns {Promise<{available: boolean, path: string, error?: string}>}
 */
export async function checkApksignerAvailability() {
  try {
    // Check if we're in a local development environment (Mac)
    if (process.platform === 'darwin') {
      // Try to find apksigner in common Mac installation paths
      const possiblePaths = [
        '/opt/homebrew/share/android-commandlinetools/build-tools/34.0.0/apksigner',
        '/opt/homebrew/share/android-commandlinetools/build-tools/30.0.3/apksigner',
        '/usr/local/share/android-commandlinetools/build-tools/34.0.0/apksigner',
        '/usr/local/share/android-commandlinetools/build-tools/30.0.3/apksigner'
      ];
      
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          // Test if the apksigner works
          try {
            await execAsync(`"${path}" --version`);
            return { available: true, path };
          } catch (error) {
            logger.warn(`apksigner found at ${path} but failed to execute:`, error.message);
          }
        }
      }
      
      return { 
        available: false, 
        path: null, 
        error: "apksigner not found in common Mac installation paths. Please install Android Build Tools." 
      };
    }
    
    // In Firebase Cloud Functions or other environments, try PATH
    try {
      await execAsync('apksigner --version');
      return { available: true, path: 'apksigner' };
    } catch (error) {
      return { 
        available: false, 
        path: null, 
        error: "apksigner not found in PATH. Please ensure Android Build Tools are installed." 
      };
    }
    
  } catch (error) {
    return { 
      available: false, 
      path: null, 
      error: `Error checking apksigner availability: ${error.message}` 
    };
  }
}

/**
 * Utility functions for APK operations
 * 
 * This file contains functions for:
 * - Extracting APK to a temp folder
 * - Packing temp folder back to APK and signing it
 * - Copying files from Firebase Storage to temp folder
 */

/**
 * Extracts an APK file to a temporary folder
 * @param {string} apkPath - Path to the APK file
 * @param {string} tempDir - Temporary directory path (optional, will create if not provided)
 * @returns {Promise<{extractPath: string, tempDir: string}>} - Returns the extraction path and temp directory
 */
export async function extractApkToTemp(apkPath, tempDir = null) {
  try {
    logger.info(`Extracting APK: ${apkPath}`);
    
    // Create temp directory if not provided
    if (!tempDir) {
      tempDir = join(tmpdir(), `apk-extract-${Date.now()}`);
      await mkdir(tempDir, {recursive: true});
    }
    
    const extractPath = join(tempDir, "extracted");
    await mkdir(extractPath, {recursive: true});
    
    // Extract APK using AdmZip
    const zip = new AdmZip(apkPath);
    zip.extractAllTo(extractPath, true);
    
    logger.info(`APK extracted successfully to: ${extractPath}`);
    
    return {
      extractPath,
      tempDir
    };
    
  } catch (error) {
    logger.error("Error extracting APK:", error);
    throw new HttpsError("internal", "Failed to extract APK: " + error.message);
  }
}

/**
 * Packs a temp folder back to an APK and signs it using a release keystore
 * @param {string} extractPath - Path to the extracted APK contents
 * @param {string} outputPath - Path where the signed APK should be saved
 * @param {string} keystorePath - Path to the release keystore file
 * @param {string} keystorePassword - Password for the keystore
 * @param {string} keyAlias - Alias of the key in the keystore
 * @param {string} keyPassword - Password for the key
 * @returns {Promise<string>} - Returns the path to the signed APK
 */
export async function packAndSignApk(extractPath, outputPath, keystorePath, keystorePassword, keyAlias, keyPassword) {
  try {
    logger.info(`Packing and signing APK from: ${extractPath}`);
    
    // Create new APK using AdmZip
    const zip = new AdmZip();
    
    // Add all files from extracted directory to new zip
    const addDirectoryToZip = async (dirPath, zipPath = "") => {
      const {readdirSync, statSync} = await import("fs");
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          await addDirectoryToZip(fullPath, join(zipPath, item));
        } else {
          zip.addLocalFile(fullPath, zipPath);
        }
      }
    };

    await addDirectoryToZip(extractPath);
    
    // Save unsigned APK
    const unsignedApkPath = outputPath.replace('.apk', '_unsigned.apk');
    zip.writeZip(unsignedApkPath);
    
    logger.info(`Unsigned APK created: ${unsignedApkPath}`);
    
    // Sign the APK using apksigner
    const apksignerCheck = await checkApksignerAvailability();
    if (!apksignerCheck.available) {
      throw new HttpsError("internal", `apksigner not available: ${apksignerCheck.error}`);
    }
    
    const signCommand = `"${apksignerCheck.path}" sign --ks "${keystorePath}" --ks-pass pass:"${keystorePassword}" --key-pass pass:"${keyPassword}" --out "${outputPath}" "${unsignedApkPath}"`;
    
    logger.info(`Signing APK with apksigner at: ${apksignerCheck.path}`);
    const {stdout, stderr} = await execAsync(signCommand);
    
    if (stderr && !stderr.includes("WARNING")) {
      logger.error("Error signing APK:", stderr);
      throw new HttpsError("internal", "Failed to sign APK: " + stderr);
    }
    
    logger.info(`APK signed successfully: ${outputPath}`);
    logger.info("Signing output:", stdout);
    
    // Clean up unsigned APK
    try {
      const {unlinkSync} = await import("fs");
      unlinkSync(unsignedApkPath);
      logger.info("Cleaned up unsigned APK");
    } catch (cleanupError) {
      logger.warn("Could not clean up unsigned APK:", cleanupError);
    }
    
    return outputPath;
    
  } catch (error) {
    logger.error("Error packing and signing APK:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to pack and sign APK: " + error.message);
  }
}

/**
 * Copies a file from Firebase Storage bucket to a specific location in the temp folder
 * @param {string} filePath - Path to the file in Firebase Storage (e.g., "inviteCode/file.png")
 * @param {string} destinationPath - Full path where the file should be copied in the temp folder
 * @param {string} bucketName - Optional bucket name (defaults to default bucket)
 * @returns {Promise<void>}
 */
export async function copyFileFromFirebaseStorage(filePath, destinationPath, bucketName = null) {
  try {
    logger.info(`Copying file from Firebase Storage: ${filePath} to ${destinationPath}`);
    
    // Use specified bucket or default bucket
    const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", `File not found in Firebase Storage: ${filePath}`);
    }
    
    // Ensure destination directory exists
    const {dirname} = await import("path");
    const destinationDir = dirname(destinationPath);
    await mkdir(destinationDir, {recursive: true});
    
    // Download file to destination
    await file.download({destination: destinationPath});
    
    logger.info(`File copied successfully from ${filePath} to ${destinationPath}`);
    
  } catch (error) {
    logger.error("Error copying file from Firebase Storage:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to copy file from Firebase Storage: " + error.message);
  }
}

/**
 * Utility function to clean up temporary directories
 * @param {string} tempDir - Path to the temporary directory to clean up
 * @returns {Promise<void>}
 */
export async function cleanupTempDirectory(tempDir) {
  try {
    if (tempDir) {
      await rm(tempDir, {recursive: true, force: true});
      logger.info(`Temporary directory cleaned up: ${tempDir}`);
    }
  } catch (error) {
    logger.error("Error cleaning up temporary directory:", error);
    // Don't throw error for cleanup failures
  }
} 