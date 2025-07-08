import { config } from 'dotenv';
config();

import '@/ai/flows/generate-assets.ts';
import '@/ai/flows/validate-openai-api-key.ts';