'use server';
 
import { isFirebaseEnabled, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import OpenAI from 'openai';

// --- Asset Generation Functions (Test Logic) ---

async function copyAsset(
  baseImageUrl: string,
  inviteCode: string,
  newFileName: string
): Promise<string> {
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

export async function generateAppearanceAsset(
  photo: File,
  inviteCode: string
): Promise<{ assetUrl: string }> {
  let finalUrl: string;
  if (isFirebaseEnabled && storage) {
    const storagePath = `${inviteCode}/face-atlas.png`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, photo, { contentType: photo.type });
    finalUrl = await getDownloadURL(storageRef);
  } else {
    finalUrl = `data:${photo.type};base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`;
  }
  return { assetUrl: finalUrl };
}
export async function generateFoodAsset(
  baseImageUrl: string,
  inviteCode: string
): Promise<{ assetUrl: string }> {
  const assetUrl = await copyAsset(baseImageUrl, inviteCode, 'food-atlas.png');
  return { assetUrl };
}

export async function generateActivitiesAsset(
  baseImageUrl: string,
  inviteCode: string
): Promise<{ assetUrl:string }> {
  const assetUrl = await copyAsset(baseImageUrl, inviteCode, 'activities-atlas.png');
  return { assetUrl };
}

export async function generateEnvironmentsAsset(
  baseImageUrl: string,
  inviteCode: string
): Promise<{ assetUrl:string }> {
   const assetUrl = await copyAsset(baseImageUrl, inviteCode, 'environments-atlas.png');
   return { assetUrl };
}

// --- OpenAI Specific Functions ---

export async function validateOpenAiApiKey(
  apiKey: string
): Promise<{ isValid: boolean; errorMessage?: string }> {
  if (!apiKey) {
    return { isValid: false, errorMessage: 'API key cannot be empty.' };
  }

  try {
    const openai = new OpenAI({ apiKey });
    await openai.models.list();
    return { isValid: true };
  } catch (error: any) {
    console.error('Error validating OpenAI API key:', error);
    let message = 'An error occurred while validating the API key.';
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        message = 'The provided OpenAI API key is invalid or has been revoked.';
      } else {
        message = `An API error occurred: ${error.message}`;
      }
    }
    return {
      isValid: false,
      errorMessage: message,
    };
  }
}
