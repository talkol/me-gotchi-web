
'use server';

import type { OnboardingData } from '@/app/actions';
import { isFirebaseEnabled, storage } from '@/lib/firebase';
import { getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

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
  
  let finalUrl: string;
  if (isFirebaseEnabled && storage) {
    const storagePath = `${data.inviteCode}/face-atlas.png`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, data.photo, { contentType: data.photo.type });
    finalUrl = await getDownloadURL(storageRef);
  } else {
    finalUrl = `data:${
      data.photo.type
    };base64,${Buffer.from(await data.photo.arrayBuffer()).toString(
      'base64'
    )}`;
  }
  return { assetUrl: finalUrl };
}

export async function generateAppearanceExpressionsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'expressions.png');
  return { assetUrl };
}

export async function generateAppearanceRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'character-no-bg.png');
  return { assetUrl };
}


// Step 2: Food
export async function generateFoodIconsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'food-icons.png');
  return { assetUrl };
}

export async function generateFoodRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'food-no-bg.png');
  return { assetUrl };
}


// Step 3: Activities
export async function generateActivitiesIconsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'activities-icons.png');
  return { assetUrl };
}

export async function generateActivitiesRemoveBgAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'activities-no-bg.png');
  return { assetUrl };
}


// Step 4: Environments
export async function generateEnvironments1Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'environment-1.png');
  return { assetUrl };
}

export async function generateEnvironments2Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'environment-2.png');
  return { assetUrl };
}

export async function generateEnvironments3Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'environment-3.png');
  return { assetUrl };
}

export async function generateEnvironments4Asset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) { throw new Error('A base image URL is required.'); }
  const assetUrl = await copyAsset(data.imageUrl, data.inviteCode!, 'environment-4.png');
  return { assetUrl };
}
