import { GoogleGenAI, Type } from "@google/genai";
import { type FormData, type ParsedOutput } from "../types";
import { SYSTEM_PROMPT } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd want to handle this more gracefully.
  // For this environment, we assume it's always available.
  console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Skema untuk output utama dari generator meta-prompt
const META_PROMPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'Ringkasan singkat proyek dan alasan pemilihan teknik.' },
    techniques: { type: Type.STRING, description: 'Daftar teknik prompting yang dipilih, dipisahkan koma.' },
    mainPrompt: { type: Type.STRING, description: 'Artefak utama yang dihasilkan (Prompt untuk Dokumen, Konstitusi untuk Agen, atau Project Brief untuk Aplikasi).' },
    variantA: { type: Type.STRING, description: 'Variasi prompt yang lebih konservatif atau aman.' },
    variantB: { type: Type.STRING, description: 'Variasi prompt yang lebih kreatif atau berani.' },
    uiSpec: { type: Type.STRING, description: 'Spesifikasi antarmuka dalam format stringified JSON. Harus sangat detail untuk tipe "application".' },
    checklist: { type: Type.STRING, description: 'Poin-poin validasi kualitas dan keamanan yang relevan dengan tugas.' },
    example: { type: Type.STRING, description: 'Contoh penggunaan atau hasil yang konkret dan relevan dengan tugas.' },
  },
  required: ['summary', 'techniques', 'mainPrompt', 'variantA', 'variantB', 'uiSpec', 'checklist', 'example'],
};


const buildUserPrompt = (formData: FormData): string => {
    const commonData = `
*   **risk_tolerance**: ${formData.risk_tolerance || 'sedang'}
*   **creativity_level**: ${formData.creativity_level || 'sedang'}
*   **tools_available**: [${Array.isArray(formData.tools_available) ? formData.tools_available.join(', ') : 'Tidak ada'}]
*   **language**: ${formData.language || 'id'}`;

    const taskType = formData.task_type || 'document';

    let taskSpecificData = '';

    if (taskType === 'document') {
        taskSpecificData = `
*   **goal**: ${formData.goal || 'Tidak ditentukan'}
*   **audience**: ${formData.audience || 'Tidak ditentukan'}
*   **context**: ${formData.context || 'Tidak ditentukan'}
*   **constraints**: ${formData.constraints || 'Tidak ditentukan'}
*   **need_citations**: ${formData.need_citations || false}`;
    } else if (taskType === 'agent') {
        taskSpecificData = `
*   **agent_goal**: ${formData.agent_goal || 'Tidak ditentukan'}
*   **agent_context**: ${formData.agent_context || 'Tidak ditentukan'}
*   **agent_triggers**: ${formData.agent_triggers || 'Tidak ditentukan'}
*   **agent_success_criteria**: ${formData.agent_success_criteria || 'Tidak ditentukan'}`;
    } else if (taskType === 'application') {
        taskSpecificData = `
*   **app_description**: ${formData.app_description || 'Tidak ditentukan'}
*   **app_features**: ${formData.app_features || 'Tidak ditentukan'}
*   **app_data_model**: ${formData.app_data_model || 'Tidak ditentukan'}
*   **app_tech_stack**: ${formData.app_tech_stack || 'Tidak ditentukan'}`;
    }

    return `
## MASUKAN PENGGUNA (berdasarkan formulir)

*   **task_type**: "${taskType}"
${taskSpecificData}
${commonData}

Silakan lanjutkan dan hasilkan objek JSON sesuai dengan peran dan aturan Anda.
`;
};


export const generateMetaPrompt = async (formData: FormData): Promise<ParsedOutput> => {
  const model = 'gemini-2.5-flash';
  
  const userPrompt = buildUserPrompt(formData);
  
  try {
    const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: META_PROMPT_SCHEMA,
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
        // With responseSchema, the API guarantees a valid JSON string.
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

// --- EXTRACTION LOGIC ---
const EXTRACTION_SCHEMAS = {
  document: {
    type: Type.OBJECT,
    properties: {
      goal: { type: Type.STRING, description: 'Tujuan utama atau sasaran dari dokumen yang akan dibuat.' },
      audience: { type: Type.STRING, description: 'Siapa target pembaca atau pengguna dokumen ini.' },
      context: { type: Type.STRING, description: 'Latar belakang, domain, atau konteks spesifik dari dokumen.' },
      constraints: { type: Type.STRING, description: 'Batasan, persyaratan format, atau hal-hal yang harus dihindari.' },
    },
    required: ['goal', 'audience', 'context', 'constraints'],
  },
  agent: {
    type: Type.OBJECT,
    properties: {
      agent_goal: { type: Type.STRING, description: 'Tujuan utama yang harus dicapai oleh agen.' },
      agent_context: { type: Type.STRING, description: 'Lingkungan operasional dan konteks kerja untuk agen.' },
      agent_triggers: { type: Type.STRING, description: 'Kejadian atau kondisi yang mengaktifkan agen.' },
      agent_success_criteria: { type: Type.STRING, description: 'Kriteria untuk menentukan apakah agen telah berhasil menyelesaikan tugasnya.' },
    },
    required: ['agent_goal', 'agent_context', 'agent_triggers', 'agent_success_criteria'],
  },
  application: {
    type: Type.OBJECT,
    properties: {
      app_description: { type: Type.STRING, description: 'Deskripsi singkat mengenai ide aplikasi.' },
      app_features: { type: Type.STRING, description: 'Daftar fitur-fitur inti dari aplikasi.' },
      app_data_model: { type: Type.STRING, description: 'Deskripsi sederhana dari objek data utama dan relasinya.' },
      app_tech_stack: { type: Type.STRING, description: 'Stack teknologi yang disarankan atau disebutkan dalam dokumen.' },
    },
    required: ['app_description', 'app_features', 'app_data_model', 'app_tech_stack'],
  },
};

const callExtractionAPI = async (userPrompt: string, systemInstruction: string, schema: any): Promise<any> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error("Extraction failed: Received an empty response from the API.");
        }

        return JSON.parse(responseText);

    } catch (error) {
        console.error("Error during extraction:", error);
        if (error instanceof Error && error.message.includes('API key')) {
             throw new Error('The API key is invalid. Please check your configuration.');
        }
        throw new Error("Gagal menganalisis input. Layanan AI mungkin mengalami masalah.");
    }
}


