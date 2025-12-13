import { GoogleGenAI, Type, Part } from "@google/genai";
import { type FormData, type ParsedOutput, type CodeAnalysisResult } from "../types";
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
    let contractData = '';

    // Check for contract file content in agent or application tasks
    if ((taskType === 'agent' || taskType === 'application') && formData.contract_file_content) {
        contractData = `
*   **contract_file_content**: 
\`\`\`
${formData.contract_file_content}
\`\`\`
*   **code_analysis_summary**: ${formData.code_analysis_summary || 'Tidak ada analisis.'}
`;
    }


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
*   **agent_success_criteria**: ${formData.agent_success_criteria || 'Tidak ditentukan'}
*   **agent_tools**: [${Array.isArray(formData.agent_tools) ? formData.agent_tools.join(', ') : 'Tidak ada'}]`;
    } else if (taskType === 'application') {
        taskSpecificData = `
*   **app_description**: ${formData.app_description || 'Tidak ditentukan'}
*   **app_features**: ${formData.app_features || 'Tidak ditentukan'}
*   **app_data_model**: ${formData.app_data_model || 'Tidak ditentukan'}
*   **app_tech_stack**: ${formData.app_tech_stack || 'Tidak ditentukan'}`;
    } else if (taskType === 'image') {
        taskSpecificData = `
*   **image_instruction**: ${formData.image_instruction || 'Tidak ditentukan'}
*   **editing_technique**: ${formData.editing_technique || 'Tidak ditentukan'}
*   **object_description**: ${formData.object_description || 'Tidak ditentukan'}
*   **style_reference**: ${formData.style_reference || 'Tidak ditentukan'}
*   **style_strength**: ${formData.style_strength || 'Tidak ditentukan'}
*   **color_adjustments**: [${Array.isArray(formData.color_adjustments) ? formData.color_adjustments.join(', ') : 'Tidak ada'}]
*   **controlnet_hint**: ${formData.controlnet_hint || 'Tidak ditentukan'}
*   **shot_type**: ${formData.shot_type || 'Tidak ditentukan'}
*   **aesthetic_boosters**: [${Array.isArray(formData.aesthetic_boosters) ? formData.aesthetic_boosters.join(', ') : 'Tidak ada'}]
*   **negative_prompt**: ${formData.negative_prompt || 'Tidak ditentukan'}`;
    }


    return `
## MASUKAN PENGGUNA (berdasarkan formulir)

*   **task_type**: "${taskType}"
${taskSpecificData}
${contractData}
${commonData}

Silakan lanjutkan dan hasilkan objek JSON sesuai dengan peran dan aturan Anda.
`;
};


export const generateMetaPrompt = async (formData: FormData): Promise<ParsedOutput> => {
  const model = 'gemini-2.5-flash';
  
  const userPrompt = buildUserPrompt(formData);
  
  const imageBase64 = formData.uploaded_image_base64 as string | undefined;
  const imageMimeType = formData.uploaded_image_mime_type as string | undefined;
  const taskType = formData.task_type;

  let requestPayload: string | { parts: Part[] };

  if (taskType === 'image' && imageBase64 && imageMimeType) {
      const imagePart = {
          inlineData: {
              mimeType: imageMimeType,
              data: imageBase64,
          },
      };
      const textPart = { text: userPrompt };
      requestPayload = { parts: [imagePart, textPart] };
  } else {
      requestPayload = userPrompt; // Fallback for other task types
  }
  
  try {
    const response = await ai.models.generateContent({
        model,
        contents: requestPayload,
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


// --- NEW: CODE ANALYSIS LOGIC ---
// FIX: Define a max length for extraction/analysis to prevent token errors on large files.
const MAX_ANALYSIS_LENGTH = 50000;

const CODE_ANALYSIS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: 'Ringkasan singkat dalam 1-2 kalimat tentang tujuan utama kode.' },
        functions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Daftar nama fungsi, metode, atau endpoint yang terdeteksi.' },
        classes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Daftar nama kelas atau kontrak utama.' },
        events: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Daftar nama event yang didefinisikan (relevan untuk smart contract).' },
        dataStructures: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Daftar nama struct, tipe data kustom, atau objek data penting.' },
    },
    required: ['summary', 'functions', 'classes'],
};

export const analyzeCode = async (codeContent: string): Promise<CodeAnalysisResult> => {
    const systemInstruction = `Anda adalah seorang Senior Software Engineer yang ahli dalam analisis kode statis. Tugas Anda adalah membaca potongan kode yang diberikan, mengidentifikasi komponen-komponen utamanya, dan mengembalikannya dalam format JSON yang ketat sesuai dengan skema yang diberikan. Fokus pada ekstraksi nama fungsi, kelas, event, dan struktur data. Berikan ringkasan singkat tentang fungsionalitas keseluruhan kode. Jangan mengeksekusi atau men-debug kode.`;

    const truncatedCodeContent = codeContent.length > MAX_ANALYSIS_LENGTH 
        ? codeContent.substring(0, MAX_ANALYSIS_LENGTH) + "\n\n//... [KODE DIPOTONG UNTUK ANALISIS] ..." 
        : codeContent;

    const userPrompt = `
