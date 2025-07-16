import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {z} from "zod";

export const FoodItemSchema = z.object({
    name: z.string().max(11),
    addExplanation: z.boolean(),
    explanation: z.string().optional(),
  });
  
export const ActivityItemSchema = z.object({
    name: z.string().max(11),
    addExplanation: z.boolean(),
    explanation: z.string().optional(),
  });
  
export const EnvironmentItemSchema = z.object({
    explanation: z.string(),
  });
  
// Define a Zod schema for input validation
export const GenerationRequestSchema = z.object({
    inviteCode: z.string().min(1),
    photoDataUri: z.string().optional().nullable(),
    characterImageUrl: z.string().optional().nullable(),
    imageUrls: z.record(z.string()).optional(),
    
    // All form fields to be saved in preferences.json
    firstName: z.string().max(11).optional(),
    gender: z.enum(["male", "female"]).optional(),
    age: z.coerce.number().min(1).max(120).optional(),
    
    likedFoods: z.array(FoodItemSchema).optional(),
    dislikedFoods: z.array(FoodItemSchema).optional(),
    likedDrinks: z.array(FoodItemSchema).optional(),
    dislikedDrinks: z.array(FoodItemSchema).optional(),
  
    likedFunActivities: z.array(ActivityItemSchema).optional(),
    dislikedFunActivities: z.array(ActivityItemSchema).optional(),
    likedExerciseActivities: z.array(ActivityItemSchema).optional(),
    dislikedExerciseActivities: z.array(ActivityItemSchema).optional(),
    
    environmentNumber: z.number().min(1).max(4).optional(),
    environments: z.array(EnvironmentItemSchema).optional(),
  });

/**
 * Saves user preferences to a JSON file in Google Cloud Storage.
 * This function merges new preferences with existing ones if the file already exists.
 * Non-preference related fields (like photoDataUri, generationType, imageUrls) are excluded.
 * The file is saved with public read access.
 *
 * @param {string} inviteCode - The invite code used as the directory name in GCS.
 * @param {object} preferences - An object containing user preference data.
 * @returns {Promise<void>} - A promise that resolves when the preferences are saved and made public.
 * @throws {HttpsError} - Throws HttpsError if inviteCode is missing.
 */
