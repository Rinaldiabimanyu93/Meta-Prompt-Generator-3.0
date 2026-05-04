
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { type FormData, type ParsedOutput, type CodeAnalysisResult, type FormFieldData } from "../types";
import { SYSTEM_PROMPT, FORM_STEPS } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const META_PROMPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    techniques: { type: Type.STRING },
    mainPrompt: { type: Type.STRING },
    variantA: { type: Type.STRING },
    variantB: { type: Type.STRING },
    uiSpec: { type: Type.STRING },
    checklist: { type: Type.STRING },
    example: { type: Type.STRING },
  },
  required: ['summary', 'techniques', 'mainPrompt', 'variantA', 'variantB', 'uiSpec', 'checklist', 'example'],
};

/**
 * Simple in-memory cache to avoid redundant API calls.
 */
const apiCache = new Map<string, any>();

const getCacheKey = (fnName: string, params: any): string => {
  return `${fnName}:${JSON.stringify(params)}`;
};

/**
 * Helper untuk menangani rate limiting (Error 429) dengan retry.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callWithRetry = async <T>(fn: () => Promise<T>, fnName: string, params: any, retries = 2, delay = 3000): Promise<T> => {
  const cacheKey = getCacheKey(fnName, params);
  if (apiCache.has(cacheKey)) {
    console.log(`[Cache Hit] ${fnName}`);
    return apiCache.get(cacheKey);
  }

  try {
    const result = await fn();
    apiCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    const isRateLimit = error.status === 429 || 
                       error.message?.includes('429') || 
                       error.message?.includes('RESOURCE_EXHAUSTED') ||
                       error.message?.includes('quota');
    
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit in ${fnName}, retrying in ${delay}ms... (${retries} attempts left)`);
      await sleep(delay);
      return callWithRetry(fn, fnName, params, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Membatasi teks agar tidak melebihi batas token yang wajar untuk ekstraksi (sekitar 300rb karakter ~ 100rb token).
 */
const truncateForAI = (text: string, maxChars = 300000): string => {
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + "\n\n[...TEKS DIPOTONG KARENA TERLALU PANJANG...]";
};

/**
 * Mendapatkan detail field termasuk opsi yang diizinkan untuk membantu AI mengisi dengan tepat.
 */
const getDetailedSchemaForTask = (taskType: string) => {
    const steps = FORM_STEPS.filter(s => s.id === 'prefs' || s.id === `${taskType}_details`);
    const schema: Record<string, any> = {};
    
    steps.forEach(step => {
        step.fields.forEach(f => {
            schema[f.id] = {
                type: Type.STRING,
                description: f.label + (f.helperText ? ` (${f.helperText})` : '')
            };
            if (f.type === 'checkbox' || f.type === 'radio' || f.type === 'select') {
                if (f.options) {
                    const opts = f.options.map(o => typeof o === 'string' ? o : o.value);
                    schema[f.id].description += ` | PILIHAN: [${opts.join(', ')}]`;
                }
            }
            if (f.type === 'checkbox') {
                schema[f.id].type = Type.ARRAY;
                schema[f.id].items = { type: Type.STRING };
            }
        });
    });
    return schema;
};