Berikut adalah file kode untuk dianalisis:
\`\`\`
${truncatedCodeContent}
\`\`\`
Silakan analisis dan ekstrak informasi yang relevan sesuai peran Anda.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for code analysis
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: CODE_ANALYSIS_SCHEMA,
            },
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error("Analisis kode gagal: Menerima respons kosong dari API.");
        }

        return JSON.parse(responseText) as CodeAnalysisResult;

    } catch (error) {
        console.error("Error during code analysis:", error);
        throw new Error("Gagal menganalisis file kode. Layanan AI mungkin mengalami masalah atau kodenya terlalu kompleks.");
    }
}


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
      agent_tools: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["web_search", "calculator", "code_interpreter", "function_calling"] }, description: 'Daftar alat yang dibutuhkan agen yang disebutkan dalam teks.' },
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
   image: {
    type: Type.OBJECT,
    properties: {
      image_instruction: { type: Type.STRING, description: 'Salin instruksi pengguna yang asli dan lengkap ke dalam bidang ini.' },
      editing_technique: {
        type: Type.STRING,
        description: "Analisis instruksi dan REKOMENDASIKAN teknik yang paling sesuai. Contoh: jika 'hapus orang', pilih 'inpainting'. Jika 'buat seperti lukisan', pilih 'style_transfer'.",
        enum: ["none", "inpainting", "style_transfer", "color_adjustment", "controlnet"]
      },
      object_description: { type: Type.STRING, description: "Jika tekniknya 'inpainting', jelaskan objek yang akan ditambah/dihapus berdasarkan instruksi. Contoh: 'topi santa di atas kepala anjing'." },
      style_reference: { type: Type.STRING, description: "Jika instruksi menyiratkan gaya tertentu (misal: 'vintage', 'kartun'), REKOMENDASIKAN referensi gaya yang spesifik. Contoh: 'gaya lukisan Van Gogh', 'fotografi film vintage'." },
      style_strength: {
        type: Type.STRING,
        description: "Berdasarkan instruksi, REKOMENDASIKAN kekuatan gaya yang paling sesuai. Jika tidak jelas, default ke 'sedang'.",
        enum: ["halus", "sedang", "kuat"]
      },
      color_adjustments: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
          enum: ["tingkatkan_kecerahan", "tambah_kontras", "buat_lebih_hangat", "buat_lebih_dingin", "jadikan_hitam_putih", "efek_sepia"]
        },
        description: "Berdasarkan niat pengguna (misal: 'buat lebih cerah', 'buat terlihat tua'), REKOMENDASIKAN satu atau lebih penyesuaian warna yang relevan."
      },
      controlnet_hint: {
        type: Type.STRING,
        description: "Jika pengguna ingin mempertahankan pose atau struktur, REKOMENDASIKAN petunjuk yang sesuai.",
        enum: ["pose", "canny_edge", "depth_map", "scribble"]
      },
      shot_type: {
        type: Type.STRING,
        description: "Jika instruksi menyiratkan sudut kamera, REKOMENDASIKAN jenis bidikan. Jika tidak, biarkan 'none'.",
        enum: ["none", "close_up", "medium_shot", "wide_shot", "drone_view", "macro_shot"]
      },
      aesthetic_boosters: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
          enum: ["photorealistic", "cinematic_lighting", "hyperdetailed", "8k_resolution"]
        },
        description: "Berdasarkan keinginan kualitas pengguna (misal: 'buat terlihat nyata', 'detail tajam'), REKOMENDASIKAN peningkat estetika yang sesuai."
      },
      negative_prompt: { type: Type.STRING, description: "REKOMENDASIKAN elemen umum yang harus dihindari untuk meningkatkan kualitas, seperti 'teks, watermark, buram, cacat', dan tambahkan elemen yang secara eksplisit diminta pengguna untuk dihindari." }
    },
    required: ['image_instruction'],
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

// --- TASK TYPE DETECTION ---
const TASK_TYPE_DETECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detected_task_type: {
      type: Type.STRING,
      description: 'The most likely task type based on the input text. Must be one of "document", "agent", "application", or "image".',
      enum: ['document', 'agent', 'application', 'image'],
    },
  },
  required: ['detected_task_type'],
};

export const detectTaskType = async (text: string): Promise<'document' | 'agent' | 'application' | 'image'> => {
  const systemInstruction = `
