import * as pdfjsLib from 'pdfjs-dist';

// Alternative: Access libraries from the global window object, loaded via <script> tags.
// This is a more robust approach in environments where ES module imports from CDNs can be unreliable.
declare global {
    interface Window {
        mammoth: any;
        JSZip: any;
        XLSX: any;
    }
}


// Konfigurasi worker untuk PDF.js. Ini penting agar pemrosesan PDF
// tidak memblokir thread utama UI, sehingga aplikasi tetap responsif.
// URL worker ini harus menunjuk ke file yang disediakan oleh CDN yang sama
// dengan library utama pdf.mjs.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.mjs`;

/**
 * Mengekstrak teks dari buffer file DOCX.
 * @param {ArrayBuffer} arrayBuffer - Konten file sebagai ArrayBuffer.
 * @returns {Promise<string>} Teks yang diekstrak.
 */
const getTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

/**
 * Mengekstrak teks dari buffer file PDF.
 * @param {ArrayBuffer} arrayBuffer - Konten file sebagai ArrayBuffer.
 * @returns {Promise<string>} Teks yang diekstrak.
 */
const getTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = '';
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // Menggunakan 'any' untuk item karena tipe dari library tidak diekspor dengan baik
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return fullText;
};

/**
 * Mengekstrak teks dari buffer file PPTX menggunakan JSZip.
 * Metode ini membaca konten teks dari setiap file XML slide.
 * @param {ArrayBuffer} arrayBuffer - Konten file sebagai ArrayBuffer.
 * @returns {Promise<string>} Teks yang diekstrak.
 */
const getTextFromPptx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files).filter(fileName => fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml'));

    // Urutkan slide secara numerik untuk memastikan urutan teks benar.
    slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)\.xml$/)![1], 10);
        const numB = parseInt(b.match(/(\d+)\.xml$/)![1], 10);
        return numA - numB;
    });
    
    let fullText = '';
    for (const slideFile of slideFiles) {
        const slideXml = await zip.files[slideFile].async('string');
        // Regex sederhana untuk mengekstrak teks dari tag <a:t> di dalam XML.
        const textNodes = slideXml.match(/<a:t>.*?<\/a:t>/g) || [];
        const slideText = textNodes.map(node => node.replace(/<a:t>(.*?)<\/a:t>/, '$1')).join(' ');
        fullText += slideText + '\n\n'; // Tambahkan newline ganda antar slide
    }

    return fullText.trim();
};

/**
 * Mengekstrak teks dari buffer file XLSX.
 * Metode ini mengonversi setiap sheet menjadi format seperti CSV dan menggabungkannya.
 * @param {ArrayBuffer} arrayBuffer - Konten file sebagai ArrayBuffer.
 * @returns {Promise<string>} Teks yang diekstrak.
 */
const getTextFromXlsx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const workbook = window.XLSX.read(arrayBuffer, { type: 'buffer' });
    let fullText = '';
    workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csvText = window.XLSX.utils.sheet_to_csv(sheet);
        fullText += `--- SHEET: ${sheetName} ---\n${csvText}\n\n`;
    });
    return fullText.trim();
};


/**
 * Mengekstrak teks dari file teks biasa (txt, md).
 * @param {File} file - Objek file.
 * @returns {Promise<string>} Konten file sebagai string.
 */
const getTextFromTxt = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca file teks.'));
        reader.readAsText(file);
    });
};

/**
 * Mem-parsing berbagai jenis file dan mengembalikan konten teksnya.
 * @param {File} file - File yang akan di-parsing.
 * @returns {Promise<string>} Promise yang resolve dengan teks yang diekstrak.
 */
export const parseFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    try {
        // Untuk file teks, kita tidak butuh arrayBuffer
        if (extension === 'txt' || extension === 'md') {
            return await getTextFromTxt(file);
        }

        const arrayBuffer = await file.arrayBuffer();
        switch (extension) {
            case 'pdf':
                return await getTextFromPdf(arrayBuffer);
            case 'docx':
                return await getTextFromDocx(arrayBuffer);
            case 'pptx':
                return await getTextFromPptx(arrayBuffer);
            case 'xlsx':
                return await getTextFromXlsx(arrayBuffer);
            default:
                throw new Error(`Tipe file .${extension} tidak didukung.`);
        }
    } catch (error) {
        console.error(`Error parsing .${extension} file:`, error);
        if (error instanceof Error) {
            throw new Error(`Gagal memproses ${file.name}: ${error.message}`);
        }
        throw new Error(`Gagal memproses file .${extension}. File mungkin rusak atau tidak didukung.`);
    }
};