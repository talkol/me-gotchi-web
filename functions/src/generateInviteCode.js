import {onCall, HttpsError} from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

/**
 * Creates a new invite code with a publicly accessible preferences.json file.
 * This function uses the Firebase Admin SDK to ensure the file is publicly accessible.
 * Only authenticated users can call this function.
 * 
 * @param {object} data - The data payload from the client.
 * @param {string} data.inviteCode - The invite code to create.
 * @param {object} context - The callable function context containing auth info.
 * @returns {Promise<{success: boolean, message: string}>} - A promise resolving with the result.
 * @throws {HttpsError} - Throws HttpsError on validation, auth, or storage errors.
 */
export const generateInviteCodeImp = onCall({timeoutSeconds: 60}, async (request) => {
  // Check if user is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated to create invite codes.");
  }
  
  const { uid, email } = request.auth;
  
  const { inviteCode } = request.data;
  
  if (!inviteCode) {
    throw new HttpsError("invalid-argument", "Invite code is required.");
  }
  
  // Validate invite code format (XXXX-XXXX-XXXX)
  const inviteCodePattern = /^\d{4}-\d{4}-\d{4}$/;
  if (!inviteCodePattern.test(inviteCode)) {
    throw new HttpsError("invalid-argument", "Invite code must be in format XXXX-XXXX-XXXX");
  }
  
  try {
    const bucket = getStorage().bucket();
    const filePath = `${inviteCode}/preferences.json`;
    const file = bucket.file(filePath);
    
    // Check if the file already exists
    const [exists] = await file.exists();
    if (exists) {
      throw new HttpsError("already-exists", `Invite code ${inviteCode} already exists`);
    }
    
    // Create preferences.json with the invite code
    const preferencesData = { inviteCode };
    const preferencesJson = JSON.stringify(preferencesData, null, 2);
    
    // Save the file with proper metadata
    await file.save(preferencesJson, {
      metadata: {
        contentType: "application/json",
      },
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    const publicUrl = file.publicUrl();
    
    logger.info(`Invite code ${inviteCode} created successfully by user ${email} (UID: ${uid}) at ${publicUrl}`);
    
    return { 
      success: true, 
      message: `Invite code ${inviteCode} created successfully`,
      publicUrl: publicUrl
    };
    
  } catch (error) {
    logger.error(`Error creating invite code ${inviteCode} by user ${email} (UID: ${uid}):`, error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while creating the invite code."
    );
  }
}); 