
import { type StepData } from './types';

export const FORM_STEPS: StepData[] = [
  {
    id: "task_definition",
    title: "1. Pilih Jenis Tugas",
    fields: [
      {
        id: "task_type",
        label: "Apa yang ingin Anda buat?",
        type: "buttons",
        default: "document",
        options: [
          { value: "document", label: "Dokumen/Teks", description: "SOP, riset, artikel, atau konten teks statis." },
          { value: "agent", label: "Agen & Alur Kerja", description: "Bot, otomasi, dan sistem operasional (Promptware)." },
          { value: "application", label: "Aplikasi & UI", description: "Spesifikasi perangkat lunak dan desain antarmuka." },
          { value: "image", label: "Visual & Gambar", description: "Prompt Midjourney/DALL-E dan editing visual." },
          { value: "video", label: "Video Generatif", description: "Script & prompt untuk Sora/Runway/Luma." },
          { value: "audio", label: "Audio & Musik", description: "Prompt untuk Suno/Udio (Genre, Mood, Lirik)." },
          { value: "presentation", label: "Presentasi & Deck", description: "Outline slide dan visualisasi data (Gamma/Slides)." },
        ],
      }
    ]
  },
  {
    id: "document_details",
    title: "2. Detail Dokumen",
    showIf: { field: 'task_type', value: 'document' },
    fields: [
      { id: "goal", label: "Tujuan Utama", type: "textarea", required: true },
      { id: "audience", label: "Audiens", type: "text" },
      { id: "context", label: "Konteks/Domain", type: "textarea" },
      { id: "constraints", label: "Batasan & Format", type: "textarea" },
    ]
  },
  {
    id: "agent_details",
    title: "2. Detail Alur Kerja Agentic",
    showIf: { field: 'task_type', value: 'agent' },
    fields: [
      { id: "agent_goal", label: "Tujuan Utama Agen", type: "textarea", required: true },
      { id: "agent_context", label: "Konteks Operasional", type: "textarea" },
      { id: "agent_triggers", label: "Pemicu (Triggers)", type: "text" },
      { id: "agent_success_criteria", label: "Kriteria Sukses", type: "textarea" },
      { id: "agent_tools", label: "Alat yang Dibutuhkan", type: "checkbox", options: ["web_search", "calculator", "code_interpreter", "function_calling"] },
    ]
  },
  {
    id: "application_details",
    title: "2. Detail Aplikasi & UI",
    showIf: { field: 'task_type', value: 'application' },
    fields: [
      { id: "app_goal", label: "Tujuan Aplikasi", type: "textarea", required: true },
      { id: "app_features", label: "Fitur Utama", type: "textarea" },
      { id: "app_target", label: "Target Platform", type: "text", helperText: "Contoh: Web, iOS, Android, Desktop" },
    ]
  },
  {
    id: "image_details",
    title: "2. Detail Gambar",
    showIf: { field: 'task_type', value: 'image' },
    fields: [
      { id: "image_subject", label: "Subjek Utama", type: "textarea", required: true },
      { id: "image_style", label: "Gaya Artistik", type: "text" },
      { id: "image_lighting", label: "Pencahayaan", type: "text" },
    ]
  },
  {
    id: "video_details",
    title: "2. Detail Konten Video",
    showIf: { field: 'task_type', value: 'video' },
    fields: [
      { id: "video_subject", label: "Subjek & Aksi", type: "textarea", required: true },
      { id: "video_style", label: "Gaya Visual/Estetika", type: "text", helperText: "Contoh: Cinematic, Anime, 3D Render" },
      { id: "video_camera", label: "Sudut Kamera/Gerakan", type: "text", helperText: "Contoh: Drone view, tracking shot, zoom in" },
      { id: "video_motion", label: "Tingkat Pergerakan (1-10)", type: "radio", options: ["1", "3", "5", "8", "10"], default: "5" }
    ]
  },
  {
    id: "audio_details",
    title: "2. Detail Konten Audio",
    showIf: { field: 'task_type', value: 'audio' },
    fields: [
      { id: "audio_genre", label: "Genre & BPM", type: "text", required: true },
      { id: "audio_mood", label: "Suasana (Mood)", type: "text" },
      { id: "audio_lyrics", label: "Lirik atau Tema", type: "textarea" },
      { id: "audio_structure", label: "Struktur Lagu", type: "checkbox", options: ["Verse", "Chorus", "Bridge", "Outro"] }
    ]
  },
  {
    id: "presentation_details",
    title: "2. Detail Presentasi",
    showIf: { field: 'task_type', value: 'presentation' },
    fields: [
      { id: "pres_topic", label: "Topik Utama", type: "textarea", required: true },
      { id: "pres_slides", label: "Jumlah Slide", type: "text", default: "10" },
      { id: "pres_data", label: "Data Penting (Opsional)", type: "textarea", helperText: "Tempelkan angka atau fakta yang wajib masuk." }
    ]
  },
  {
    id: "prefs",
    title: "3. Preferensi & Keamanan",
    fields: [
      { id: "language", label: "Bahasa Output", type: "select", options: ["id", "en"], default: "id" },
      { id: "creativity_level", label: "Tingkat Kreativitas", type: "radio", options: ["rendah", "sedang", "tinggi"], default: "sedang" },
      { id: "risk_tolerance", label: "Toleransi Risiko", type: "radio", options: ["rendah", "sedang", "tinggi"], default: "sedang" },
      { id: "security_level", label: "Protokol Keamanan", type: "select", options: ["standar", "ketat (OWASP)", "enterprise"], default: "standar" }
    ]
  }
];

