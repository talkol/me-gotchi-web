
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {defineString} from 'firebase-functions/params';
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import {z} from "zod";

// Initialize Firebase Admin SDK
initializeApp();
const storage = getStorage();

// Define the OpenAI API key parameter.
// This value is set during deployment, not in the code.
const openAiApiKey = defineString('OPENAI_API_KEY');

// Define a Zod schema for input validation
const GenerationRequestSchema = z.object({
  generationType: z.string(),
  inviteCode: z.string().min(1),
  photoDataUri: z.string().optional(),
  imageUrls: z.record(z.string()).optional(),
});

async function generateAppearanceCharacterAsset(data: z.infer<typeof GenerationRequestSchema>) {
    if (!data.photoDataUri) {
        throw new HttpsError(
            "invalid-argument",
            "A photo is required to generate the character asset.",
        );
    }
    if (!data.inviteCode) {
        throw new HttpsError("invalid-argument", "Invite code is required.");
    }
    
    // Initialize OpenAI client with the defined parameter value
    const openai = new OpenAI({
        apiKey: openAiApiKey.value(),
    });

    logger.info("Calling OpenAI for character generation...");
    
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Create a game character based on the likeness of this boy. Focus on the face and make an illustration. White background please.`,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        // The user's photo is passed here, but DALL-E 3 doesn't directly use an 'image' parameter like this.
        // The model's understanding comes from the prompt. For future models (like GPT-4 Vision), this might change.
        // For now, we rely on the prompt's description. The `photoDataUri` is validated but not directly sent in the API call itself.
    });

    logger.info("OpenAI Response (Character):", JSON.stringify(response, null, 2));

    const generatedImageB64 = response.data[0]?.b64_json;

    if (!generatedImageB64) {
        throw new HttpsError(
            "internal",
            "Failed to generate image or received no image data from OpenAI.",
        );
    }

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

    logger.info("Character asset saved. URL:", finalUrl);
    return { assetUrl: finalUrl };
}

export const generateAsset = onCall({timeoutSeconds: 300}, async (request) => {
    // Check if the API key is configured
    if (!openAiApiKey.value()) {
        throw new HttpsError('failed-precondition', 'The OpenAI API key is not configured. Please deploy the function with the OPENAI_API_KEY secret.');
    }

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
        if (data.generationType === 'character') {
            result = await generateAppearanceCharacterAsset(data);
        } else {
            // Placeholder for other generation types
            throw new HttpsError("unimplemented", `Generation type '${data.generationType}' is not supported yet.`);
        }
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
