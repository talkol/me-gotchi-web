import * as z from "zod";

import {
  generateText,
  GenerativeSession,
  GenerateTextResponse,
  ai,
} from "@genkit-ai/ai";
import { Flow, runFlow } from "@genkit-ai/flow";
import { isFirebaseEnabled, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Define the input schema for the appearance flow
const AppearanceFlowInputSchema = z.object({
  photo: z.any(), // File object
  inviteCode: z.string(),
  firstName: z.string().optional(),
  gender: z.string().optional(),
  age: z.number().optional(),
});

type AppearanceFlowInput = z.infer<typeof AppearanceFlowInputSchema>;

const AppearanceFlowOutputSchema = z.object({
  assetUrl: z.string().describe('The URL of the generated asset.'),
});

type AppearanceFlowOutput = z.infer<typeof AppearanceFlowOutputSchema>;

function formatAppearancePrompt(data: AppearanceFlowInput): string {
  let prompt = `Generate a unique digital asset for the me-gotchi game based on the following user information and photo:\n\n`;

  if (data.firstName) prompt += `First Name: ${data.firstName}\n`;
  if (data.gender) prompt += `Gender: ${data.gender}\n`;
  if (data.age) prompt += `Age: ${data.age}\n`;

  prompt += `\nGenerate a headshot or upper body image that captures the likeness of the person in the provided photo, incorporating elements suggested by their name, gender, and age if provided. Focus on generating a character suitable for a digital pet game.`;

  return prompt;
}

export const generateAssetsFlowAppearance = new Flow(
  "generateAssetsFlowAppearance",
  {
    inputSchema: AppearanceFlowInputSchema,
    outputSchema: AppearanceFlowOutputSchema,
  },
  async (input) => {
    if (!input.photo || !(input.photo instanceof File)) {
      throw new Error("Photo is required for appearance generation.");
    }

    const photoDataUri = `data:${input.photo.type};base64,${Buffer.from(await input.photo.arrayBuffer()).toString("base64")}`;

    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation', // Use the image generation model
      prompt: [
        { media: { url: photoDataUri } },
        { text: formatAppearancePrompt(input) },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
        throw new Error("Failed to generate image from AI.");
    }

    let finalUrl = media.url;

    // Upload to Firebase Storage if enabled
    if (isFirebaseEnabled && storage && input.inviteCode) {
      const storagePath = `${input.inviteCode}/face-atlas.png`;
      const storageRef = ref(storage, storagePath);
      const response = await fetch(media.url); // Fetch the generated image blob
      const blob = await response.blob();
      await uploadBytes(storageRef, blob, { contentType: blob.type });
      finalUrl = await getDownloadURL(storageRef);
    }

    return { assetUrl: finalUrl };
  }
);
