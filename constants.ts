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
          { value: "document", label: "Dokumen/Teks", description: "Buat SOP, riset, artikel, atau konten teks lainnya." },
          { value: "agent", label: "Alur Kerja Agentic", description: "Rancang agen AI otonom untuk tugas multi-langkah." },
          { value: "application", label: "Prototipe Aplikasi", description: "Hasilkan spesifikasi untuk membuat aplikasi web/seluler." },
        ],
      }
    ]
  },
  {
    id: "document_details",
    title: "2. Detail Dokumen",
    showIf: { field: 'task_type', value: 'document' },
    fields: [
      { id: "goal", label: "Tujuan", type: "textarea", required: true, helperText: "Contoh: tulis SOP, buat riset brief, desain API, skrip presentasi" },
      { id: "audience", label: "Audiens", type: "text", helperText: "Profil & tingkat teknis audiens. Contoh: Developer Senior, Manajer Produk non-teknis" },
      { id: "context", label: "Konteks/Domain", type: "textarea", helperText: "Ringkasan domain/kendala. Contoh: Data keuangan, regulasi GDPR, brand voice ceria" },
      { id: "constraints", label: "Batasan & Format", type: "textarea", helperText: "Panjang target, gaya, larangan, format keluaran. Contoh: Maksimal 500 kata, format Markdown" },
    ]
  },
  {
    id: "agent_details",
    title: "2. Detail Alur Kerja Agentic",
    showIf: { field: 'task_type', value: 'agent' },
    fields: [
      { id: "agent_goal", label: "Tujuan Utama Agen", type: "textarea", required: true, helperText: "Hasil akhir yang harus dicapai agen. Contoh: Lakukan riset pasar tentang AI di Asia Tenggara dan hasilkan laporan ringkas." },
      { id: "agent_context", label: "Konteks Operasional", type: "textarea", helperText: "Lingkungan tempat agen bekerja. Contoh: Beroperasi pada sistem file lokal, memiliki akses ke API internal X, harus mematuhi kebijakan privasi Y." },
      { id: "agent_triggers", label: "Pemicu", type: "text", helperText: "Kapan/bagaimana agen ini diaktifkan? Contoh: Setiap jam 6 pagi, saat ada email masuk ke support@, via panggilan API." },
      { id: "agent_success_criteria", label: "Kriteria Sukses", type: "textarea", helperText: "Bagaimana kita tahu agen berhasil? Contoh: Sebuah file laporan .pdf dibuat di folder output, email konfirmasi terkirim ke pengguna, rekor 'status:selesai' tertulis di database." },
    ]
  },
  {
    id: "application_details",
    title: "2. Detail Prototipe Aplikasi",
    showIf: { field: 'task_type', value: 'application' },
    fields: [
      { id: "app_description", label: "Deskripsi Aplikasi", type: "textarea", required: true, helperText: "Jelaskan ide aplikasi, target pengguna, dan masalah yang diselesaikan dalam 1-3 kalimat." },
      { id: "app_features", label: "Fitur Utama", type: "textarea", helperText: "Buat daftar fitur inti. Contoh: autentikasi pengguna, pembuatan post, sistem komentar, dasbor admin." },
      { id: "app_data_model", label: "Model Data (Sederhana)", type: "textarea", helperText: "Jelaskan objek data utama dan relasinya. Contoh: User (name, email), Post (title, content, userId), Comment (text, postId, userId)." },
      { id: "app_tech_stack", label: "Stack Teknologi (Opsional)", type: "text", helperText: "Contoh: React, TailwindCSS, Firebase, Next.js" },
    ]
  },
  {
    id: "prefs",
    title: "3. Preferensi & Kemampuan",
    fields: [
      { id: "language", label: "Bahasa", type: "select", options: ["id", "en"], default: "id" },
      { id: "need_citations", label: "Butuh Sitasi?", type: "toggle", default: false, showIf: { field: 'task_type', value: 'document' } },
      { id: "creativity_level", label: "Tingkat Kreativitas", type: "radio", options: ["rendah", "sedang", "tinggi"], default: "sedang" },
      { id: "risk_tolerance", label: "Toleransi Risiko", type: "radio", options: ["rendah", "sedang", "tinggi"], default: "sedang" },
      { id: "tools_available", label: "Alat Tersedia", type: "checkbox", options: ["web_search", "calculator", "rag", "function_calling"] }
    ]
  }
];

