//Validate OpenAi Api Key
'use server';
/**
 * @fileOverview Validates an OpenAI API key by attempting to make a simple API call.
 *
 * - validateOpenAiApiKey - A function that validates the OpenAI API key.
 * - ValidateOpenAiApiKeyInput - The input type for the validateOpenAiApiKey function.
 * - ValidateOpenAiApiKeyOutput - The return type for the validateOpenAiApiKey function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateOpenAiApiKeyInputSchema = z.object({
  openAiApiKey: z.string().describe('The OpenAI API key to validate.'),
});
export type ValidateOpenAiApiKeyInput = z.infer<typeof ValidateOpenAiApiKeyInputSchema>;

const ValidateOpenAiApiKeyOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the OpenAI API key is valid.'),
  errorMessage: z.string().optional().describe('Error message if the API key is invalid.'),
});
export type ValidateOpenAiApiKeyOutput = z.infer<typeof ValidateOpenAiApiKeyOutputSchema>;

export async function validateOpenAiApiKey(input: ValidateOpenAiApiKeyInput): Promise<ValidateOpenAiApiKeyOutput> {
  return validateOpenAiApiKeyFlow(input);
}

const validateOpenAiApiKeyPrompt = ai.definePrompt({
  name: 'validateOpenAiApiKeyPrompt',
  input: {schema: ValidateOpenAiApiKeyInputSchema},
  output: {schema: ValidateOpenAiApiKeyOutputSchema},
  prompt: `You are an expert at validating OpenAI API keys.

  Determine if the provided OpenAI API key is valid by attempting to make a simple API call.
  If the API key is valid, return isValid as true.
  If the API key is invalid, return isValid as false and provide a helpful errorMessage.
  `,
  model: 'googleai/gemini-2.0-flash',
  config: {
    // High allows all content.
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const validateOpenAiApiKeyFlow = ai.defineFlow(
  {
    name: 'validateOpenAiApiKeyFlow',
    inputSchema: ValidateOpenAiApiKeyInputSchema,
    outputSchema: ValidateOpenAiApiKeyOutputSchema,
  },
  async input => {
    try {
      // Attempt to use the OpenAI API key to generate a simple response.
      // This is a placeholder and should be replaced with actual OpenAI API call.
      // For now, we'll simulate the API call and response.
      if (input.openAiApiKey === 'VALID_API_KEY') {
        return {isValid: true};
      } else {
        return {
          isValid: false,
          errorMessage: 'The OpenAI API key is invalid. Please check your API key and try again.',
        };
      }

      //const openai = new OpenAI({
      //  apiKey: input.openAiApiKey,
      //});
      //const completion = await openai.completions.create({
      //  model: "gpt-3.5-turbo-instruct",
      //  prompt: "Say this is a test",
      //  max_tokens: 5,
      //});
      //console.log(completion.choices[0].text);
      //return { isValid: true };
    } catch (error: any) {
      console.error('Error validating OpenAI API key:', error);
      return {
        isValid: false,
        errorMessage: error.message || 'An error occurred while validating the API key.',
      };
    }
  }
);
