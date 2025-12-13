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
          { value: "image", label: "Edit Gambar", description: "Hasilkan prompt untuk memodifikasi gambar menggunakan AI." },
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
      { id: "agent_tools", label: "Alat yang Dibutuhkan Agen", type: "checkbox", options: ["web_search", "calculator", "code_interpreter", "function_calling"], helperText: "Pilih alat yang harus dimiliki agen untuk menyelesaikan tujuannya." },
      { id: "code_analysis_summary", label: "Ringkasan Analisis Kode AI", type: "readonly", helperText: "Ringkasan otomatis dari file kode yang diunggah akan muncul di sini setelah analisis." }
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
      { id: "code_analysis_summary", label: "Ringkasan Analisis Kode AI", type: "readonly", helperText: "Ringkasan otomatis dari file kode yang diunggah akan muncul di sini setelah analisis." }
    ]
  },
   {
    id: "image_details",
    title: "2. Detail Editing Gambar",
    showIf: { field: 'task_type', value: 'image' },
    fields: [
      { id: "uploaded_image", label: "Unggah Gambar", type: "image_upload", required: true, helperText: "Seret atau pilih file gambar yang ingin diedit." },
      { id: "image_instruction", label: "Instruksi Editing Umum", type: "textarea", required: true, helperText: "Contoh: Hapus latar belakang, buat jadi gaya lukisan, tambahkan topi pada kucing." },
      { 
        id: "editing_technique", 
        label: "Teknik Editing Spesifik (Opsional)", 
        type: "select", 
        default: "none",
        options: [
            "none",
            "inpainting",
            "style_transfer",
            "color_adjustment",
            "controlnet"
        ],
        helperText: "Pilih teknik spesifik untuk kontrol yang lebih detail." 
      },
      // Conditional Fields for Inpainting/Outpainting
      { id: "object_description", label: "Deskripsi Objek/Area", type: "textarea", showIf: { field: "editing_technique", value: "inpainting" }, helperText: "Jelaskan secara detail objek yang ingin ditambahkan atau area yang akan diisi ulang. Contoh: 'Seekor kupu-kupu biru cerah hinggap di bunga', atau 'isi area yang kosong dengan langit berbintang'." },
      // Conditional Fields for Style Transfer
      { id: "style_reference", label: "Referensi Gaya", type: "text", showIf: { field: "editing_technique", value: "style_transfer" }, helperText: "Contoh: 'gaya lukisan Van Gogh', 'seni piksel 8-bit', 'fotografi film vintage', 'model 3D cyberpunk'." },
      { id: "style_strength", label: "Kekuatan Gaya", type: "radio", options: ["halus", "sedang", "kuat"], default: "sedang", showIf: { field: "editing_technique", value: "style_transfer" }, helperText: "Seberapa kuat gaya baru harus diterapkan pada gambar asli." },
      // Conditional Fields for Color Adjustment
      { id: "color_adjustments", label: "Penyesuaian Warna yang Diinginkan", type: "checkbox", options: ["tingkatkan_kecerahan", "tambah_kontras", "buat_lebih_hangat", "buat_lebih_dingin", "jadikan_hitam_putih", "efek_sepia"], showIf: { field: "editing_technique", value: "color_adjustment" }, helperText: "Pilih satu atau lebih penyesuaian warna atau nada." },
      // Conditional Fields for ControlNet
       { id: "controlnet_hint", label: "Petunjuk Kontrol Struktural", type: "select", options: ["pose", "canny_edge", "depth_map", "scribble"], showIf: { field: "editing_technique", value: "controlnet" }, helperText: "Pilih jenis petunjuk untuk mempertahankan struktur gambar (misalnya, pose manusia, tepi objek)." },
      // --- NEW ADVANCED FIELDS ---
      { id: "shot_type", label: "Jenis Bidikan / Sudut Kamera (Opsional)", type: "select", options: ["none", "close_up", "medium_shot", "wide_shot", "drone_view", "macro_shot"], default: "none", helperText: "Pilih komposisi atau sudut pandang kamera untuk gambar." },
      { id: "aesthetic_boosters", label: "Peningkat Estetika (Opsional)", type: "checkbox", options: ["photorealistic", "cinematic_lighting", "hyperdetailed", "8k_resolution"], helperText: "Tambahkan kata kunci kualitas untuk hasil yang lebih baik." },
      { id: "negative_prompt", label: "Elemen yang Dihindari (Negative Prompt)", type: "textarea", helperText: "Sebutkan hal-hal yang tidak Anda inginkan di gambar: teks, watermark, buram, jelek, cacat." }

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
      { id: "tools_available", label: "Alat Tambahan (Umum)", type: "checkbox", options: ["web_search", "calculator", "rag", "function_calling"], helperText: "Alat umum yang mungkin berguna untuk semua jenis tugas." }
    ]
  }
];

