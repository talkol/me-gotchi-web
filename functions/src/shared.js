import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {z} from "zod";

export const FoodItemSchema = z.object({
    name: z.string().max(11),
    addExplanation: z.boolean(),
    explanation: z.string().optional(),
  });
  
export const ActivityItemSchema = z.object({
    name: z.string().max(11),
    addExplanation: z.boolean(),
    explanation: z.string().optional(),
  });
  
export const EnvironmentItemSchema = z.object({
    explanation: z.string(),
  });
  
// Define a Zod schema for input validation
export const GenerationRequestSchema = z.object({
    inviteCode: z.string().min(1),
    photoDataUri: z.string().optional().nullable(),
    characterImageUrl: z.string().optional().nullable(),
    imageUrls: z.record(z.string()).optional(),
    
    // All form fields to be saved in preferences.json
    firstName: z.string().max(11).optional(),
    gender: z.enum(["male", "female"]).optional(),
    age: z.coerce.number().min(1).max(120).optional(),
    
    likedFoods: z.array(FoodItemSchema).optional(),
    dislikedFoods: z.array(FoodItemSchema).optional(),
    likedDrinks: z.array(FoodItemSchema).optional(),
    dislikedDrinks: z.array(FoodItemSchema).optional(),
  
    likedFunActivities: z.array(ActivityItemSchema).optional(),
    dislikedFunActivities: z.array(ActivityItemSchema).optional(),
    likedExerciseActivities: z.array(ActivityItemSchema).optional(),
    dislikedExerciseActivities: z.array(ActivityItemSchema).optional(),
    
    environments: z.array(EnvironmentItemSchema).optional(),
  });

/**
 * Saves user preferences to a JSON file in Google Cloud Storage.
 * This function merges new preferences with existing ones if the file already exists.
 * Non-preference related fields (like photoDataUri, generationType, imageUrls) are excluded.
 * The file is saved with public read access.
 *
 * @param {string} inviteCode - The invite code used as the directory name in GCS.
 * @param {object} preferences - An object containing user preference data.
 * @returns {Promise<void>} - A promise that resolves when the preferences are saved and made public.
 * @throws {HttpsError} - Throws HttpsError if inviteCode is missing.
 */
export async function savePreferences(inviteCode, preferences) {
    const bucket = getStorage().bucket();
    const filePath = `${inviteCode}/preferences.json`;
    const file = bucket.file(filePath);
  
    // Clean up non-preference data before saving
    const prefeferencesToSave = { ...preferences };
    delete prefeferencesToSave.photoDataUri;
    delete prefeferencesToSave.generationType;
    delete prefeferencesToSave.imageUrls; // We already store image URLs separately
  
    let existingPreferences = {};
    try {
      const [exists] = await file.exists();
      if (exists) {
        const contents = await file.download();
        existingPreferences = JSON.parse(contents.toString());
      }
    } catch (e) {
        logger.warn(`Could not read existing preferences for ${inviteCode}`, e);
    }
  
    const newPreferences = { ...existingPreferences, ...prefeferencesToSave };
  
    await file.save(JSON.stringify(newPreferences, null, 2), {
      metadata: {
        contentType: "application/json",
      },
    });
    await file.makePublic();
    logger.info(`Preferences saved to ${file.publicUrl()}`);
  }
  