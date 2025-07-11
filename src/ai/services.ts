
'use server';

import type { OnboardingData } from '@/app/actions';
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
  if (!isFirebaseEnabled || !storage) {
    console.warn("Firebase not configured, returning base image URL.");
    return baseImageUrl;
  }
  if (!baseImageUrl) {
    throw new Error('Base image URL is required for this operation.');
  }
  if (!inviteCode) {
    throw new Error('Invite code is required.');
  }

  if (baseImageUrl.startsWith('https')) {
    try {
        const baseImageRef = ref(storage, baseImageUrl);
        const blob = await getBlob(baseImageRef);
        const newPath = `${inviteCode}/${newFileName}`;
        const newRef = ref(storage, newPath);
        await uploadBytes(newRef, blob, { contentType: blob.type });
        return getDownloadURL(newRef);
    } catch (error) {
        console.error("Failed to copy asset in Firebase", error);
        throw new Error("Could not copy the base asset for the next generation step.");
    }
  }
  // If it's not a Firebase URL, just return it (local mode fallback)
  return baseImageUrl;
}

// Helper to convert a File to a Data URI
function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // This server-side-friendly approach reads the file into an ArrayBuffer,
    // converts it to a Buffer, and then creates a Base64-encoded Data URI.
    file.arrayBuffer().then(buffer => {
        const base64 = Buffer.from(buffer).toString('base64');
        const dataURI = `data:${file.type};base64,${base64}`;
        resolve(dataURI);
    }).catch(reject);
  });
}

// Helper to convert a Blob to a Data URI
async function blobToDataURI(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${blob.type};base64,${base64}`;
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
  
  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
        {
            role: 'user',
            content: [
                { 
                  type: 'input_text', 
                  text: 'Create a game character based on the likeness of this boy. Focus on the face and make an illustration. White background please.',
                },
                {
                    type: 'input_image',
                    image_url: photoDataUri,
                },
            ],
        }
    ],
    tools: [{
        type: 'image_generation',
        quality: 'high',
        moderation: 'low',
        size: '1024x1024'
    }]
  });

  const imageData = response.output
    .filter((output): output is OpenAI.ImageGenerationCall => output.type === 'image_generation_call')
    .map((output) => output.result);

  if (imageData.length === 0 || !imageData[0]) {
      throw new Error('Failed to generate image or received no image data from OpenAI.');
  }
  
  const generatedImageB64 = imageData[0];
  
  if (!isFirebaseEnabled || !storage) {
    console.warn("Firebase not configured. Returning base64 data URI directly.");
    return { assetUrl: `data:image/png;base64,${generatedImageB64}` };
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
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  
  if (!isFirebaseEnabled || !storage) {
    throw new Error("Firebase must be configured to fetch the character image for expression generation.");
  }
  
  // 1. Fetch the character image from Firebase Storage
  const characterImageRef = ref(storage, data.imageUrls.character);
  const characterImageBlob = await getBlob(characterImageRef);
  const characterImageDataUri = await blobToDataURI(characterImageBlob);

  // 2. Call OpenAI API to generate expressions
  const prompt = "Create a square 1:1 image with transparent background and divide it into 9 equal squares. In each square put this face of the boy with a different varied facial expression. Top row: big happy smile mouth closed with eyes open; huge happy smile mouth closed with eyes open; huge laugh mouth open and eyes closed. Middle row: no smile with eyes looking top left; no smile with eyes looking straight; no smile with eyes looking bottom right. Bottom row: big sad frown with eyes open; huge angry frown with eyes open; huge frown crying with eyes closed and tears.";

  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: characterImageDataUri },
        ],
      },
    ],
    tools: [
      {
        type: 'image_generation',
        size: '1024x1024',
        quality: 'high',
        background: 'transparent',
        moderation: 'low',
      },
    ],
  });

  const imageData = response.output
    .filter((output): output is OpenAI.ImageGenerationCall => output.type === 'image_generation_call')
    .map((output) => output.result);
  
  if (imageData.length === 0 || !imageData[0]) {
    throw new Error('Failed to generate expressions image or received no image data from OpenAI.');
  }

  const generatedImageB64 = imageData[0];
  
  // 3. Upload the generated expressions image to Firebase Storage
  const storagePath = `${data.inviteCode}/expressions.png`;
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, generatedImageB64, 'base64', { contentType: 'image/png' });
  const finalUrl = await getDownloadURL(storageRef);

  return { assetUrl: finalUrl };
}

export async function generateAppearanceRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'character-no-bg.png');
  return { assetUrl };
}


// Step 2: Food
export async function generateFoodIconsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'food-icons.png');
  return { assetUrl };
}

export async function generateFoodRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.foodIcons) { throw new Error('Food icons asset is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.foodIcons, data.inviteCode, 'food-no-bg.png');
  return { assetUrl };
}


// Step 3: Activities
export async function generateActivitiesIconsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'activities-icons.png');
  return { assetUrl };
}

export async function generateActivitiesRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.activitiesIcons) { throw new Error('Activity icons asset is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.activitiesIcons, data.inviteCode, 'activities-no-bg.png');
  return { assetUrl };
}


// Step 4: Environments
export async function generateEnvironments1Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'environment-1.png');
  return { assetUrl };
}

export async function generateEnvironments2Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'environment-2.png');
  return { assetUrl };
}

export async function generateEnvironments3Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'environment-3.png');
  return { assetUrl };
}

export async function generateEnvironments4Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrls?.character) { throw new Error('A base character image is required.'); }
  if (!data.inviteCode) { throw new Error('Invite code is required.'); }
  const assetUrl = await copyAsset(data.imageUrls.character, data.inviteCode, 'environment-4.png');
  return { assetUrl };
}
