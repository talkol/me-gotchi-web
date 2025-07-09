
"use server";

import { z } from "zod";
import { generateAssets } from "@/ai/flows/generate-assets";
import { isFirebaseEnabled, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, getBlob } from "firebase/storage";

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

// Helper to format preferences for the AI, now handles partial data
function formatPreferencesForAI(data: Partial<z.infer<typeof OnboardingSchema>>): string {
    let preferences = ``;
    if(data.firstName && data.age && data.gender) {
        preferences += `User's name is ${data.firstName}, a ${data.age} year old ${data.gender}.\n\n`;
    }

    const formatList = (title: string, items?: { name?: string, explanation?: string }[]) => {
        if (!items) return "";
        const filteredItems = items.filter(item => (item.name && item.name.trim()) || (item.explanation && item.explanation.trim()));
        if (filteredItems.length === 0) return "";

        let listString = `${title}:\n`;
        filteredItems.forEach(item => {
            if (item.name && item.name.trim()) {
              listString += `- ${item.name.trim()}`;
              if (item.explanation && item.explanation.trim()) {
                  listString += `: ${item.explanation.trim()}`;
              }
              listString += '\n';
            }
        });
        return listString + '\n';
    };
    
    const formatEnvList = (title: string, items?: { explanation?: string }[]) => {
        if (!items) return "";
        const filteredItems = items.filter(item => item.explanation && item.explanation.trim());
        if (filteredItems.length === 0) return "";
        let listString = `${title}:\n`;
        filteredItems.forEach(item => {
            listString += `- ${item.explanation!.trim()}\n`;
        });
        return listString + '\n';
    }
    
    const gender = data.gender || 'male';

    preferences += formatList(gender === 'male' ? "He likes to eat" : "She likes to eat", data.likedFoods);
    preferences += formatList(gender === 'male' ? "He dislikes eating" : "She dislikes eating", data.dislikedFoods);
    preferences += formatList(gender === 'male' ? "He likes to drink" : "She likes to drink", data.likedDrinks);
    preferences += formatList(gender === 'male' ? "He dislikes drinking" : "She dislikes drinking", data.dislikedDrinks);
    preferences += formatList(gender === 'male' ? "He enjoys these fun activities" : "She enjoys these fun activities", data.likedFunActivities);
    preferences += formatList(gender === 'male' ? "He dislikes these fun activities" : "She dislikes these fun activities", data.dislikedFunActivities);
    preferences += formatList(gender === 'male' ? "He likes these exercises" : "She likes these exercises", data.likedExerciseActivities);
    preferences += formatList(gender === 'male' ? "He dislikes this exercise" : "She dislikes this exercise", data.dislikedExerciseActivities);
    preferences += formatEnvList("He/She is often found in these environments", data.environments);
    
    return preferences.trim() || "A generic character.";
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
      const photoDataUri = `data:${photo.type};base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`;
      
      let finalUrl: string;
      if (isFirebaseEnabled && storage) {
        const storagePath = `${inviteCode}/face-atlas.png`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, photo, { contentType: photo.type });
        finalUrl = await getDownloadURL(storageRef);
      } else {
        finalUrl = photoDataUri;
      }
      
      return { status: "success", message: "Step 1 complete!", imageUrl: finalUrl };
    }

    // For steps 2, 3, and 4, we use the base image uploaded in step 1.
    if (!baseImageUrl) {
      return { status: "error", message: "Base image from Step 1 is missing. Please complete Step 1 first." };
    }

    // Step 2: Test case - copy base image to a new location.
    if (step === 2) {
      let step2AssetUrl: string;
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
      }
      return { status: "success", message: "Step 2 preview generated.", imageUrl: step2AssetUrl };
    }

    // Step 3: Test case - copy base image to a new location.
    if (step === 3) {
      let step3AssetUrl: string;
      if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
          const baseImageRef = ref(storage, baseImageUrl);
          const blob = await getBlob(baseImageRef);
          const newPath = `${inviteCode}/activities-atlas.png`;
          const newRef = ref(storage, newPath);
          await uploadBytes(newRef, blob, { contentType: blob.type });
          step3AssetUrl = await getDownloadURL(newRef);
      } else {
          // In local mode, just return the same data URI.
          step3AssetUrl = baseImageUrl;
      }
      return { status: "success", message: "Step 3 preview generated.", imageUrl: step3AssetUrl };
    }
    
    // Step 4: Test case - copy base image to 4 new locations.
    if (step === 4) {
      let step4AssetUrl: string;
      if (isFirebaseEnabled && storage && baseImageUrl.startsWith('https')) {
          const baseImageRef = ref(storage, baseImageUrl);
          const blob = await getBlob(baseImageRef);
          
          let firstUrl: string | null = null;
          for (let i = 1; i <= 4; i++) {
              const newPath = `${inviteCode}/background${i}.png`;
              const newRef = ref(storage, newPath);
              await uploadBytes(newRef, blob, { contentType: 'image/png' });
              if (i === 1) {
                  firstUrl = await getDownloadURL(newRef);
              }
          }
          if (!firstUrl) {
            throw new Error("Could not get URL for the first background image.");
          }
           return { status: "success", message: "Step 4 assets generated.", imageUrl: firstUrl };
      } else {
          // In local mode, just return the same data URI.
          step4AssetUrl = baseImageUrl;
          return { status: "success", message: "Step 4 preview generated.", imageUrl: step4AssetUrl };
      }
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
