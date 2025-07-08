"use server";

import { z } from "zod";
import { generateAssets } from "@/ai/flows/generate-assets";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const OnboardingSchema = z.object({
  preferences: z.string().min(10, "Please describe your preferences in at least 10 characters.").max(500),
  photo: z
    .instanceof(File)
    .refine((file) => file.size > 0, "A photo is required.")
    .refine((file) => file.size < 4 * 1024 * 1024, "Photo must be less than 4MB.")
    .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Only .jpg, .png, and .webp formats are supported."),
  inviteCode: z.string().min(1, "Invite code is required."),
});

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  imageUrl?: string;
  validationErrors?: Record<string, string[] | undefined>;
};

export async function generateMeGotchiAsset(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawFormData = {
    preferences: formData.get("preferences"),
    photo: formData.get("photo"),
    inviteCode: formData.get("inviteCode"),
  };

  const validationResult = OnboardingSchema.safeParse(rawFormData);

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Please correct the errors below.",
      validationErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const { preferences, photo, inviteCode } = validationResult.data;

  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const photoDataUri = `data:${photo.type};base64,${buffer.toString("base64")}`;

    const aiResult = await generateAssets({
      preferences,
      photoDataUri,
    });

    if (!aiResult.assetUrl) {
      throw new Error("AI failed to generate an asset.");
    }

    // Fetch the generated image from the temporary URL
    const imageResponse = await fetch(aiResult.assetUrl);
    if (!imageResponse.ok) {
        throw new Error("Failed to download the generated asset from AI provider.");
    }
    const imageBlob = await imageResponse.blob();

    // Upload to Firebase Storage
    const storagePath = `${inviteCode}/me-gotchi-asset.png`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, imageBlob, { contentType: 'image/png' });

    // Get the public URL
    const finalUrl = await getDownloadURL(storageRef);

    return {
      status: "success",
      message: "Your Me-Gotchi has been created!",
      imageUrl: finalUrl,
    };
  } catch (error) {
    console.error("Error generating asset:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      status: "error",
      message: `Failed to create asset. ${errorMessage}`,
    };
  }
}
