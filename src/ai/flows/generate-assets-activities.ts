'use server';

/**
 * @fileOverview An AI agent that generates personalized digital assets based on user input and uploaded photo.
 *
 * - generateAssetsActivities - A function that handles the asset generation process for activities.
 * - GenerateAssetsInput - The input type for the generateAssetsActivities function.
 * - GenerateAssetsOutput - The return type for the generateAssetsActivities function.
 */
import { ai } from '@/ai/genkit';
import { isFirebaseEnabled, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { z } from 'genkit';

const GenerateAssetsInputSchema = z.object({
  inviteCode: z.string(),
  baseImageUrl: z.string(),
  preferences: z.string().describe('The user preferences for the activities assets.'),
});
export type GenerateAssetsInput = z.infer<typeof GenerateAssetsInputSchema>;

const GenerateAssetsOutputSchema = z.object({
  assetUrl: z.string().describe('The URL of the generated asset.'),
});
export type GenerateAssetsOutput = z.infer<typeof GenerateAssetsOutputSchema>;

export async function generateAssetsActivities(input: GenerateAssetsInput): Promise<GenerateAssetsOutput> {
  return generateAssetsFlowActivities(input);
}

const generateAssetsPromptActivities = ai.definePrompt({
  name: 'generateAssetsPromptActivities',
  input: {schema: GenerateAssetsInputSchema},
  output: {schema: GenerateAssetsOutputSchema},
  prompt: `You are an AI assistant that generates personalized digital assets for the Me-Gotchi game.

  Based on the user's appearance (from the photo) and activity preferences, generate unique digital assets related to the user's liked and disliked activities. Focus on objects or scenes that represent these activities, styled to match the user's appearance.

  User Activity Preferences: {{{preferences}}}
 The user's base appearance is based on this image: {{media url=baseImageUrl}}
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


const generateAssetsFlowActivities = ai.defineFlow(
  {
    name: 'generateAssetsFlowActivities',
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async ({ inviteCode, baseImageUrl, preferences }) => {
    let step3AssetUrl: string;
    if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
      const baseImageRef = ref(storage, baseImageUrl);
      const blob = await getBlob(baseImageRef);
      const newPath = `${inviteCode}/activities-atlas.png`;
      const newRef = ref(storage, newPath);
      await uploadBytes(newRef, blob, { contentType: blob.type });
      step3AssetUrl = await getDownloadURL(newRef);
    } else {
      // In local mode or if Firebase is not enabled, just use the base image data URI
      step3AssetUrl = baseImageUrl;
    }
    return {assetUrl: step3AssetUrl};
  }
);
