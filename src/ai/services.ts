'use server';

import type { OnboardingData } from '@/app/actions';
import { isFirebaseEnabled, storage } from '@/lib/firebase';
import { getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

// --- Asset Generation Functions (Test Logic) ---

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

export async function generateAppearanceAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.photo) {
    throw new Error('A photo is required to generate the appearance asset.');
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

export async function generateFoodAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) {
    throw new Error('A base image URL is required.');
  }
  if (!data.inviteCode) {
    throw new Error('Invite code is required.');
  }
  const assetUrl = await copyAsset(
    data.imageUrl,
    data.inviteCode,
    'food-atlas.png'
  );
  return { assetUrl };
}

export async function generateActivitiesAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) {
    throw new Error('A base image URL is required.');
  }
  if (!data.inviteCode) {
    throw new Error('Invite code is required.');
  }
  const assetUrl = await copyAsset(
    data.imageUrl,
    data.inviteCode,
    'activities-atlas.png'
  );
  return { assetUrl };
}

export async function generateEnvironmentsAsset(
  data: OnboardingData
): Promise<{ assetUrl: string }> {
  if (!data.imageUrl) {
    throw new Error('A base image URL is required.');
  }
  if (!data.inviteCode) {
    throw new Error('Invite code is required.');
  }
  const assetUrl = await copyAsset(
    data.imageUrl,
    data.inviteCode,
    'environments-atlas.png'
  );
  return { assetUrl };
}
