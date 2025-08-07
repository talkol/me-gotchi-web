import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import OpenAI from "openai";
import {GenerationRequestSchema, savePreferences, validateInviteCode} from "./shared.js";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import {centerIconsInTiles} from "./pngUtils.js";

function item(foodItem) {
  if (foodItem.addExplanation && foodItem.explanation) {
    return foodItem.explanation;
  } else {
    return foodItem.name;
  }
}

/**
 * Generates a list of food icons based on user input data.
 * Saves the generated image to Google Cloud Storage and returns its public URL.
 * It also saves user preferences before the generation attempt.
 * This is a top-level callable Cloud Function.
 *
 * @param {object} data - The data payload from the client, validated by GenerationRequestSchema.
 * @param {string} data.inviteCode - The user's invite code.
 * @returns {Promise<{assetUrl: string}>} - A promise resolving with the public URL of the generated character asset.
 * @throws {HttpsError} - Throws HttpsError on validation, OpenAI, or storage errors.
 */
export const generateAssetFoodIconsImp = onCall({timeoutSeconds: 300}, async (request) => {
    if (!request.data.likedFoods || request.data.likedFoods.length != 3) {
      throw new HttpsError(
        "invalid-argument",
        "likedFoods of len 3 is required to generate the food icons asset.",
      );
    }
    if (!request.data.dislikedFoods || request.data.dislikedFoods.length != 3) {
      throw new HttpsError(
        "invalid-argument",
        "dislikedFoods of len 3 is required to generate the food icons asset.",
      );
    }
    if (!request.data.likedDrinks || request.data.likedDrinks.length != 2) {
      throw new HttpsError(
        "invalid-argument",
        "likedDrinks of len 2 is required to generate the food icons asset.",
      );
    }
    if (!request.data.dislikedDrinks || request.data.dislikedDrinks.length != 1) {
      throw new HttpsError(
        "invalid-argument",
        "dislikedDrinks of len 1 is required to generate the food icons asset.",
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
    
    // Validate that the invite code exists
    await validateInviteCode(data.inviteCode);
    
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
              text: `Create a square 1:1 image with transparent background and divide it into 9 equal squares. In each square put an illustration for a game asset in the art style of Super Mario as an icon with simple transparent background (without any Mario characters). Top row: ${item(data.likedFoods[0])}; ${item(data.likedFoods[1])}; ${item(data.likedFoods[2])}. Middle row: ${item(data.dislikedFoods[0])}; ${item(data.dislikedFoods[1])}; ${item(data.dislikedFoods[2])}. Bottom row: ${item(data.likedDrinks[0])}; ${item(data.likedDrinks[1])}; ${item(data.dislikedDrinks[0])}.`,
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
    
    // Apply centering algorithm to properly align icons within their tiles
    logger.info("Applying icon centering algorithm to food atlas");
    const centeredImageBuffer = await centerIconsInTiles(imageBuffer, 'icons');
    
    const storagePath = `${data.inviteCode}/food-atlas.png`;
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
  
    await file.save(centeredImageBuffer, {
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
  