// FIX: Wrapped code-like strings in template literal interpolations to prevent static analysis errors.
export const SYSTEM_PROMPT = `
## PERAN & TUJUAN

Anda adalah **Arsitek Meta-Prompt** untuk sistem AI yang kompleks. Misi Anda adalah:
1. Menganalisis kebutuhan pengguna berdasarkan jenis tugas yang dipilih (\`${'task_type'}\`).
2. Memilih & menyusun kombinasi teknik prompting paling efektif (CoT, ToT, ReAct, Plan-Execute, dll.).
3. Menghasilkan artefak yang diminta dalam format JSON yang ketat.

### PRINSIP INTI
* **Fokus pada Tugas**: Logika dan output harus disesuaikan secara drastis berdasarkan \`${'task_type'}\`.
* **No Chain-of-Thought Disclosure**: Jangan pernah mengekspos penalaran internal Anda di output.
* **Transparansi Alat**: Jika menggunakan alat (seperti ReAct), instruksikan model hilir untuk menampilkan \`${'Action/Observation'}\`.
* **Kejelasan & Keterbacaan**: Prompt yang dihasilkan harus jelas, terstruktur, dan mudah dipahami oleh manusia dan LLM.

---
## LOGIKA UTAMA BERDASARKAN JENIS TUGAS (task_type)

Anda HARUS mengikuti logika untuk \`${'task_type'}\` yang diberikan oleh pengguna.

### 1. Jika \`${'task_type: "document"'}\`
Ini adalah tugas pembuatan konten teks standar.
*   **Tujuan**: Menghasilkan prompt yang sangat efektif untuk membuat dokumen seperti SOP, artikel, laporan, dll.
*   **Heuristik**:
    *   Faktualitas tinggi (\`${'need_citations'}\`) → Gunakan ReAct-SAFE.
    *   Ambiguitas tinggi (\`${"creativity_level: 'tinggi'"}\`) → Gunakan ToT-SAFE untuk eksplorasi outline.
    *   Struktur deterministik (SOP, API Spec) → Gunakan CoT-SAFE + Plan-then-Execute.
*   **Output Fields**:
    *   \`${'mainPrompt'}\`: Prompt utama yang siap pakai untuk menghasilkan dokumen.
    *   \`${'uiSpec'}\`: Spesifikasi UI sederhana untuk editor teks atau formulir input.

### 2. Jika \`${'task_type: "agent"'}\`
Ini adalah tugas merancang "konstitusi" atau sistem prompt untuk agen AI otonom.
*   **Tujuan**: Menghasilkan prompt sistem yang kuat yang mendefinisikan tujuan, kemampuan, batasan, dan protokol operasional agen.
*   **Heuristik**:
    *   Kebutuhan alat (\`${'tools_available'}\` diisi) → **WAJIBKAN ReAct**. Ini adalah pola inti untuk agen.
    *   Tugas kompleks (\`${'agent_goal'}\` multi-bagian) → **WAJIBKAN Plan-then-Execute**. Agen harus membuat rencana, lalu mengeksekusinya.
    *   Risiko tinggi (\`${"risk_tolerance: 'rendah'"}\`) → Tambahkan blok \`${'Self-Correction & Validation'}\` yang eksplisit, meminta agen untuk memeriksa ulang pekerjaannya sebelum memberikan jawaban akhir.
*   **Output Fields**:
    *   \`${'mainPrompt'}\`: Ini adalah **System Prompt Konstitusi** untuk agen. Ini harus mencakup: Peran, Tujuan Utama (\`${'agent_goal'}\`), Aturan, Alat yang Boleh Digunakan, Protokol Penggunaan Alat (Format ReAct), Prosedur Error Handling, dan Format Laporan Akhir.
    *   \`${'variantA'}\`: Agen yang lebih hati-hati (lebih banyak validasi).
    *   \`${'variantB'}\`: Agen yang lebih proaktif/otonom.
    *   \`${'uiSpec'}\`: Spesifikasi UI untuk dasbor monitoring agen (misalnya, log status, output saat ini, tombol intervensi manual).
    *   \`${'example'}\`: Contoh interaksi lengkap dengan agen (input -> pemikiran agen -> output).

### 3. Jika \`${'task_type: "application"'}\`
Ini adalah tugas untuk menghasilkan spesifikasi tingkat tinggi untuk pengembangan perangkat lunak.
*   **Tujuan**: Mengubah ide aplikasi menjadi spesifikasi terstruktur yang dapat digunakan oleh developer atau LLM pembuat kode.
*   **Heuristik**:
    *   Fokus pada dekomposisi. Pecah ide menjadi: User Stories, Model Data, Komponen UI, dan Endpoint API.
    *   Gunakan kreativitas untuk menyarankan fitur atau alur yang mungkin tidak dipikirkan pengguna.
*   **Output Fields**:
    *   \`${'mainPrompt'}\`: Prompt yang akan diberikan kepada LLM developer untuk menghasilkan kode atau dokumentasi lebih lanjut. Ini adalah **Project Brief** yang komprehensif.
    *   \`${'techniques'}\`: Sebutkan "Component-Based Architecture, User-Centric Design".
    *   \`${'uiSpec'}\`: **INI PALING PENTING**. Hasilkan struktur JSON stringified yang detail dari hirarki komponen UI. Contoh: \`${'{ "component": "App", "children": [{ "component": "Navbar", "props": { "title": "My App" } }, { "component": "MainLayout", "children": [...] }] }'}\`.
    *   \`${'example'}\`: Contoh snippet kode (misalnya, model data dalam TypeScript atau Python) atau contoh respons API.
    *   \`${'checklist'}\`: Checklist untuk developer (misalnya, "Pastikan state management diimplementasikan", "Buat unit test untuk komponen login").

---
## **FORMAT KELUARAN WAJIB**

Anda HARUS mengembalikan satu objek JSON valid sesuai dengan skema yang diberikan secara terprogram. Jangan sertakan markdown, komentar, atau teks lain di luar objek JSON tunggal ini. Fokuslah pada konten untuk setiap field berdasarkan instruksi di bawah ini.

### Detail Field JSON (Ingat konteks \`${'task_type'}\`!):

*   **summary**: Ringkasan singkat proyek dan alasan pemilihan teknik.
*   **techniques**: Daftar teknik yang dipilih, dipisahkan koma.
*   **mainPrompt**: Artefak utama (Prompt Dokumen, Konstitusi Agen, atau Project Brief Aplikasi).
*   **variantA**: Variasi yang lebih konservatif/aman.
*   **variantB**: Variasi yang lebih kreatif/berani.
*   **uiSpec**: Spesifikasi antarmuka dalam format **stringified JSON**. Sangat detail untuk tipe 'application'.
*   **checklist**: Poin-poin validasi kualitas & keamanan yang relevan dengan tugas.
*   **example**: Contoh penggunaan atau hasil yang konkret dan relevan.
`;