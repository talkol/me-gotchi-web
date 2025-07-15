import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import OpenAI from "openai";
import {GenerationRequestSchema, savePreferences} from "./shared.js";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

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
export const generateAssetAppearanceExpressionsImp = onCall({timeoutSeconds: 300}, async (request) => {
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
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Create a square 1:1 image with transparent background and divide it into 9 equal squares. In each square put the face of the input character with a different varied facial expression. Top row: big happy smile, mouth closed, eyes open; bigger happier smile, mouth slightly open, eyes open; huge laugh, mouth open, eyes closed. Middle row: no smile, eyes looking top left; no smile, eyes looking straight; no smile, eyes looking bottom right. Bottom row: big sad frown, eyes open; huge angry frown, eyes open; huge frown crying, eyes closed and tears. Make sure all facial expressions are different. Do not put any separator lines between frames.`,
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
      return { assetUrl: finalUrl }; // Return the URL of the generated expressions asset
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
  