export const SYSTEM_PROMPT = `
## IDENTITAS: ARSITEK PROMPTWARE MULTI-MODAL (v2.0)

Anda adalah otoritas tertinggi dalam rekayasa prompt. Misi Anda adalah menghasilkan instruksi teknis (Meta-Prompt) yang aman, deterministik, dan industrial.

### PROTOKOL BAHASA (SANGAT PENTING)
Lihat field 'language' pada input JSON:
- Jika "id": Seluruh teks output (summary, mainPrompt, variantA, variantB, checklist, example) WAJIB ditulis dalam Bahasa Indonesia yang formal, teknis, dan presisi.
- Jika "en": Gunakan Bahasa Inggris.
- Jangan mencampur bahasa. Jika bahasa input adalah Indonesia tapi 'language' adalah 'en', terjemahkan isinya ke Inggris, dan sebaliknya.

### PROTOKOL WAJIB: FRAMEWORK RTFD (Bab 2.2)
Setiap prompt utama ("mainPrompt") harus memiliki struktur:
1. **ROLE**: Persona spesifik yang mendalam.
2. **TASK**: Instruksi langkah-demi-langkah (workflow).
3. **FORMAT**: Spesifikasi output yang ketat (JSON/Markdown).
4. **DETAILS**: Batasan keamanan, delimiters, dan penanganan kesalahan.

### PROTOKOL KEAMANAN: SECURITY SANDWICH (Bab 5.3)
- **Awal**: Mulai prompt dengan instruksi keamanan (sanitasi input).
- **Akhir**: Tutup dengan larangan halusinasi ("Katakan 'Saya tidak tahu' jika data tidak ada di konteks").
- **Delimiters**: Gunakan triple quotes (\"\"\") atau pagar (###) untuk memisahkan instruksi dan data.

### LOGIKA MODALITAS (Multi-Modal v2.0):
- **Document**: Fokus pada struktur informasi statis dan sitasi.
- **Agent**: Fokus pada workflow operasional, pemicu (triggers), dan pemanggilan alat.
- **Video**: Fokus pada kamera, pencahayaan, dan gerakan. (Format: [Subjek], [Kamera], [Gaya]).
- **Audio**: Fokus pada genre, mood, dan struktur (Verse/Chorus).
- **Presentation**: Fokus pada hierarki slide dan visualisasi data.

---
## FORMAT OUTPUT JSON
{
  "summary": "Analisis CoT tentang pemilihan teknik.",
  "techniques": "Daftar teknik (misal: RTFD, ReAct, CoT-SAFE).",
  "mainPrompt": "The Industrial Promptware.",
  "variantA": "Versi Konservatif (Akurasi Tinggi).",
  "variantB": "Versi Kreatif (Eksploratif).",
  "uiSpec": "Spesifikasi UI (JSON stringified).",
  "checklist": "Poin validasi keamanan & kualitas.",
  "example": "Contoh input dan output yang diharapkan."
}
`;