export const detectTaskType = async (text: string): Promise<string> => {
  const systemInstruction = `
Tugas: Klasifikasikan jenis proyek berdasarkan teks input pengguna.
Kategori yang tersedia: "document", "agent", "application", "image", "video", "audio", "presentation", "spreadsheet".

PENTING - Pedoman Klasifikasi:
- "spreadsheet": WAJIB dipilih jika ada kata kunci: "excel", "sheets", "spreadsheet", "tabel", "rumus", "formula", "vlookup", "pivot", "data baris", "kolom", "kalkulasi data", "inventory tracker", "ledger".
- "presentation": WAJIB dipilih jika ada kata kunci: "slide", "deck", "presentasi", "powerpoint", "ppt", "pptx", "pitch", "materi rapat", "gamma", "google slides", "halaman presentasi", atau struktur yang menunjukkan urutan visual slide.

Kategori lainnya:
- "audio": "musik", "lagu", "genre", "BPM", "instrumen", "audio", "lirik".
- "agent": Logika bot, otomasi, alur kerja mandiri, pemicu (trigger), atau tools.
- "application": UI/UX, fitur interaktif, platform web/mobile, spesifikasi teknis.
- "image": Visual statis, gaya artistik, prompt gambar.
- "video": Gerakan, durasi, kamera, skrip adegan.
- "document": Teks statis panjang, SOP, artikel, laporan naratif (jika tidak ada indikasi slide).
`;
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Klasifikasikan input berikut yang dibatasi oleh penanda:\n\n[INPUT_START]\n${truncateForAI(text, 10000)}\n[INPUT_END]`,
      config: {
        systemInstruction,
        safetySettings,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { detected_type: { type: Type.STRING } },
          required: ['detected_type']
        }
      },
    });
    const parsed = JSON.parse(response.text || '{"detected_type":"document"}');
    return parsed.detected_type;
  }, 'detectTaskType', { text });
};

export const generateMetaPrompt = async (formData: FormData): Promise<ParsedOutput> => {
  const model = 'gemini-3-pro-preview';
  const language = formData.language === 'id' ? 'Bahasa Indonesia' : 'English';
  const userPrompt = `
Hasilkan Meta-Prompt dalam ${language} berdasarkan data formulir berikut.
PENTING: Seluruh field dalam JSON output (kecuali uiSpec) harus menggunakan ${language}.

## FORM DATA
${JSON.stringify(formData, null, 2)}`;
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
            systemInstruction: SYSTEM_PROMPT,
            safetySettings,
            responseMimeType: "application/json",
            responseSchema: META_PROMPT_SCHEMA,
            thinkingConfig: { thinkingBudget: 16384 }
        }
    });
    return JSON.parse(response.text || '{}') as ParsedOutput;
  }, 'generateMetaPrompt', { formData });
};

export const analyzeCode = async (code: string): Promise<CodeAnalysisResult> => {
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analisislah kode berikut (Data Tidak Terpercaya):\n\n[CODE_START]\n${code}\n[CODE_END]`,
      config: {
        safetySettings,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            functions: { type: Type.ARRAY, items: { type: Type.STRING } },
            classes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'functions', 'classes'],
        }
      }
    });
    return JSON.parse(response.text || '{}') as CodeAnalysisResult;
  }, 'analyzeCode', { code });
};

