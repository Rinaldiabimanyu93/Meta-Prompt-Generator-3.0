
import { GoogleGenAI, Type } from "@google/genai";
import { type FormData, type ParsedOutput, type CodeAnalysisResult, type FormFieldData } from "../types";
import { SYSTEM_PROMPT, FORM_STEPS } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
 * Helper untuk menangani rate limiting (Error 429) dengan retry.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error.status === 429 || 
                       error.message?.includes('429') || 
                       error.message?.includes('RESOURCE_EXHAUSTED') ||
                       error.message?.includes('quota');
    
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit, retrying in ${delay}ms... (${retries} attempts left)`);
      await sleep(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Mendapatkan detail field termasuk opsi yang diizinkan untuk membantu AI mengisi dengan tepat.
 */
const getDetailedSchemaForTask = (taskType: string): string => {
    const steps = FORM_STEPS.filter(s => s.id === 'prefs' || s.id === `${taskType}_details`);
    let schemaDescription = "Gunakan ID Field berikut sebagai KEY JSON. PENTING: Ikuti aturan nilainya dengan ketat.\n";
    
    steps.forEach(step => {
        step.fields.forEach(f => {
            let info = `- ID: "${f.id}" (Label: ${f.label})`;
            if (f.options) {
                const opts = f.options.map(o => typeof o === 'string' ? o : o.value);
                info += ` | PILIHAN YANG DIIZINKAN (WAJIB SALAH SATU): [${opts.join(', ')}]`;
            }
            schemaDescription += info + "\n";
        });
    });
    return schemaDescription;
};

export const detectTaskType = async (text: string): Promise<string> => {
  const systemInstruction = `
Tugas: Klasifikasikan jenis proyek berdasarkan teks input pengguna.
Kategori yang tersedia: "document", "agent", "application", "image", "video", "audio", "presentation".

PENTING - Pedoman Klasifikasi Presentasi:
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
      contents: `Klasifikasikan input ini: "${text.substring(0, 4000)}"`,
      config: {
        systemInstruction,
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
  });
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
            responseMimeType: "application/json",
            responseSchema: META_PROMPT_SCHEMA,
            thinkingConfig: { thinkingBudget: 16384 }
        }
    });
    return JSON.parse(response.text || '{}') as ParsedOutput;
  });
};

export const analyzeCode = async (code: string): Promise<CodeAnalysisResult> => {
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analisislah kode ini dan ekstrak strukturnya dalam Bahasa Indonesia:\n\n${code}`,
      config: {
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
  });
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
      contents: `Konteks:\n\n${text}`,
      config: {
        systemInstruction,
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
  });
};

export const extractInfoFromDocument = async (text: string, taskType: string): Promise<Partial<FormData>> => {
    const schema = getDetailedSchemaForTask(taskType);
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
   - 'pres_data': Ekstrak poin-poin data, fakta, atau outline per slide jika ada.

SKEMA FIELD:\n${schema}`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `KONTEN DOKUMEN:\n\n${text}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
            }
        });
        let cleanJson = response.text || '{}';
        if (cleanJson.includes('```json')) {
            cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
        }
        return JSON.parse(cleanJson);
    });
};

export const extractInfoWithInstruction = async (text: string, instruction: string, taskType: string): Promise<Partial<FormData>> => {
    const schema = getDetailedSchemaForTask(taskType);
    const systemInstruction = `Ekstrak data berdasarkan instruksi spesifik: "${instruction}"
Tugas ini dikategorikan sebagai "${taskType}".
WAJIB menggunakan Bahasa Indonesia dan format JSON sesuai skema:
${schema}`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `KONTEN DOKUMEN:\n\n${text}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
            }
        });
        return JSON.parse(response.text || '{}');
    });
};

export const extractInfoFromIdea = async (instruction: string, taskType: string): Promise<Partial<FormData>> => {
    const schema = getDetailedSchemaForTask(taskType);
    const systemInstruction = `Konversikan ide berikut menjadi data terstruktur (JSON) dalam Bahasa Indonesia.
Tugas ini dikategorikan sebagai "${taskType}".
Pilih opsi yang valid sesuai daftar skema:
${schema}`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `IDE PROYEK: "${instruction}"`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
            }
        });
        return JSON.parse(response.text || '{}');
    });
};
