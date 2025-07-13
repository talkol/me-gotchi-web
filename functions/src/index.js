
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


// Define a Zod schema for input validation
const GenerationRequestSchema = z.object({
  generationType: z.string(),
  inviteCode: z.string().min(1),
  photoDataUri: z.string().optional(),
  imageUrls: z.record(z.string()).optional(),
  // We can add other fields from the form as needed
});

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

  const imageData = response.tool_outputs
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

  const storagePath = `${data.inviteCode}/character.png`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType: "image/png",
    },
  });

  const [finalUrl] = await file.getSignedUrl({
    action: "read",
    expires: "03-09-2491", // Far-future expiration date
  });

  logger.info("finalUrl: ", finalUrl);
  return {assetUrl: finalUrl};
}


export const generateAssetAppearanceCharacter = onCall({timeoutSeconds: 300}, async (request) => {
  const validationResult = GenerationRequestSchema.safeParse(request.data);
  if (!validationResult.success) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a valid payload.",
      validationResult.error.flatten(),
    );
  }

  const data = validationResult.data;

  try {
    let result;

    result = await generateAppearanceCharacterAsset(data);
    return result;  } catch (error) {
    logger.error(`Error in generateAsset (Type: character):`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "An unexpected error occurred during asset generation.",
    );
  }
});