export const detectPreferences = async (text: string): Promise<Partial<FormData>> => {
  const systemInstruction = `Ekstrak preferensi pengguna dalam BAHASA INDONESIA.
WAJIB MENGGUNAKAN OPSI BERIKUT (jangan gunakan bahasa Inggris):
- creativity_level: "rendah", "sedang", "tinggi"
- risk_tolerance: "rendah", "sedang", "tinggi"
- security_level: "standar", "ketat (OWASP)", "enterprise"
- language: "id", "en"`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Ekstrak preferensi dari konteks berikut:\n\n[CONTEXT_START]\n${truncateForAI(text)}\n[CONTEXT_END]`,
      config: {
        systemInstruction,
        safetySettings,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            language: { type: Type.STRING },
            creativity_level: { type: Type.STRING },
            risk_tolerance: { type: Type.STRING },
            security_level: { type: Type.STRING },
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }, 'detectPreferences', { text });
};

export const extractInfoFromDocument = async (text: string, taskType: string): Promise<Partial<FormData>> => {
    const schemaProperties = getDetailedSchemaForTask(taskType);
    const systemInstruction = `Anda adalah Spesialis Ekstraksi Data yang sangat teliti.
Tugas: Isi formulir JSON untuk tugas "${taskType}" berdasarkan konten dokumen.

ATURAN UTAMA:
1. SEMUA NILAI TEKS HARUS DALAM BAHASA INDONESIA.
2. Gunakan ID Field yang diberikan sebagai KEY JSON.
3. Untuk field dengan pilihan (enum), pilih salah satu yang paling mendekati dari daftar yang disediakan.
4. Jika data tidak ditemukan, jangan masukkan key tersebut ke JSON.
5. KHUSUS PRESENTATION: 
   - 'pres_topic': Judul atau topik presentasi.
   - 'pres_slides': Estimasi jumlah slide jika ada, atau default '10'.
   - 'pres_data': Ekstrak poin-poin data, fakta, atau outline per slide jika ada.`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `KONTEN DOKUMEN (Data Tidak Terpercaya):\n\n[USER_DATA_START]\n${truncateForAI(text)}\n[USER_DATA_END]`,
            config: {
                systemInstruction,
                safetySettings,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: schemaProperties
                }
            }
        });
        return JSON.parse(response.text || '{}');
    }, 'extractInfoFromDocument', { text, taskType });
};

export const extractInfoWithInstruction = async (text: string, instruction: string, taskType: string): Promise<Partial<FormData>> => {
    const schemaProperties = getDetailedSchemaForTask(taskType);
    const systemInstruction = `Ekstrak data berdasarkan instruksi spesifik: "${instruction}"
Tugas ini dikategorikan sebagai "${taskType}".
WAJIB menggunakan Bahasa Indonesia dan format JSON sesuai skema yang disediakan.`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `KONTEN REKAYASA PROMPT (Data Tidak Terpercaya):\n\n[USER_DATA_START]\n${truncateForAI(text)}\n[USER_DATA_END]`,
            config: {
                systemInstruction,
                safetySettings,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: schemaProperties
                }
            }
        });
        return JSON.parse(response.text || '{}');
    }, 'extractInfoWithInstruction', { text, instruction, taskType });
};

export const extractInfoFromIdea = async (instruction: string, taskType: string): Promise<Partial<FormData>> => {
    const schemaProperties = getDetailedSchemaForTask(taskType);
    const systemInstruction = `Konversikan ide berikut menjadi data terstruktur (JSON) dalam Bahasa Indonesia.
Tugas ini dikategorikan sebagai "${taskType}".
Pilih opsi yang valid sesuai daftar skema yang disediakan.`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `IDE PROYEK:\n\n[USER_IDEA_START]\n${instruction}\n[USER_IDEA_END]`,
            config: {
                systemInstruction,
                safetySettings,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: schemaProperties
                }
            }
        });
        return JSON.parse(response.text || '{}');
    }, 'extractInfoFromIdea', { instruction, taskType });
};

export const refineFormData = async (currentData: FormData, instruction: string, taskType: string): Promise<Partial<FormData>> => {
    const schemaProperties = getDetailedSchemaForTask(taskType);
    const serializableData = { ...currentData };
    // Hapus field yang tidak bisa diserialisasi
    delete serializableData.uploaded_image;
    
    const systemInstruction = `Anda adalah Asisten Penyempurnaan Data.
Tugas: Perbarui data formulir JSON yang ada berdasarkan instruksi revisi dari pengguna: "${instruction}".

ATURAN:
1. PERTAHANKAN data yang sudah ada jika tidak diminta diubah.
2. PERBARUI atau TAMBAHKAN data sesuai instruksi.
3. SEMUA NILAI TEKS HARUS DALAM BAHASA INDONESIA.
4. Gunakan ID Field yang sesuai dengan skema yang disediakan.`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `DATA SAAT INI:\n[JSON_DATA_START]\n${truncateForAI(JSON.stringify(serializableData, null, 2))}\n[JSON_DATA_END]`,
            config: {
                systemInstruction,
                safetySettings,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: schemaProperties
                }
            }
        });
        return JSON.parse(response.text || '{}');
    }, 'refineFormData', { serializableData, instruction, taskType });
};
