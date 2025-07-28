import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";
import AdmZip from "adm-zip";
import {mkdir, rm} from "fs/promises";
import {join} from "path";
import {tmpdir} from "os";

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
 * Packs a temp folder back to an APK (unsigned)
 * @param {string} extractPath - Path to the extracted APK contents
 * @param {string} outputPath - Path where the APK should be saved
 * @returns {Promise<string>} - Returns the path to the APK
 */
export async function packApk(extractPath, outputPath) {
  try {
    logger.info(`Packing APK from: ${extractPath}`);
    
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
    
    // For cloud functions, we'll skip signing and return the unsigned APK
    // In production, you might want to use a pre-signed template or a different signing approach
    logger.info("Skipping APK signing in cloud function environment");
    
    // Copy unsigned APK to output path
    const {copyFileSync} = await import("fs");
    copyFileSync(unsignedApkPath, outputPath);
    logger.info(`Unsigned APK copied to: ${outputPath}`);
    
    // Clean up unsigned APK
    try {
      const {unlinkSync} = await import("fs");
      unlinkSync(unsignedApkPath);
      logger.info("Cleaned up temporary unsigned APK");
    } catch (cleanupError) {
      logger.warn("Could not clean up temporary unsigned APK:", cleanupError);
    }
    
    return outputPath;
    
  } catch (error) {
    logger.error("Error packing APK:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to pack APK: " + error.message);
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