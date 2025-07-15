import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import OpenAI from "openai";
import {GenerationRequestSchema, savePreferences} from "./shared.js";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

/**
 * Generates an environment background image based on description.
 * Saves the generated image to Google Cloud Storage and returns its public URL.
 * It also saves user preferences before the generation attempt.
 * This is a top-level callable Cloud Function.
 *
 * @param {object} data - The data payload from the client, validated by GenerationRequestSchema.
 * @param {string} data.inviteCode - The user's invite code.
 * @returns {Promise<{assetUrl: string}>} - A promise resolving with the public URL of the generated character asset.
 * @throws {HttpsError} - Throws HttpsError on validation, OpenAI, or storage errors.
 */
export const generateAssetEnvironmentImp = onCall({timeoutSeconds: 300}, async (request) => {
    if (!request.data.environmentNumber) {
      throw new HttpsError("invalid-argument", "environmentNumber is required.");
    }
    if (!request.data.environments[request.data.environmentNumber - 1]) {
      throw new HttpsError("invalid-argument", "environment[environmentNumber-1] is invalid.");
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
    const environment = data.environments[data.environmentNumber - 1].explanation;
    
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
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Create an illustation of: ${environment}. The illustration will serve as a background image for a video game. Don't include any characters.`,
            },
          ],
        },
      ],
      tools: [
        {
          type: "image_generation",
          output_format: "jpeg",
          size: "1536x1024",
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
    
    const storagePath = `${data.inviteCode}/background${data.environmentNumber}.jpg`;
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
  
    await file.save(imageBuffer, {
      metadata: {
        contentType: "image/jpeg",
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
  