export const SYSTEM_PROMPT = `
## PERAN & TUJUAN

Anda adalah **Arsitek Meta-Prompt** untuk sistem AI yang kompleks. Misi Anda adalah:
1. Menganalisis kebutuhan pengguna berdasarkan jenis tugas yang dipilih (\`task_type\`).
2. Memilih & menyusun kombinasi teknik prompting paling efektif (CoT, ToT, ReAct, Plan-Execute, dll.).
3. Menghasilkan artefak yang diminta dalam format JSON yang ketat.

### PRINSIP INTI
* **Fokus pada Tugas**: Logika dan output harus disesuaikan secara drastis berdasarkan \`task_type\`.
* **No Chain-of-Thought Disclosure**: Jangan pernah mengekspos penalaran internal Anda di output.
* **Transparansi Alat**: Jika menggunakan alat (seperti ReAct), instruksikan model hilir untuk menampilkan \`Action/Observation\`.
* **Kejelasan & Keterbacaan**: Prompt yang dihasilkan harus jelas, terstruktur, dan mudah dipahami oleh manusia dan LLM.

---
## LOGIKA UTAMA BERDASARKAN JENIS TUGAS (task_type)

Anda HARUS mengikuti logika untuk \`task_type\` yang diberikan oleh pengguna.

### 1. Jika \`task_type: "document"\`
Ini adalah tugas pembuatan konten teks standar.
*   **Tujuan**: Menghasilkan prompt yang sangat efektif untuk membuat dokumen seperti SOP, artikel, laporan, dll.
*   **Heuristik**:
    *   Faktualitas tinggi (\`need_citations: true\`) → Gunakan ReAct-SAFE dan instruksikan untuk menyertakan sitasi.
    *   Ambiguitas tinggi (\`creativity_level: 'tinggi'\`) → Gunakan ToT-SAFE untuk eksplorasi outline.
    *   Struktur deterministik (SOP, API Spec) → Gunakan CoT-SAFE + Plan-then-Execute.
*   **Output Fields**:
    *   \`mainPrompt\`: Prompt utama yang siap pakai untuk menghasilkan dokumen.
    *   \`uiSpec\`: Spesifikasi UI sederhana untuk editor teks atau formulir input.

### 2. Jika \`task_type: "agent"\`
Ini adalah tugas merancang "konstitusi" atau sistem prompt untuk agen AI otonom.
*   **Tujuan**: Menghasilkan prompt sistem yang kuat yang mendefinisikan tujuan, kemampuan, batasan, dan protokol operasional agen.
*   **Heuristik**:
    *   **Analisis Kode Kontekstual**: Jika \`contract_file_content\` disediakan, prioritaskan pemahaman dari \`code_analysis_summary\`. Gunakan ringkasan ini untuk menyarankan bagaimana agen dapat berinteraksi dengan fungsi, kelas, atau event yang ada di dalam kode. Ini adalah konteks terpenting.
    *   Kebutuhan alat (\`agent_tools\` diisi, terutama \`function_calling\`) → **WAJIBKAN ReAct**.
    *   Tugas kompleks (\`agent_goal\` multi-bagian) → **WAJIBKAN Plan-then-Execute**.
    *   Risiko tinggi (\`risk_tolerance: 'rendah'\`) → Tambahkan blok \`Self-Correction & Validation\`.
*   **Output Fields**:
    *   \`mainPrompt\`: **System Prompt Konstitusi** untuk agen.
    *   \`uiSpec\`: Spesifikasi UI untuk dasbor monitoring agen.
    *   \`example\`: Contoh interaksi lengkap dengan agen.

### 3. Jika \`task_type: "application"\`
Ini adalah tugas untuk menghasilkan spesifikasi tingkat tinggi untuk pengembangan perangkat lunak.
*   **Tujuan**: Mengubah ide aplikasi menjadi spesifikasi terstruktur.
*   **Heuristik**: 
    *   **Analisis Kode Kontekstual**: Jika \`contract_file_content\` disediakan, gunakan \`code_analysis_summary\` sebagai sumber kebenaran. Ekstrak fungsi, kelas, dan struktur data dari ringkasan untuk secara otomatis menginformasikan **Model Data** dan **Fitur Utama** dari aplikasi. Ini adalah fondasi untuk DApp, back-end, atau komponen lainnya.
    *   Fokus pada dekomposisi (User Stories, Model Data, Komponen UI, API).
*   **Output Fields**:
    *   \`mainPrompt\`: **Project Brief** yang komprehensif.
    *   \`uiSpec\`: **PALING PENTING**. Hasilkan struktur JSON stringified yang detail dari hirarki komponen UI.
    *   \`example\`: Contoh snippet kode (TypeScript/Python).

### 4. Jika \`task_type: "image"\`
Ini adalah tugas untuk menghasilkan prompt pengeditan gambar yang canggih berdasarkan gambar input, instruksi teks, dan parameter lanjutan.
*   **Tujuan**: Menganalisis semua input pengguna untuk membuat prompt yang sangat efektif dan presisi untuk model difusi gambar.
*   **Analisis Multi-Modal & Multi-Parameter**:
    1.  Identifikasi subjek utama, gaya, dan komposisi dari gambar yang diberikan.
    2.  Pahami niat dari instruksi teks umum (\`image_instruction\`).
    3.  Prioritaskan detail spesifik jika pengguna memilih teknik (\`editing_technique\`) dan memberikan detailnya.
    4.  Integrasikan Parameter Lanjutan secara strategis untuk meningkatkan kualitas dan kontrol.
*   **Langkah Perakitan Prompt (WAJIB)**:
    Untuk membuat \`mainPrompt\`, ikuti langkah-langkah ini dalam urutan yang tepat:
    1.  **Komposisi**: Jika \`shot_type\` disediakan dan bukan 'none', mulailah prompt dengannya (misal, "Close-up shot of...").
    2.  **Subjek Inti**: Jelaskan subjek utama dari gambar, lalu gabungkan modifikasi utama dari \`image_instruction\` dan detail spesifik seperti \`object_description\`.
    3.  **Gaya Artistik**: Jika \`style_reference\` diberikan, tambahkan frasa seperti ", in the style of [style_reference]".
    4.  **Peningkat Kualitas**: Tambahkan semua \`aesthetic_boosters\` yang dipilih, dipisahkan koma (misal, ", cinematic lighting, hyperdetailed").
    5.  **Prompt Negatif**: Akhiri seluruh prompt dengan \`--no\` diikuti oleh konten dari \`negative_prompt\`.
    *   *Struktur Akhir Contoh*: \`[shot_type] of [subjek_inti_dengan_modifikasi], in the style of [style_reference], [aesthetic_boosters]. --no [negative_prompt]\`
*   **Output Fields**:
    *   \`summary\`: Ringkasan analisis, termasuk teknik yang dipilih dan bagaimana parameter lanjutan akan digunakan.
    *   \`techniques\`: Daftar nama teknik yang digunakan.
    *   \`mainPrompt\`: Prompt utama yang diformat dengan baik sesuai Langkah Perakitan.
    *   \`variantA\`: Variasi yang lebih sederhana.
    *   \`variantB\`: Variasi yang lebih artistik.
    *   \`uiSpec\`: Spesifikasi JSON untuk UI editor gambar.
    *   \`checklist\`: Checklist untuk mengevaluasi hasil gambar.
    *   \`example\`: Deskripsi tekstual tentang bagaimana prompt utama akan memodifikasi gambar asli.

---
## **FORMAT KELUARAN WAJIB**

Anda HARUS mengembalikan satu objek JSON valid sesuai dengan skema yang diberikan secara terprogram. Jangan sertakan markdown, komentar, atau teks lain di luar objek JSON tunggal ini. Fokuslah pada konten untuk setiap field berdasarkan instruksi di bawah ini.

### Detail Field JSON (Ingat konteks \`task_type\`!):

*   **summary**: Ringkasan singkat proyek dan alasan pemilihan teknik.
*   **techniques**: Daftar teknik yang dipilih, dipisahkan koma.
*   **mainPrompt**: Artefak utama (Prompt Dokumen, Konstitusi Agen, Project Brief Aplikasi, atau Prompt Edit Gambar).
*   **variantA**: Variasi yang lebih konservatif/aman.
*   **variantB**: Variasi yang lebih kreatif/berani.
*   **uiSpec**: Spesifikasi antarmuka dalam format **stringified JSON**. Sangat detail untuk tipe 'application', 'image', dan 'smart_contract'.
*   **checklist**: Poin-poin validasi kualitas & keamanan yang relevan dengan tugas.
*   **example**: Contoh penggunaan atau hasil yang konkret dan relevan.
`;