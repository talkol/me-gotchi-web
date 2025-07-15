import {initializeApp} from "firebase-admin/app";
import {generateAssetAppearanceCharacterImp} from "./generateAssetAppearanceCharacter.js";
import {generateAssetAppearanceExpressionsImp} from "./generateAssetAppearanceExpressions.js";
import {generateAssetFoodIconsImp} from "./generateAssetFoodIcons.js";
import { generateAssetActivitiesIconsImp } from "./generateAssetActivitiesIcons.js";

// Initialize Firebase Admin SDK
initializeApp();

export const generateAssetAppearanceCharacter = generateAssetAppearanceCharacterImp;
export const generateAssetAppearanceExpressions = generateAssetAppearanceExpressionsImp;
export const generateAssetFoodIcons = generateAssetFoodIconsImp;
export const generateAssetActivitiesIcons = generateAssetActivitiesIconsImp;