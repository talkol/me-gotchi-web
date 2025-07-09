'use server';

/**
 * @fileOverview An AI agent that generates personalized digital assets based on user input and uploaded photo.
 *
 * - generateAssetsEnvironments - A function that handles the asset generation process.
 * - GenerateAssetsInput - The input type for the generateAssetsEnvironments function.
 * - GenerateAssetsOutput - The return type for the generateAssetsEnvironments function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { isFirebaseEnabled, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, getBlob } from "firebase/storage";
import { parseArrayFromFormData } from "@/app/actions"; // Assuming this helper is available

const GenerateAssetsInputSchema = z.object({
  inviteCode: z.string(),
  photoDataUri: z
    .string()
    .describe(
      "A photo of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  preferences: z.string().describe('The user preferences for the assets.'),
});
export type GenerateAssetsInput = z.infer<typeof GenerateAssetsInputSchema>;

const GenerateAssetsOutputSchema = z.object({
  assetUrl: z.string().describe('The URL of the generated asset.'),
});
export type GenerateAssetsOutput = z.infer<typeof GenerateAssetsOutputSchema>;

export async function generateAssetsEnvironments(input: GenerateAssetsInput): Promise<GenerateAssetsOutput> {
  return generateAssetsFlowActivities.run(input);
}

const generateAssetsPromptEnvironments = ai.definePrompt({
  name: 'generateAssetsPromptEnvironments',
  input: {schema: GenerateAssetsInputSchema},
  output: {schema: GenerateAssetsOutputSchema},
  prompt: `You are an AI assistant that generates personalized digital assets for the me-gotchi game.

  Based on the user's photo and preferences, generate a unique digital asset.

  User Preferences: {{{preferences}}}
  User Photo: {{media url=photoDataUri}}
  `,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const generateAssetsFlowEnvironments = ai.defineFlow(
  {
    name: 'generateAssetsFlowEnvironments',
    inputSchema: z.instanceof(FormData), // Accept FormData directly
    outputSchema: GenerateAssetsOutputSchema,
  },
  async input => {
    const inviteCode = input.get('inviteCode') as string;
    const baseImageUrl = input.get('imageUrl') as string;

    if (!inviteCode || !baseImageUrl) {
        throw new Error("Invite code or base image URL is missing.");
    }

    let step3AssetUrl: string;
    if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
        const baseImageRef = ref(storage, baseImageUrl);
        const blob = await getBlob(baseImageRef);
        const newPath = `${inviteCode}/activities-atlas.png`;
        const newRef = ref(storage, newPath);
        await uploadBytes(newRef, blob, { contentType: blob.type });
        step3AssetUrl = await getDownloadURL(newRef);
    } else {
        step3AssetUrl = baseImageUrl; // In local mode, just return the same data URI.
    }
    return { assetUrl: step3AssetUrl };
  }
);