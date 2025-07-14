import {initializeApp} from "firebase-admin/app";
import {generateAssetAppearanceCharacterImp} from "./generateAssetAppearanceCharacter.js";
import {generateAssetAppearanceExpressionsImp} from "./generateAssetAppearanceExpressions.js";

// Initialize Firebase Admin SDK
initializeApp();

export const generateAssetAppearanceCharacter = generateAssetAppearanceCharacterImp;
export const generateAssetAppearanceExpressions = generateAssetAppearanceExpressionsImp;
