'use server';

/**
 * @fileOverview An AI agent that generates personalized digital assets based on user input and uploaded photo for food preferences.
 *
 * - generateAssetsFood - A function that handles the asset generation process for food.
 * - GenerateAssetsInput - The input type for the generateAssetsFood function.
 * - GenerateAssetsOutput - The return type for the generateAssetsFood function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { isFirebaseEnabled, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';

const GenerateAssetsInputSchema = z.object({
  inviteCode: z.string(),
  baseImageUrl: z.string(), // URL or data URI of the base image from step 1
  preferences: z.string().describe('User food preferences for the assets.'),
});
type GenerateAssetsInput = z.infer<typeof GenerateAssetsInputSchema>;

const GenerateAssetsOutputSchema = z.object({
  assetUrl: z.string().describe('The URL of the generated asset.'),
});
export type GenerateAssetsOutput = z.infer<typeof GenerateAssetsOutputSchema>;

export async function generateAssetsFood(
  formData: FormData,
): Promise<GenerateAssetsOutput> {
  const rawInput = {
    inviteCode: formData.get('inviteCode'),
    baseImageUrl: formData.get('imageUrl'), // imageUrl from form is baseImageUrl
    preferences: formData.get('preferences'), // You'll need to add this to your form or derive it
  };

  // Validate input using the schema
  const validationResult = GenerateAssetsInputSchema.safeParse(rawInput);

  if (!validationResult.success) {
    console.error('Validation failed for generateAssetsFood:', validationResult.error);
    throw new Error('Invalid input for generating food assets.');
  }

  return generateAssetsFlowFood(validationResult.data);
}

const generateAssetsPromptFood = ai.definePrompt({
  name: 'generateAssetsPromptFood',
  input: {schema: GenerateAssetsInputSchema},
  output: {schema: GenerateAssetsOutputSchema},
  prompt: `You are an AI assistant that generates personalized digital assets for the me-gotchi game, specifically for food.\n\n  Based on the user's photo and their food preferences, generate a unique digital asset related to food.\n\n  User Food Preferences: {{{preferences}}}\n  User Photo: {{media url=photoDataUri}}\n  `,
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

const generateAssetsFlowFood = ai.defineFlow(
  {
    name: 'generateAssetsFlowFood',
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async input => {
    let step2AssetUrl: string;
    const { inviteCode, baseImageUrl, preferences } = input;

    if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
      const baseImageRef = ref(storage, baseImageUrl);
      const blob = await getBlob(baseImageRef);
      const newPath = `${inviteCode}/food-atlas.png`;
      const newRef = ref(storage, newPath);
      await uploadBytes(newRef, blob, { contentType: blob.type });
      step2AssetUrl = await getDownloadURL(newRef);
    } else {
      // In local mode, just return the same data URI.
      step2AssetUrl = baseImageUrl;
      console.warn('Firebase not enabled or base image is not a Firebase URL. Returning base image URL for step 2.');
      // TODO: In a real scenario, you would likely use the AI model here
      // const { media } = await ai.generate({...});
    }

    return { assetUrl: step2AssetUrl };
  },
);