export async function savePreferences(inviteCode, preferences) {
    const bucket = getStorage().bucket();
    const filePath = `${inviteCode}/preferences.json`;
    const file = bucket.file(filePath);
  
    // Clean up non-preference data before saving
    const prefeferencesToSave = { ...preferences };
    delete prefeferencesToSave.photoDataUri;
    delete prefeferencesToSave.environmentNumber;
    delete prefeferencesToSave.generationType;
    delete prefeferencesToSave.imageUrls; // We already store image URLs separately
  
    let existingPreferences = {};
    try {
      const [exists] = await file.exists();
      if (exists) {
        const contents = await file.download();
        existingPreferences = JSON.parse(contents.toString());
      }
    } catch (e) {
        logger.warn(`Could not read existing preferences for ${inviteCode}`, e);
    }
  
    const newPreferences = { ...existingPreferences, ...prefeferencesToSave };
  
    await file.save(JSON.stringify(newPreferences, null, 2), {
      metadata: {
        contentType: "application/json",
      },
    });
    await file.makePublic();
    logger.info(`Preferences saved to ${file.publicUrl()}`);

    // Now create data.json based on preferences.json
    const appConfigFilePath = `${inviteCode}/data.json`;
    const appConfigFile = bucket.file(appConfigFilePath);
    const appConfig = createAppConfigFromPreferences(newPreferences);

    await appConfigFile.save(JSON.stringify(appConfig, null, 2), {
      metadata: {
        contentType: "application/json",
      },
    });
    await appConfigFile.makePublic();
    logger.info(`App config saved to ${appConfigFile.publicUrl()}`);
  }
  
  function createAppConfigFromPreferences(preferences) {
    const res = {};
    res.food = [
      {
        name: preferences.likedFoods[0].name.toUpperCase(),
        type: "food",
        like: true,
      },
      {
        name: preferences.likedFoods[1].name.toUpperCase(),
        type: "food",
        like: true,
      },
      {
        name: preferences.likedFoods[2].name.toUpperCase(),
        type: "food",
        like: true,
      },
      {
        name: preferences.dislikedFoods[0].name.toUpperCase(),
        type: "food",
        like: false,
      },
      {
        name: preferences.dislikedFoods[1].name.toUpperCase(),
        type: "food",
        like: false,
      },
      {
        name: preferences.dislikedFoods[2].name.toUpperCase(),
        type: "food",
        like: false,
      },
      {
        name: preferences.likedDrinks[0].name.toUpperCase(),
        type: "drink",
        like: true,
      },
      {
        name: preferences.likedDrinks[1].name.toUpperCase(),
        type: "drink",
        like: true,
      },
      {
        name: preferences.dislikedDrinks[0].name.toUpperCase(),
        type: "drink",
        like: false,
      },
    ];
    res.activities = [
      {
        name: preferences.likedFunActivities[0].name.toUpperCase(),
        type: "fun",
        like: true,
      },
      {
        name: preferences.likedFunActivities[1].name.toUpperCase(),
        type: "fun",
        like: true,
      },
      {
        name: preferences.likedFunActivities[2].name.toUpperCase(),
        type: "fun",
        like: true,
      },
      {
        name: preferences.dislikedFunActivities[0].name.toUpperCase(),
        type: "fun",
        like: false,
      },
      {
        name: preferences.dislikedFunActivities[1].name.toUpperCase(),
        type: "fun",
        like: false,
      },
      {
        name: preferences.likedExerciseActivities[0].name.toUpperCase(),
        type: "exercise",
        like: true,
      },
      {
        name: preferences.likedExerciseActivities[1].name.toUpperCase(),
        type: "exercise",
        like: true,
      },
      {
        name: preferences.dislikedExerciseActivities[0].name.toUpperCase(),
        type: "exercise",
        like: false,
      },
      {
        name: "SLEEP",
        type: "sleep",
        like: true,
      },
    ];
    res.config = {
        "name": preferences.firstName.toUpperCase(),
        "favorite_color": preferences.favoriteColor,
        "favorite_color_light": colorApplyHslDelta(preferences.favoriteColor, 0, -25, +30),
        "food_bg_color": preferences.foodBackgroundColor,
        "food_bg_color_dark": colorApplyHslDelta(preferences.foodBackgroundColor, 0, -25, -30),
        "activities_bg_color": preferences.activitiesBackgroundColor,
        "activities_bg_color_dark": colorApplyHslDelta(preferences.activitiesBackgroundColor, 0, -25, -30),
        "day_seconds": 86400,
        "food_empty_seconds": 280000,
        "drink_empty_seconds": 130000,
        "fun_empty_seconds": 170000,
        "exercise_empty_seconds": 350000,
        "sleep_empty_seconds": 260000,
        "stamina_for_food": 4,
        "stamina_for_drink": 4,
        "stamina_for_fun": 4,
        "stamina_for_exercise": 6,
        "stamina_for_sleep": 0,
        "stamina_full_seconds": 60,
        "sleep_full_seconds": 300
    };
    return res;
  }

  function colorHexToHsl(hex) {
    // Convert HEX to RGB
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
  
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
  
    if(max === min){
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        case b: h = ((r - g) / d + 4); break;
      }
      h /= 6;
    }
  
    return [
      Math.round(h * 360),
      Math.round(s * 100),
      Math.round(l * 100)
    ];
  }
  
  function colorHslToHex(h, s, l) {
    s /= 100;
    l /= 100;
  
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
      Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  
    return "#" + [f(0), f(8), f(4)].map(x =>
      x.toString(16).padStart(2, '0')
    ).join('');
  }
  
  function colorApplyHslDelta(hexColor, deltaH, deltaS, deltaL) {
    let [h, s, l] = colorHexToHsl(hexColor);
    h = (h + deltaH + 360) % 360;
    s = Math.min(Math.max(s + deltaS, 0), 100);
    l = Math.min(Math.max(l + deltaL, 0), 100);
    return colorHslToHex(h, s, l);
  }