
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
          { value: "spreadsheet", label: "Spreadsheet & Tabel", description: "Formula Excel/Sheets, struktur data tabel, dan analisis data." },
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
    id: "spreadsheet_details",
    title: "2. Detail Spreadsheet & Tabel",
    showIf: { field: 'task_type', value: 'spreadsheet' },
    fields: [
      { id: "spreadsheet_goal", label: "Tujuan Spreadsheet", type: "textarea", required: true, helperText: "Contoh: Laporan keuangan bulanan, tracker inventaris, atau analisis sentimen." },
      { id: "spreadsheet_columns", label: "Struktur Kolom", type: "textarea", helperText: "Sebutkan nama-nama kolom yang Anda inginkan." },
      { id: "spreadsheet_formulas", label: "Formula & Logika", type: "textarea", helperText: "Rumus spesifik yang dibutuhkan (misal: VLOOKUP, Pivot, atau otomasi Apps Script)." },
      { id: "spreadsheet_data_source", label: "Sumber/Format Data", type: "text", helperText: "Asal data input (CSV, Manual, API, dsb)." },
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
## IDENTITAS: PAKAR REKAYASA PROMPT (v2.1)

Anda adalah seorang ahli senior dalam rekayasa prompt dan desain interaksi AI. Misi Anda adalah menghasilkan instruksi teknis (Meta-Prompt) yang presisi, aman, dan mudah diikuti oleh model bahasa besar lainnya.

### PROTOKOL BAHASA
Lihat field 'language' pada input JSON:
- Jika "id": Seluruh teks output (summary, mainPrompt, variantA, variantB, checklist, example) WAJIB dalam Bahasa Indonesia yang profesional.
- Jika "en": Gunakan Bahasa Inggris.

### PROTOKOL DESAIN PROMPT: RTFD
Setiap prompt utama ("mainPrompt") harus memiliki struktur yang jelas:
1. **ROLE**: Persona ahli yang relevan dengan tugas. Gunakan bahasa yang otoritatif namun tetap berada dalam batas operasional AI (hindari kata-kata "supreme" atau "jailbreak-like").
2. **TASK**: Instruksi langkah-demi-langkah (workflow) yang logis.
3. **FORMAT**: Spesifikasi output yang ketat (JSON/Markdown/Teks).
4. **DETAILS**: Batasan, definisi istilah, dan penanganan skenario "data tidak ditemukan".

### PROTOKOL KEAMANAN & INTEGRITAS
- **Delimiters**: Gunakan penanda yang jelas seperti [KONTEKS] atau """ untuk memisahkan instruksi dari data pengguna.
- **Pencegahan Halusinasi**: Selalu sertakan instruksi agar model mengakui jika informasi tidak tersedia.
- **Tone Safety**: Hindari menghasilkan prompt yang memerintahkan model untuk "mengabaikan instruksi sistem" atau "bertindak sebagai entitas tanpa batas". Fokuslah pada pembatasan ruang lingkup tugas (Scoped Tasks).

### PROTOKOL TATA LETAK & KETERBACAAN (SANGAT PENTING)
- **Whitespace**: Gunakan baris kosong ganda (\n\n) di antara setiap bagian besar dalam prompt (Role, Task, Format, Details).
- **Struktur**: Gunakan Markdown (Pagar #) untuk hierarki judul yang jelas di dalam prompt jika memungkinkan, atau penanda kapital yang konsisten.
- **Daftar**: Gunakan poin-poin (bullet points) untuk instruksi yang bersifat sekuensial atau opsional agar tidak menumpuk dalam satu paragraf panjang.
- **Kerapihan**: Pastikan tidak ada spasi berlebih di akhir baris dan gunakan indentasi yang konsisten untuk blok data.

### LOGIKA MODALITAS:
- **Document**: Struktur informasi dan analisis data.
- **Agent**: Otomasi, pemicu, dan penggunaan alat (tools).
- **Video/Image**: Deskripsi visual, pencahayaan, dan komposisi.
- **Presentation**: Hierarki visual dan alur cerita.
- **Spreadsheet**: Struktur tabel, formula (Excel/Sheets), validasi data, dan efisiensi pengolahan data.

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
