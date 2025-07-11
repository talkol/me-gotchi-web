
'use server';

import type { OnboardingData, StepImageUrls } from '@/app/actions';
import { isFirebaseEnabled, storage } from '@/lib/firebase';
import { getBlob, getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function copyAsset(
  baseImageUrl: string,
  inviteCode: string,
  newFileName: string
): Promise<string> {
  if (!baseImageUrl) {
    throw new Error('Base image URL is required for this operation.');
  }
  if (!inviteCode) {
    throw new Error('Invite code is required.');
  }

  if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
    const baseImageRef = ref(storage, baseImageUrl);
    const blob = await getBlob(baseImageRef);
    const newPath = `${inviteCode}/${newFileName}`;
    const newRef = ref(storage, newPath);
    await uploadBytes(newRef, blob, { contentType: blob.type });
    return getDownloadURL(newRef);
  }
  return baseImageUrl; // Fallback for local mode
}

// Helper to convert a File to a Data URI
function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URI.'));
      }
    };
    reader.onerror = (error) => reject(error);
    // This will cause an error in server components, so we need a workaround
    // We will convert it to an ArrayBuffer and then to a Buffer and then to a data URI
    file.arrayBuffer().then(buffer => {
        const base64 = Buffer.from(buffer).toString('base64');
        const dataURI = `data:${file.type};base64,${base64}`;
        resolve(dataURI);
    }).catch(reject);
  });
}

// Step 1: Appearance
export async function generateAppearanceCharacterAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.photo) {
    throw new Error('A photo is required to generate the character asset.');
  }
  if (!data.inviteCode) {
    throw new Error('Invite code is required.');
  }

  const photoDataUri = await fileToDataURI(data.photo);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Create a game character based on the likeness of this boy. Focus on the face and make an illustration. White background please.' },
          {
            type: 'image_url',
            image_url: {
              url: photoDataUri,
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1234',
            type: 'tool',
            function: {
              name: 'image_generation',
              arguments: JSON.stringify({
                 size: '1024x1536'
              })
            }
          }
        ]
      }
    ],
    tool_choice: {
      type: 'function',
      function: { name: 'image_generation' }
    }
  });

  const message = response.choices[0].message;
  const toolCall = message.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== 'image_generation') {
      throw new Error('The model did not return an image generation request.');
  }

  const args = JSON.parse(toolCall.function.arguments);
  const revisedPrompt = args.prompt;
  const size = args.size;

  const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revisedPrompt,
      n: 1,
      size: size,
      response_format: 'b64_json',
  });

  const generatedImageB64 = imageResponse.data[0].b64_json;
  if (!generatedImageB64) {
      throw new Error('Failed to generate image or received no image data.');
  }

  const storagePath = `${data.inviteCode}/character.png`;
  const storageRef = ref(storage, storagePath);

  await uploadString(storageRef, generatedImageB64, 'base64', { contentType: 'image/png' });
  const finalUrl = await getDownloadURL(storageRef);
  
  return { assetUrl: finalUrl };
}

export async function generateAppearanceExpressionsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'expressions.png');
  return { assetUrl };
}

export async function generateAppearanceRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'character-no-bg.png');
  return { assetUrl };
}


// Step 2: Food
export async function generateFoodIconsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'food-icons.png');
  return { assetUrl };
}

export async function generateFoodRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.foodIcons) { throw new Error('Food icons asset is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.foodIcons, data.inviteCode!, 'food-no-bg.png');
  return { assetUrl };
}


// Step 3: Activities
export async function generateActivitiesIconsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'activities-icons.png');
  return { assetUrl };
}

export async function generateActivitiesRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.activitiesIcons) { throw new Error('Activity icons asset is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.activitiesIcons, data.inviteCode!, 'activities-no-bg.png');
  return { assetUrl };
}


// Step 4: Environments
export async function generateEnvironments1Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'environment-1.png');
  return { assetUrl };
}

export async function generateEnvironments2Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'environment-2.png');
  return { assetUrl };
}

export async function generateEnvironments3Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'environment-3.png');
  return { assetUrl };
}

export async function generateEnvironments4Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode!, 'environment-4.png');
  return { assetUrl };
}