You are an expert project analyst. Your task is to analyze the user's input (a document or an instruction) and classify it into one of four categories: "document", "agent", "application", or "image".

Here are the definitions:
- **document**: Choose this if the user wants to create written content like an article, a report, a Standard Operating Procedure (SOP), research, or any text-based output. Keywords: "write", "summarize", "report", "SOP", "article", "brief".
- **agent**: Choose this for designing an autonomous AI workflow. The user will describe a multi-step process that an AI should perform. This can include analyzing code like a smart contract to define the agent's tasks. Keywords: "automate", "process", "workflow", "trigger", "monitor", "agent", "Solidity", "smart contract".
- **application**: Choose this for creating a software prototype. The user will describe an app idea with features, user stories, or technical components. This can include analyzing code like a smart contract to define the DApp's features. Keywords: "app", "website", "feature", "UI", "database", "API", "DApp".
- **image**: Choose this if the user's instruction is clearly about modifying, editing, or changing a visual image. Keywords: "edit photo", "change background", "make it look like", "add to the picture", "remove from image".


Analyze the provided text and return ONLY a valid JSON object with the most appropriate category in the 'detected_task_type' field.
`;
  // FIX: Truncate the input text to a reasonable length to avoid exceeding the model's token limit for this simple classification task.
  // 8000 characters is a safe limit that should contain enough information for classification without being excessive.
  const MAX_LENGTH = 8000;
  const truncatedText = text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) + "..." : text;

  const userPrompt = `
Please analyze the following text and determine the task type.

--- TEXT ---
${truncatedText}
---
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: TASK_TYPE_DETECTION_SCHEMA,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Task type detection failed: Received an empty response.");
    }

    const parsed = JSON.parse(responseText);
    return parsed.detected_task_type;
  } catch (error) {
    console.error("Error during task type detection:", error);
    throw new Error("Gagal mendeteksi jenis tugas secara otomatis.");
  }
};


// --- NEW: PREFERENCES DETECTION ---
const PREFERENCES_DETECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: {
      type: Type.STRING,
      description: 'The detected language of the text. Default to "id".',
      enum: ['id', 'en'],
    },
    need_citations: {
      type: Type.BOOLEAN,
      description: 'Set to true if the text is academic, research-based, or mentions needing sources or verification.',
    },
    creativity_level: {
      type: Type.STRING,
      description: 'Infer the desired creativity level. "tinggi" for artistic/brainstorming tasks, "rendah" for factual/technical tasks, "sedang" otherwise.',
      enum: ['rendah', 'sedang', 'tinggi'],
    },
    risk_tolerance: {
      type: Type.STRING,
      description: 'Infer the risk tolerance. "rendah" for sensitive topics (legal, financial, medical, smart contracts), "tinggi" for creative exploration, "sedang" otherwise.',
      enum: ['rendah', 'sedang', 'tinggi'],
    },
    tools_available: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: ["web_search", "calculator", "rag", "function_calling"],
      },
      description: 'A list of tools that seem necessary. Include "web_search" if it mentions recent events, data, or the internet. Include "calculator" for math problems. Include "function_calling" if it implies interaction with external systems or APIs.',
    },
  },
};


