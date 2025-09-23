import { GoogleGenAI } from "@google/genai";
import { type FormData, type ParsedOutput } from "../types";
import { SYSTEM_PROMPT } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd want to handle this more gracefully.
  // For this environment, we assume it's always available.
  console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateMetaPrompt = async (formData: FormData): Promise<ParsedOutput> => {
  const model = 'gemini-2.5-flash';
  
  const userPrompt = `
    ## INPUT YANG AKAN DITERIMA (isi oleh pengguna/aplikasi)

    * **goal**: ${formData.goal || 'Tidak ditentukan'}
    * **audience**: ${formData.audience || 'Tidak ditentukan'}
    * **context**: ${formData.context || 'Tidak ditentukan'}
    * **constraints**: ${formData.constraints || 'Tidak ditentukan'}
    * **risk_tolerance**: ${formData.risk_tolerance || 'sedang'}
    * **need_citations**: ${formData.need_citations || false}
    * **creativity_level**: ${formData.creativity_level || 'sedang'}
    * **tools_available**: [${Array.isArray(formData.tools_available) ? formData.tools_available.join(', ') : 'Tidak ada'}]
    * **language**: ${formData.language || 'id'}

    Silakan lanjutkan.
  `;
  
  try {
    const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
        }
    });

    const responseText = response.text;
    if (!responseText) {
        const candidate = response.candidates?.[0];
        if (candidate) {
            const { finishReason, safetyRatings } = candidate;
            if (finishReason === 'SAFETY') {
                const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category.replace('HARM_CATEGORY_', '')).join(', ');
                throw new Error(`Request blocked for safety reasons. Blocked categories: ${blockedCategories || 'Unknown'}. Please adjust your input.`);
            }
            if (finishReason === 'RECITATION') {
                throw new Error("Request blocked due to potential recitation. The model's response would have been too similar to a source on the web. Please try a different prompt.");
            }
             if (finishReason === 'MAX_TOKENS') {
                throw new Error("The response was stopped because it reached the maximum token limit. Try asking for a shorter response.");
            }
            if (finishReason) {
                 throw new Error(`The request was stopped for the following reason: ${finishReason}. Please adjust your input and try again.`);
            }
        }
        throw new Error("Received an empty response from the API. This could be due to content filters or a lack of a specific answer from the model.");
    }
    
    try {
        // The API is now expected to return a valid JSON string.
        return JSON.parse(responseText) as ParsedOutput;
    } catch (e) {
        console.error("Failed to parse JSON response from API:", e);
        console.error("Raw response text:", responseText);
        throw new Error("The AI returned an invalid data structure. Please try again.");
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        // Re-throw the more specific errors from the try block
        if (error.message.startsWith('Request blocked') || error.message.startsWith('The response was stopped') || error.message.startsWith('Received an empty response') || error.message.startsWith('The AI returned an invalid data structure')) {
            throw error;
        }

        const message = error.message.toLowerCase();
        if (message.includes('api key not valid')) {
            throw new Error('The API key is invalid. Please ensure it is correctly configured in your environment.');
        }
        if (message.includes('429') || message.includes('resource exhausted')) {
            throw new Error('You have exceeded your request quota. Please wait a moment and try again.');
        }
        if (message.includes('500') || message.includes('internal error')) {
            throw new Error('The AI service encountered an internal error. Please try again later.');
        }
         if (message.includes('400') || message.includes('invalid argument')) {
            throw new Error('The request sent to the AI service was malformed. Please check the input.');
        }
        if(message.includes('fetch failed') || message.includes('network error')) {
            throw new Error('A network error occurred. Please check your internet connection and try again.');
        }
        
        throw new Error(`An API error occurred: ${error.message}`);
    }

    throw new Error("An unexpected error occurred while communicating with the API.");
  }
};