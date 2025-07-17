import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import OpenAI from "openai";
import {GenerationRequestSchema, savePreferences} from "./shared.js";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

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
export const generateAssetAppearanceCharacterImp = onCall({timeoutSeconds: 300}, async (request) => {
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
              text: `Create a game character based on the likeness of this photo. Focus on the face and make it recognizable as much as possible. The art style is stylized 2D illustration with detailed 3D-like shading and detailed facial features. Highly expressive face maintaining the same age as the original photo. The top of the character's head is visible and not cropped, the character is centered and looking forward directly at the camera, hands dropped to the sides. Zoom to focus on the face and chest only. White background.`,
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
          size: "1024x1024",
          quality: "high",
          moderation: "low",
        },
      ],
    });
  
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
    const bucket = getStorage().bucket();
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
      return { assetUrl: finalUrl, success: true }; // Return the URL of the generated expressions asset
    } catch (error) { 
      logger.error(`Error when saving preferences:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "An unexpected error occurred during asset generation.",
      );
    }
  });
  