export const detectPreferences = async (text: string): Promise<Partial<FormData>> => {
    const systemInstruction = `
You are an expert AI configuration analyst. Your task is to analyze the user's input text and infer the optimal settings for generating a response. Based on the text, determine the following:

- **language**: What is the primary language? Default to 'id'.
- **need_citations**: Is this a factual, research, or academic topic that would benefit from citations?
- **creativity_level**: Is the request technical and precise ('rendah'), a general inquiry ('sedang'), or a creative and open-ended task ('tinggi')?
- **risk_tolerance**: Does the topic involve sensitive, high-stakes areas like legal, financial, medical advice, or smart contract code ('rendah'), or is it a low-stakes creative task ('tinggi')?
- **tools_available**:
    - If the text asks for current information, news, or mentions searching online, add "web_search".
    - If there are mathematical calculations, add "calculator".
    - If it mentions specific internal documents or knowledge bases, suggest "rag".
    - If it mentions controlling devices, calling an API, or interacting with software, add "function_calling".

Return ONLY a valid JSON object with your inferred settings. If a setting cannot be confidently inferred, you may omit it from the object.
`;
    // FIX: Truncate the input text to a reasonable length to avoid exceeding the model's token limit for this simple inference task.
    // This is the same fix as in detectTaskType to prevent token limit errors on large file inputs.
    const MAX_LENGTH = 8000;
    const truncatedText = text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) + "..." : text;


    const userPrompt = `
Please analyze the following text and infer the optimal preferences.

--- TEXT ---
${truncatedText}
---
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: PREFERENCES_DETECTION_SCHEMA,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      console.warn("Preferences detection returned an empty response.");
      return {}; // Return empty object instead of throwing an error
    }

    return JSON.parse(responseText);

  } catch (error) {
    console.error("Error during preferences detection:", error);
    // This is a non-critical feature, so we warn and return an empty object
    // instead of throwing an error that would stop the user flow.
    console.warn("Gagal mendeteksi preferensi secara otomatis. Pengaturan default akan digunakan.");
    return {};
  }
};


export const extractInfoFromDocument = async (documentText: string, taskType: 'document' | 'agent' | 'application' | 'image'): Promise<Partial<FormData>> => {
    const schema = EXTRACTION_SCHEMAS[taskType as keyof typeof EXTRACTION_SCHEMAS];
    if (!schema) throw new Error(`Invalid task type for extraction: ${taskType}`);

    const systemInstruction = `Anda adalah ahli ekstraksi data. Tugas Anda adalah menganalisis dokumen yang diberikan pengguna dan mengekstrak informasi kunci berdasarkan skema JSON yang diperlukan. Dokumen ini adalah brief untuk tugas "${taskType}". Isi setiap kolom berdasarkan konten dokumen. Jika suatu informasi tidak ada secara eksplisit, biarkan kolom yang bersangkutan sebagai string kosong. Kembalikan HANYA objek JSON yang valid sesuai skema yang diberikan.`;
    
    const truncatedDocumentText = documentText.length > MAX_ANALYSIS_LENGTH 
        ? documentText.substring(0, MAX_ANALYSIS_LENGTH) + "\n\n//... [DOKUMEN DIPOTONG UNTUK EKSTRAKSI] ..." 
        : documentText;

    const userPrompt = `
Berikut adalah konten dokumennya:
---
${truncatedDocumentText}
---
Silakan ekstrak informasi yang relevan dan berikan dalam format JSON yang diminta.
`;

    return callExtractionAPI(userPrompt, systemInstruction, schema);
};

export const extractInfoWithInstruction = async (documentText: string, instructionText: string, taskType: 'document' | 'agent' | 'application' | 'image'): Promise<Partial<FormData>> => {
    const schema = EXTRACTION_SCHEMAS[taskType as keyof typeof EXTRACTION_SCHEMAS];
    if (!schema) throw new Error(`Invalid task type for extraction: ${taskType}`);

    const systemInstruction = `Anda adalah seorang analis proyek AI yang sangat canggih. Tugas Anda adalah mensintesis informasi dari DUA sumber untuk mengisi skema JSON yang diminta:
