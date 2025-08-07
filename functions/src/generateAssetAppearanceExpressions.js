import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import OpenAI from "openai";
import {GenerationRequestSchema, savePreferences, validateInviteCode} from "./shared.js";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import {centerIconsInTiles} from "./pngUtils.js";

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
    if (!request.data.expressionsStyle) {
      throw new HttpsError(
        "invalid-argument",
        "The expressionsStyle is required to generate expressions.",
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
    logger.info("About to call OpenAI for expressions generation");

    const sharedPromptPrefix = `Create a square 1:1 image with transparent background and divide it into 9 equal square tiles (3x3 grid).`;

    // Define prompts for each style
    const kawaiiPrompt = `In each square reimagine the character from the attached image in a different expressive pose. Render the character in a highly detailed “Sticker Pop” art style inspired by Sanrio, LINE Friends, and modern kawaii design, with a polished, collectible feel.
Style Guidelines:
    * Use bold clean outlines, soft gradient shading, smooth curves
    * Preserve recognizable character features from the original image
    * Emphasize defining facial features such as nose or jawline
    * Use a head shape resembling the original character and a similar skin tone color
    * Make the expressions vivid and emotionally distinct, with blushing cheeks, and subtle highlights
    * When eyes are open, make them large and expressive, with a reflection on the eyeball`;

    const cartoonPrompt = `In each square reimagine the character from the attached image in a different expressive pose. Render the character in a cartoon caricature style that emphasizes and exaggerates their most recognizable features. This should be a playful, stylized reinterpretation that pushes proportions while still being clearly based on the original subject.
Style Guidelines:
    * Big expressive eyes, with exaggerated size or shape based on the original
    * Emphasize defining features such as eyebrows, lips, nose, ears, or jawline
    * Use a larger head-to-body ratio for charm and emotional readability
    * Hair should retain its original shape and volume, but can be stylized or exaggerated
    * Mouth and brows should shift dramatically between emotions to enhance readability
    * Use bold outlines, vibrant color palettes, and smooth cel shading

Artistic Details:
    * Use simple but polished cartoon rendering (think modern animated TV characters or stylized mobile game avatars)
    * Keep light source consistent with soft, cell-shaded shadows and highlights
    * Add blush, shine, or slight freckles to enhance personality
    * Clothing can be simplified but should retain basic patterns and color identity`;

    const semiRealisticPrompt = `In each tile put the exact face from the input image with a different facial expression. Notice that the input image is just an illustation and not a real person. The art style is stylized 2D illustration with detailed 3D-like shading and detailed facial features. Highly expressive face maintaining the same age as the original photo.`;

    const celShadedPrompt = `In each square put the face of the input character with a different varied facial expression. Render the character in a stylized 2D illustration with enhanced cel shading and slight realism. The image should remain charming and animated in feel, but incorporate just enough real-world detail to bring out personality and resemblance.
Maintain strong likeness to the source, preserving the character's:
    * Facial structure and features
    * Hairstyle and hair texture
    * Skin tone and expression

Use clean linework and layered cel shading, but with:
    * Softer transitions in shadow zones
    * More realistic lighting falloff, especially around cheeks, nose, and eyes
    * Slight gradient or tonal variation in skin and lips for natural warmth

Add subtle enhancements such as:
    * Defined but stylized eyelashes and irises
    * Gentle shine on eyes and lips
    * Very soft nose shading and cheek blush
    * Layered hair with suggestion of individual locks`;

    const sharedPromptSuffix = `
  
Content:
    - Top row:
      - Big smile with mouth closed, eyes open
      - Bigger happier smile with mouth slightly open, eyes open
      - Huge laugh with mouth open, eyes closed
    - Middle row:
      - No smile, eyes looking towards top-left, bored
      - No smile, eyes looking straight
      - No smile, eyes looking towards bottom-right, wondering
    - Bottom row:
      - Big sad frown, eyes open
      - Huge angry frown, eyes open
      - Huge frown crying, eyes closed and tears
    
    Make sure all facial expressions are different. Do not put any separator lines between tiles. Make sure the top of the head is fully visible in each tile and that there is no overlap between tiles. Background must be transparent. All tiles must be 1:1 squares.`

    // Select the appropriate prompt based on the expressions style
    let selectedPrompt = sharedPromptPrefix + "\n\n";
    switch (data.expressionsStyle) {
      case "Kawaii":
        selectedPrompt += kawaiiPrompt;
        break;
      case "Cartoon":
        selectedPrompt += cartoonPrompt;
        break;
      case "Cel-Shaded":
        selectedPrompt += celShadedPrompt;
        break;
      case "Semi-Realistic":
        selectedPrompt += semiRealisticPrompt;
        break;
      default:
        throw new HttpsError(
          "invalid-argument",
          "Unknown expressionsStyle given: " + data.expressionsStyle,
        );
    }
    selectedPrompt += "\n" + sharedPromptSuffix;

    // Gemini - NEVER EDIT CODE STARTING HERE!
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: selectedPrompt,
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

    // Apply centering algorithm to properly align expressions within their tiles
    logger.info("Applying icon centering algorithm to face expressions atlas");
    const centeredImageBuffer = await centerIconsInTiles(imageBuffer, 'faces');

    const storagePath = `${data.inviteCode}/face-atlas.png`;
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
  