"use server";

import { z } from "zod";
import { generateAssets } from "@/ai/flows/generate-assets";
import { storage } from "@/lib/firebase";
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


// Main server-side validation schema
const OnboardingSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(11, "First name must be 11 characters or less."),
  gender: z.enum(["male", "female"], { required_error: "Please select a gender." }),
  age: z.coerce.number().min(1, "Age must be at least 1.").max(120, "Age must be 120 or less."),
  photo: z
    .instanceof(File)
    .refine((file) => file.size > 0, "A photo is required.")
    .refine((file) => file.size < 4 * 1024 * 1024, "Photo must be less than 4MB.")
    .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Only .jpg, .png, and .webp formats are supported."),
  
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
});

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  imageUrl?: string;
  validationErrors?: Record<string, any>; // Changed to any for nested errors
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

// Helper to format preferences for the AI
function formatPreferencesForAI(data: z.infer<typeof OnboardingSchema>): string {
    let preferences = `User's name is ${data.firstName}, a ${data.age} year old ${data.gender}.\n\n`;

    const formatList = (title: string, items: { name?: string, explanation?: string }[]) => {
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
    
    const formatEnvList = (title: string, items: { explanation?: string }[]) => {
        const filteredItems = items.filter(item => item.explanation && item.explanation.trim());
        if (filteredItems.length === 0) return "";
        let listString = `${title}:\n`;
        filteredItems.forEach(item => {
            listString += `- ${item.explanation!.trim()}\n`;
        });
        return listString + '\n';
    }

    preferences += formatList(data.gender === 'male' ? "He likes to eat" : "She likes to eat", data.likedFoods);
    preferences += formatList(data.gender === 'male' ? "He dislikes eating" : "She dislikes eating", data.dislikedFoods);
    preferences += formatList(data.gender === 'male' ? "He likes to drink" : "She likes to drink", data.likedDrinks);
    preferences += formatList(data.gender === 'male' ? "He dislikes drinking" : "She dislikes drinking", data.dislikedDrinks);
    preferences += formatList(data.gender === 'male' ? "He enjoys these fun activities" : "She enjoys these fun activities", data.likedFunActivities);
    preferences += formatList(data.gender === 'male' ? "He dislikes these fun activities" : "She dislikes these fun activities", data.dislikedFunActivities);
    preferences += formatList(data.gender === 'male' ? "He likes these exercises" : "She likes these exercises", data.likedExerciseActivities);
    preferences += formatList(data.gender === 'male' ? "He dislikes this exercise" : "She dislikes this exercise", data.dislikedExerciseActivities);
    preferences += formatEnvList("He/She is often found in these environments", data.environments);
    
    return preferences;
}


export async function generateMeGotchiAsset(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawFormData = {
    firstName: formData.get("firstName"),
    gender: formData.get("gender"),
    age: formData.get("age"),
    photo: formData.get("photo"),
    inviteCode: formData.get("inviteCode"),
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

  const validationResult = OnboardingSchema.safeParse(rawFormData);
  
  if (!validationResult.success) {
    return {
      status: "error",
      message: "Validation failed on the server. Please check your inputs.",
      validationErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const { photo, inviteCode } = validationResult.data;
  const preferences = formatPreferencesForAI(validationResult.data);

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
    
    const imageResponse = await fetch(aiResult.assetUrl);
    if (!imageResponse.ok) {
        throw new Error("Failed to download the generated asset from AI provider.");
    }
    const imageBlob = await imageResponse.blob();

    const storagePath = `${inviteCode}/me-gotchi-asset.png`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, imageBlob, { contentType: 'image/png' });

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
