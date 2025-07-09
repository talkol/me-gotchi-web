'use server';

/**
 * @fileOverview An AI agent that generates personalized digital assets for environments.
 *
 * - generateAssetsEnvironments - A function that handles the asset generation process.
 * - GenerateAssetsInput - The input type for the generateAssetsEnvironments function.
 * - GenerateAssetsOutput - The return type for the generateAssetsEnvironments function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { isFirebaseEnabled, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, getBlob } from "firebase/storage";

const GenerateAssetsInputSchema = z.object({
  inviteCode: z.string(),
  baseImageUrl: z
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
  return generateAssetsFlowEnvironments(input);
}

const generateAssetsPromptEnvironments = ai.definePrompt({
  name: 'generateAssetsPromptEnvironments',
  input: {schema: GenerateAssetsInputSchema},
  output: {schema: GenerateAssetsOutputSchema},
  prompt: `You are an AI assistant that generates personalized digital assets for the me-gotchi game.

  Based on the user's photo and preferences, generate a unique digital asset.

  User Preferences: {{{preferences}}}
  User Photo: {{media url=baseImageUrl}}
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
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async ({ inviteCode, baseImageUrl, preferences }) => {
    if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
        const baseImageRef = ref(storage, baseImageUrl);
        const blob = await getBlob(baseImageRef);
        
        let firstUrl: string | null = null;
        for (let i = 1; i <= 4; i++) {
            const newPath = `${inviteCode}/background${i}.png`;
            const newRef = ref(storage, newPath);
            await uploadBytes(newRef, blob, { contentType: 'image/png' });
            if (i === 1) {
                firstUrl = await getDownloadURL(newRef);
            }
        }
        if (!firstUrl) {
          throw new Error("Could not get URL for the first background image.");
        }
        return { assetUrl: firstUrl };
    } else {
        // In local mode, just return the same data URI.
        return { assetUrl: baseImageUrl };
    }
  }
);