1.  **Instruksi Pengguna**: Ini adalah TUJUAN UTAMA atau FOKUS. Gunakan ini sebagai "lensa" untuk memandu analisis Anda terhadap dokumen.
2.  **Konten Dokumen**: Ini adalah SUMBER KEBENARAN untuk detail, konteks, batasan, dan informasi spesifik.

Prioritaskan tujuan dari **Instruksi Pengguna**, lalu ekstrak detail yang relevan dari **Konten Dokumen** untuk mengisi setiap kolom. Jika dokumen tidak mengandung detail untuk suatu kolom, gunakan inferensi cerdas berdasarkan instruksi, tetapi prioritaskan konten dokumen. Jika informasi tidak dapat ditemukan di kedua sumber, biarkan sebagai string kosong. Kembalikan HANYA objek JSON yang valid.`;

    const truncatedDocumentText = documentText.length > MAX_ANALYSIS_LENGTH 
        ? documentText.substring(0, MAX_ANALYSIS_LENGTH) + "\n\n//... [DOKUMEN DIPOTONG UNTUK EKSTRAKSI] ..." 
        : documentText;

     const userPrompt = `
Berikut adalah instruksi dan konten dokumen dari pengguna untuk tugas tipe "${taskType}":

--- INSTRUKSI PENGGUNA (FOKUS UTAMA) ---
${instructionText}
---

--- KONTEN DOKUMEN (SUMBER DETAIL) ---
${truncatedDocumentText}
---

Silakan analisis kedua sumber ini dan isi informasi yang relevan dalam format JSON yang diminta.
`;

    return callExtractionAPI(userPrompt, systemInstruction, schema);
};

export const extractInfoFromIdea = async (ideaText: string, taskType: 'document' | 'agent' | 'application' | 'image'): Promise<Partial<FormData>> => {
    const schema = EXTRACTION_SCHEMAS[taskType as keyof typeof EXTRACTION_SCHEMAS];
    if (!schema) throw new Error(`Invalid task type for extraction: ${taskType}`);

    let systemInstruction: string;

    if (taskType === 'image') {
        systemInstruction = `Anda adalah **Asisten Editor Foto AI** yang cerdas dan proaktif. Tugas Anda bukan hanya mengekstrak, tetapi **menganalisis, menafsirkan, dan merekomendasikan** pengaturan terbaik dalam skema JSON untuk mencapai tujuan pengguna.
- **Berpikir seperti seorang seniman**: Jika pengguna berkata 'buat terlihat vintage', Anda harus secara proaktif merekomendasikan 'efek_sepia' pada penyesuaian warna DAN menyarankan 'fotografi film vintage' sebagai referensi gaya.
- **Berpikir seperti seorang teknisi**: Jika pengguna ingin 'menghapus objek', pilih teknik 'inpainting'. Jika mereka ingin 'terlihat nyata', tambahkan 'photorealistic' sebagai peningkat estetika.
- **Jadilah Membantu**: Selalu rekomendasikan 'negative_prompt' yang baik seperti 'teks, watermark, buram' untuk meningkatkan kualitas akhir, bahkan jika tidak diminta.
Analisis ide pengguna dan isi formulir JSON dengan rekomendasi ahli Anda.`;
    } else {
        systemInstruction = `Anda adalah seorang analis proyek AI yang ahli dalam menginterpretasikan ide singkat. Tugas Anda adalah menganalisis ide atau instruksi yang diberikan pengguna dan mengembangkannya menjadi informasi terstruktur sesuai skema JSON yang diminta. Ide ini adalah brief untuk tugas "${taskType}". Lakukan inferensi cerdas untuk mengisi setiap kolom berdasarkan permintaan pengguna. Jika suatu informasi tidak dapat disimpulkan dari ide tersebut, biarkan kolom yang bersangkutan sebagai string kosong. Kembalikan HANYA objek JSON yang valid.`;
    }


    const userPrompt = `
Berikut adalah ide/instruksi dari pengguna:
---
${ideaText}
---
Silakan analisis ide ini dan isi informasinya ke dalam format JSON yang diminta berdasarkan peran Anda.
`;
    
    return callExtractionAPI(userPrompt, systemInstruction, schema);
};