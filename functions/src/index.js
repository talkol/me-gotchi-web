
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
// Import defineString for parameter access
import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import {z} from "zod";

// Initialize Firebase Admin SDK
initializeApp();
const storage = getStorage();

const FoodItemSchema = z.object({
  name: z.string().max(11),
  addExplanation: z.boolean(),
  explanation: z.string(),
});
const ActivityItemSchema = z.object({
  name: z.string().max(11),
  addExplanation: z.boolean(),
  explanation: z.string(),
});
const EnvironmentItemSchema = z.object({
  explanation: z.string(),
});


// Define a Zod schema for input validation
const GenerationRequestSchema = z.object({
  generationType: z.string(),
  inviteCode: z.string().min(1),
  photoDataUri: z.string().optional(),
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

async function savePreferences(inviteCode, preferences) {
  const bucket = storage.bucket();
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

/**
 * Generates a character asset using OpenAI based on a provided photo.
 * Saves the generated image to Google Cloud Storage and returns its public URL.
 * It also saves user preferences before the generation attempt.
 * This is a top-level callable Cloud Function.
 *
 * @param {object} data - The data payload from the client, validated by GenerationRequestSchema.
 * @param {string} data.inviteCode - The user's invite code.
 * @param {string} data.photoDataUri - The base64 data URI of the user's photo.
 * @returns {Promise<{assetUrl: string}>} - A promise resolving with the public URL of the generated character asset.
 * @throws {HttpsError} - Throws HttpsError on validation, OpenAI, or storage errors.
 */
export const generateAssetAppearanceCharacter = onCall({timeoutSeconds: 300}, async (request) => {
  if (!request.data.photoDataUri) {
    throw new HttpsError(
      "invalid-argument",
      "A photo is required to generate the character asset.",
    );
  }
  if (!request.data.inviteCode) {
    throw new HttpsError("invalid-argument", "Invite code is required.");
  }

  const validationResult = GenerationRequestSchema.safeParse(request.data);
  if (!validationResult.success) {
    logger.error("Validation failed", validationResult.error.flatten());
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a valid payload.", validationResult.error.flatten());
  }
  const data = validationResult.data;
  
  // Define the OpenAI API key parameter
  const openAiApiKey = defineString('OPENAI_API_KEY');
  if (!openAiApiKey.value()) {
    throw new HttpsError('internal', 'OpenAI API key is not set.');
  }

  // Initialize OpenAI client with the defined parameter value
  const openai = new OpenAI({
    apiKey: openAiApiKey.value(),
  });
  logger.info("About to call OpenAI for character generation");

  // Gemini - NEVER EDIT CODE STARTING HERE!
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Create a game character based on the likeness of this boy. Focus on the face and make an illustration. White background please.`,
          },
          {
            type: "input_image",
            image_url: data.photoDataUri,
          },
        ],
      },
    ],
    tools: [
      {
        type: "image_generation",
        size: "1024x1536",
        quality: "high",
        moderation: "low",
      },
    ],
  });
  logger.info(
    "OpenAI Response (Character):",
    JSON.stringify(response, null, 2),
  );

  const imageData = response.output
    .filter((output) => output.type === "image_generation_call")
    .map((output) => output.result);


  if (imageData.length === 0 || !imageData[0]) {
    throw new HttpsError(
      "internal",
      "Failed to generate image or received no image data from OpenAI.",
    );
  }

  const generatedImageB64 = imageData[0];
  const imageBuffer = Buffer.from(generatedImageB64, "base64");
  // Gemini - NEVER EDIT CODE ENDING HERE!
  
  const storagePath = `${data.inviteCode}/character.png`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType: "image/png",
    },
  });

  await file.makePublic();
  const finalUrl = file.publicUrl();
  logger.info("finalUrl: ", finalUrl);

  try {
    // Save preferences on every call
    await savePreferences(data.inviteCode, data);
    return { assetUrl: finalUrl }; // Return the URL of the generated expressions asset
  } catch (error) { 
    logger.error(`Error in generateAppearanceCharacterAsset:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "An unexpected error occurred during asset generation.",
    );
  }
});

/**
 * Generates character expressions using OpenAI based on the generated character image.
 * Saves the generated images to Google Cloud Storage and returns their public URLs.
 * It also saves user preferences before the generation attempt.
 * This is a top-level callable Cloud Function.
 *
 * @param {object} data - The data payload from the client.
 * @param {string} data.inviteCode - The user's invite code.
 * @param {string} data.characterImageUrl - The URL of the previously generated character image.
 * @returns {Promise<{message: string}>} - A placeholder promise.
 * @throws {HttpsError} - Throws HttpsError on validation errors.
 */
export const generateAssetAppearanceExpressions = onCall({timeoutSeconds: 300}, async (request) => {
  if (!request.data.characterImageUrl) {
    throw new HttpsError(
      "invalid-argument",
      "The character image URL is required to generate expressions.",
    );
  }
  if (!request.data.inviteCode) {
    throw new HttpsError("invalid-argument", "Invite code is required.");
  }

  const validationResult = GenerationRequestSchema.safeParse(request.data);
  if (!validationResult.success) {
    logger.error("Validation failed", validationResult.error.flatten());
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a valid payload.", validationResult.error.flatten());
  }
  const data = validationResult.data;

  // Define the OpenAI API key parameter
  const openAiApiKey = defineString('OPENAI_API_KEY');
  if (!openAiApiKey.value()) {
    throw new HttpsError('internal', 'OpenAI API key is not set.');
  }

  // Initialize OpenAI client with the defined parameter value
  const openai = new OpenAI({
    apiKey: openAiApiKey.value(),
  });
  logger.info("About to call OpenAI for expressions generation");

  // Gemini - NEVER EDIT CODE STARTING HERE!
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Create a square 1:1 image with transparent background and divide it into 9 equal squares. In each square put this face of the character with a different varied facial expression. Top row: big happy smile mouth closed with eyes open; huge happy smile mouth closed with eyes open; huge laugh mouth open and eyes closed. Middle row: no smile with eyes looking top left; no smile with eyes looking straight; no smile with eyes looking bottom right. Bottom row: big sad frown with eyes open; huge angry frown with eyes open; huge frown crying with eyes closed and tears.`,
          },
          {
            type: "input_image",
            image_url: data.characterImageUrl,
          },
        ],
      },
    ],
    tools: [
      {
        type: "image_generation",
        size: "1024x1024",
        quality: "high",
        moderation: "low",
        background: "transparent",
      },
    ],
  });
  logger.info(
    "OpenAI Response (Expressions):",
    JSON.stringify(response, null, 2),
  );

  const imageData = response.output
    .filter((output) => output.type === "image_generation_call")
    .map((output) => output.result);


  if (imageData.length === 0 || !imageData[0]) {
    throw new HttpsError(
      "internal",
      "Failed to generate image or received no image data from OpenAI.",
    );
  }

  const generatedImageB64 = imageData[0];
  const imageBuffer = Buffer.from(generatedImageB64, "base64");
  // Gemini - NEVER EDIT CODE ENDING HERE!

  const storagePath = `${data.inviteCode}/face-atlas.png`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType: "image/png",
    },
  });

  await file.makePublic();
  const finalUrl = file.publicUrl();
  logger.info("finalUrl: ", finalUrl);
  
  try {
    // Save preferences on every call
    await savePreferences(data.inviteCode, data);
    return { assetUrl: finalUrl }; // Return the URL of the generated expressions asset
  } catch (error) { 
    logger.error(`Error in generateAppearanceExpressionsAsset:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "An unexpected error occurred during asset generation.",
    );
  }
});
