
"use server";

import { z } from "zod";
import { generateFoodAsset, generateActivitiesAsset, generateEnvironmentsAsset } from "@/ai/services";
import { isFirebaseEnabled, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Define schemas for reusable parts
const FoodItemSchema = z.object({
  name: z.string().max(11, "Max 11 characters.").optional(),
  addExplanation: z.boolean(),
  explanation: z.string().optional(),
});

const ActivityItemSchema = z.object({
  name: z.string().max(11, "Max 11 characters.").optional(),
  addExplanation: z.boolean(),
  explanation: z.string().optional(),
});

const EnvironmentItemSchema = z.object({
  explanation: z.string().optional(),
});

// Main server-side validation schema.
const OnboardingSchema = z.object({
  firstName: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().min(1, "First name is required.").max(11, "First name must be 11 characters or less.").optional()
  ),
  gender: z.preprocess(
    (val) => (val === null || val === "" ? undefined : val),
    z.enum(["male", "female"], { invalid_type_error: "Please select a gender." }).optional()
  ),
  age: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce.number().min(1, "Age must be at least 1.").max(120, "Age must be 120 or less.").optional()
  ),
  photo: z.preprocess(
    (val) => (val instanceof File && val.size > 0 ? val : undefined),
    z.instanceof(File)
      .refine((file) => file.size < 4 * 1024 * 1024, "Photo must be less than 4MB.")
      .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Only .jpg, .png, and .webp formats are supported.")
      .optional()
  ),

  likedFoods: z.array(FoodItemSchema).length(3),
  dislikedFoods: z.array(FoodItemSchema).length(3),
  likedDrinks: z.array(FoodItemSchema).length(2),
  dislikedDrinks: z.array(FoodItemSchema).length(1),

  likedFunActivities: z.array(ActivityItemSchema).length(3),
  dislikedFunActivities: z.array(ActivityItemSchema).length(2),
  likedExerciseActivities: z.array(ActivityItemSchema).length(2),
  dislikedExerciseActivities: z.array(ActivityItemSchema).length(1),
  
  environments: z.array(EnvironmentItemSchema).length(4),
  
  inviteCode: z.string().min(1, "Invite code is required."),
  step: z.coerce.number().min(1).max(5),
  imageUrl: z.string().optional(), // This now carries the BASE image URL after step 1
});

export type FormState = {
  status: "idle" | "success" | "error" | "generating";
  message: string;
  imageUrl?: string;
  validationErrors?: Record<string, any>;
};

// Helper function to parse array data from FormData
function parseArrayFromFormData<T>(formData: FormData, key: string, count: number, isEnvironment: boolean = false): T[] {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const item: Record<string, any> = {};
    if (isEnvironment) {
        const explanation = formData.get(`${key}.${i}.explanation`) as string | null;
        item.explanation = explanation || "";
    } else {
        const name = formData.get(`${key}.${i}.name`) as string | null;
        item.name = name || "";
        const addExplanation = formData.get(`${key}.${i}.addExplanation`) === 'on';
        item.addExplanation = addExplanation;
        const explanation = formData.get(`${key}.${i}.explanation`) as string | null;
        item.explanation = explanation || "";
    }
    arr.push(item);
  }
  return arr as T[];
}

export async function generateMeGotchiAsset(
  formData: FormData
): Promise<FormState> {
  
  const rawFormData = {
    firstName: formData.get("firstName"),
    gender: formData.get("gender"),
    age: formData.get("age"),
    photo: formData.get("photo"),
    inviteCode: formData.get("inviteCode"),
    step: formData.get("step"),
    imageUrl: formData.get("imageUrl"),
    likedFoods: parseArrayFromFormData(formData, 'likedFoods', 3),
    dislikedFoods: parseArrayFromFormData(formData, 'dislikedFoods', 3),
    likedDrinks: parseArrayFromFormData(formData, 'likedDrinks', 2),
    dislikedDrinks: parseArrayFromFormData(formData, 'dislikedDrinks', 1),
    likedFunActivities: parseArrayFromFormData(formData, 'likedFunActivities', 3),
    dislikedFunActivities: parseArrayFromFormData(formData, 'dislikedFunActivities', 2),
    likedExerciseActivities: parseArrayFromFormData(formData, 'likedExerciseActivities', 2),
    dislikedExerciseActivities: parseArrayFromFormData(formData, 'dislikedExerciseActivities', 1),
    environments: parseArrayFromFormData(formData, 'environments', 4, true),
  };
  
  const validationResult = OnboardingSchema.partial().safeParse(rawFormData);
  if (!validationResult.success) {
    const flatErrors = validationResult.error.flatten();
    const errorMessages = Object.entries(flatErrors.fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');

    const detailedMessage = `Server validation failed. Errors: ${errorMessages}`;
    console.error(detailedMessage, flatErrors.fieldErrors);

    return {
      status: "error",
      message: detailedMessage,
      validationErrors: flatErrors.fieldErrors,
    };
  }
  
  const { inviteCode, step, photo, imageUrl: baseImageUrl } = validationResult.data;
  if (!inviteCode || !step) {
      return { status: "error", message: "Invite code or step is missing."}
  }

  try {
    if (step === 1) {
      if (!photo || !(photo instanceof File)) {
        throw new Error("A photo must be provided in step 1.");
      }
      
      let finalUrl: string;
      if (isFirebaseEnabled && storage) {
        const storagePath = `${inviteCode}/face-atlas.png`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, photo, { contentType: photo.type });
        finalUrl = await getDownloadURL(storageRef);
      } else {
        const photoDataUri = `data:${photo.type};base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`;
        finalUrl = photoDataUri;
      }
      
      return { status: "success", message: "Step 1 complete!", imageUrl: finalUrl };
    }

    if (!baseImageUrl) {
      return { status: "error", message: "Base image from Step 1 is missing. Please complete Step 1 first." };
    }

    if (step === 2) {
      const result = await generateFoodAsset(baseImageUrl, inviteCode);
      return { status: "success", message: "Step 2 preview generated.", imageUrl: result.assetUrl };
    }

    if (step === 3) {
      const result = await generateActivitiesAsset(baseImageUrl, inviteCode);
      return { status: "success", message: "Step 3 preview generated.", imageUrl: result.assetUrl };
    }
    
    if (step === 4) {
      const result = await generateEnvironmentsAsset(baseImageUrl, inviteCode);
      return { status: "success", message: "Step 4 assets generated.", imageUrl: result.assetUrl };
    }

    return { status: 'error', message: 'Invalid step provided.' };

  } catch (error) {
    console.error(`Error in generateMeGotchiAsset (Step ${step}):`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      status: "error",
      message: `Action failed: ${errorMessage}`,
    };
  }
}
