
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


async function generateAppearanceCharacterAsset(
  data) {
  if (!data.photoDataUri) {
    throw new HttpsError(
      "invalid-argument",
      "A photo is required to generate the character asset.",
    );
  }
  if (!data.inviteCode) {
    throw new HttpsError("invalid-argument", "Invite code is required.");
  }

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

  /////////////////////////////////////////////////////////////////
  // Gemini - NEVER EDIT CODE STARTING HERE!
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Create a game character based on the likeness of this boy.
Focus on the face and make an illustration. White background please.`,
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
  /////////////////////////////////////////////////////////////////

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
  return {assetUrl: finalUrl};
}


export const generateAssetAppearanceCharacter = onCall({timeoutSeconds: 300}, async (request) => {
  const validationResult = GenerationRequestSchema.safeParse(request.data);
  if (!validationResult.success) {
    logger.error("Validation failed", validationResult.error.flatten());
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a valid payload.",
      validationResult.error.flatten(),
    );
  }

  const data = validationResult.data;

  try {
    // Save preferences on every call
    await savePreferences(data.inviteCode, data);

    let result;
    // We can add logic here to call different generation functions based on `data.generationType`
    result = await generateAppearanceCharacterAsset(data);
    return result;
  } catch (error) {
    logger.error(`Error in generateAsset (Type: ${data.generationType}):`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "An unexpected error occurred during asset generation.",
    );
  }
});