export const extractInfoFromDocument = async (documentText: string, taskType: 'document' | 'agent' | 'application'): Promise<Partial<FormData>> => {
    const schema = EXTRACTION_SCHEMAS[taskType];
    if (!schema) throw new Error(`Invalid task type for extraction: ${taskType}`);

    const systemInstruction = `Anda adalah ahli ekstraksi data. Tugas Anda adalah menganalisis dokumen yang diberikan pengguna dan mengekstrak informasi kunci berdasarkan skema JSON yang diperlukan. Dokumen ini adalah brief untuk tugas "${taskType}". Isi setiap kolom berdasarkan konten dokumen. Jika suatu informasi tidak ada secara eksplisit, biarkan kolom yang bersangkutan sebagai string kosong. Kembalikan HANYA objek JSON yang valid sesuai skema yang diberikan.`;

    const userPrompt = `
Berikut adalah konten dokumennya:
---
${documentText}
---
Silakan ekstrak informasi yang relevan dan berikan dalam format JSON yang diminta.
`;

    return callExtractionAPI(userPrompt, systemInstruction, schema);
};

export const extractInfoWithInstruction = async (documentText: string, instructionText: string, taskType: 'document' | 'agent' | 'application'): Promise<Partial<FormData>> => {
    const schema = EXTRACTION_SCHEMAS[taskType];
    if (!schema) throw new Error(`Invalid task type for extraction: ${taskType}`);

    const systemInstruction = `Anda adalah seorang analis proyek AI yang sangat canggih. Tugas Anda adalah mensintesis informasi dari DUA sumber untuk mengisi skema JSON yang diminta:
1.  **Instruksi Pengguna**: Ini adalah TUJUAN UTAMA atau FOKUS. Gunakan ini sebagai "lensa" untuk memandu analisis Anda terhadap dokumen.
2.  **Konten Dokumen**: Ini adalah SUMBER KEBENARAN untuk detail, konteks, batasan, dan informasi spesifik.

Prioritaskan tujuan dari **Instruksi Pengguna**, lalu ekstrak detail yang relevan dari **Konten Dokumen** untuk mengisi setiap kolom. Jika dokumen tidak mengandung detail untuk suatu kolom, gunakan inferensi cerdas berdasarkan instruksi, tetapi prioritaskan konten dokumen. Jika informasi tidak dapat ditemukan di kedua sumber, biarkan sebagai string kosong. Kembalikan HANYA objek JSON yang valid.`;

     const userPrompt = `
Berikut adalah instruksi dan konten dokumen dari pengguna untuk tugas tipe "${taskType}":

--- INSTRUKSI PENGGUNA (FOKUS UTAMA) ---
${instructionText}
---

--- KONTEN DOKUMEN (SUMBER DETAIL) ---
${documentText}
---

Silakan analisis kedua sumber ini dan isi informasi yang relevan dalam format JSON yang diminta.
`;

    return callExtractionAPI(userPrompt, systemInstruction, schema);
};

export const extractInfoFromIdea = async (ideaText: string, taskType: 'document' | 'agent' | 'application'): Promise<Partial<FormData>> => {
    const schema = EXTRACTION_SCHEMAS[taskType];
    if (!schema) throw new Error(`Invalid task type for extraction: ${taskType}`);

    const systemInstruction = `Anda adalah seorang analis proyek AI yang ahli dalam menginterpretasikan ide singkat. Tugas Anda adalah menganalisis ide atau instruksi yang diberikan pengguna dan mengembangkannya menjadi informasi terstruktur sesuai skema JSON yang diminta. Ide ini adalah brief untuk tugas "${taskType}". Lakukan inferensi cerdas untuk mengisi setiap kolom berdasarkan permintaan pengguna. Jika suatu informasi tidak dapat disimpulkan dari ide tersebut, biarkan kolom yang bersangkutan sebagai string kosong. Kembalikan HANYA objek JSON yang valid.`;

    const userPrompt = `
Berikut adalah ide/instruksi dari pengguna:
---
${ideaText}
---
Silakan analisis ide ini dan ekstrak/kembangkan informasinya ke dalam format JSON yang diminta.
`;
    
    return callExtractionAPI(userPrompt, systemInstruction, schema);
};
