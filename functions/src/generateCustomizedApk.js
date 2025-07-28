import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";
import {onCall} from "firebase-functions/v2/https";
import {z} from "zod";
import {join, dirname} from "path";
import {tmpdir} from "os";
import {fileURLToPath} from "url";
import {extractApkToTemp, copyFileFromFirebaseStorage, cleanupTempDirectory, packApk} from "./apkUtils.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Schema for the request
const CustomizeApkRequestSchema = z.object({
  inviteCode: z.string().min(1),
});

/**
 * Customizes a template APK with user-specific assets
 * @param {Object} request - Firebase function request
 * @returns {Promise<Object>} - Returns the URL of the customized APK
 */
export const generateCustomizedApkImp = onCall({
  maxInstances: 10,
  timeoutSeconds: 540, // 9 minutes
  memory: "2GiB",
}, async (request) => {
  const {data, context} = request;
  let tempDir = null;
  
  try {
    // Validate request data
    const validatedData = CustomizeApkRequestSchema.parse(data);
    const {inviteCode} = validatedData;

    logger.info(`Starting APK customization for invite code: ${inviteCode}`);

    // Validate invite code exists
    const bucket = getStorage().bucket();
    const preferencesFile = bucket.file(`${inviteCode}/preferences.json`);
    const [exists] = await preferencesFile.exists();
    
    if (!exists) {
      throw new HttpsError("not-found", "Invalid invite code. Please use a valid invite code.");
    }

    // Create temporary directory for processing
    tempDir = join(tmpdir(), `apk-customization-${inviteCode}-${Date.now()}`);

    // Use the template APK that's deployed with the function
    const templateApkPath = join(__dirname, "Me-gotchi.apk");
    
    logger.info("Using local template APK...");

    // Extract APK using apkUtils
    const {extractPath} = await extractApkToTemp(templateApkPath, tempDir);
    logger.info("Template APK extracted successfully");

    // Download user-specific assets from Firebase Storage
    const assetsToDownload = [
      "data.json",
      "face-atlas.png", 
      "food-atlas.png",
      "activities-atlas.png",
      "background1.jpg",
      "background2.jpg", 
      "background3.jpg",
      "background4.jpg"
    ];

    logger.info("Downloading user-specific assets...");
    
    for (const asset of assetsToDownload) {
      try {
        let destinationPath;
        
        if (asset === "data.json") {
          // data.json goes in assets/data/
          destinationPath = join(extractPath, "assets", "data", asset);
        } else {
          // Image assets go in assets/images/ with .bin extension
          destinationPath = join(extractPath, "assets", "images", `${asset}.bin`);
        }

        // Use apkUtils to copy file from Firebase Storage
        await copyFileFromFirebaseStorage(`${inviteCode}/${asset}`, destinationPath);
        logger.info(`Downloaded ${asset} to ${destinationPath}`);
      } catch (error) {
        if (error.code === 'functions/not-found') {
          logger.warn(`Asset ${asset} not found for invite code ${inviteCode}, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // Create APK with customized assets using apkUtils
    const customizedApkPath = join(tempDir, "customized.apk");
    
    // Pack the APK (unsigned)
    await packApk(
      extractPath,
      customizedApkPath
    );
    
    logger.info("Customized APK created and signed successfully");

    // Upload customized APK to Firebase Storage with original name
    const customizedApkFile = bucket.file(`${inviteCode}/Me-gotchi.apk`);
    await customizedApkFile.save(await readFile(customizedApkPath), {
      metadata: {
        contentType: "application/vnd.android.package-archive",
      },
    });

    // Make the APK publicly accessible
    await customizedApkFile.makePublic();

    // Get the public URL directly since the file is public
    const url = customizedApkFile.publicUrl();

    logger.info(`Customized APK uploaded successfully: ${url}`);

    return {
      success: true,
      apkUrl: url,
      message: "APK customized successfully"
    };

  } catch (error) {
    logger.error("Error in generateCustomizedApk:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      throw new HttpsError("invalid-argument", "Invalid request data: " + error.message);
    }
    
    throw new HttpsError("internal", "Failed to customize APK: " + error.message);
  } finally {
    // Clean up temporary files using apkUtils
    await cleanupTempDirectory(tempDir);
  }
});

// Helper function to read file
async function readFile(filePath) {
  const fs = await import("fs");
  return fs.promises.readFile(filePath);
} 