import React, { useState, useCallback, useMemo } from 'react';
import { type ParsedOutput } from '../types';
import { CopyIcon, CheckIcon, ChevronDownIcon } from './icons';

interface PreviewProps {
  data: ParsedOutput;
  taskType: string;
}

// Access the 'marked' library from the global window object
declare global {
    interface Window {
        marked: any;
    }
}


// Komponen baru untuk merender markdown menjadi HTML yang ditata
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Membersihkan dan mengurai markdown.
  // 'gfm: true' untuk GitHub Flavored Markdown (tabel, dll.)
  // 'breaks: true' agar baris baru tunggal menjadi <br>
  const rawHtml = window.marked.parse(content, { gfm: true, breaks: true });

  // Menggunakan `dangerouslySetInnerHTML` aman di sini karena kontennya
  // berasal dari API Gemini yang kita kontrol, bukan input pengguna yang sewenang-wenang dari web.
  return (
    <div
      className="prose prose-invert prose-sm max-w-none text-gray-300
                 prose-headings:text-indigo-300 prose-a:text-indigo-400 prose-strong:text-gray-200
                 prose-ul:list-disc prose-ol:list-decimal prose-li:my-1
                 prose-blockquote:border-l-4 prose-blockquote:border-indigo-600 prose-blockquote:pl-4 prose-blockquote:italic
                 prose-code:bg-gray-700/80 prose-code:rounded prose-code:px-1.5 prose-code:py-1 prose-code:text-sm prose-code:font-mono
                 prose-pre:bg-gray-900/50 prose-pre:p-4 prose-pre:rounded-md"
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
};

const CodeBlock: React.FC<{ title: string; content: string; language?: string }> = ({ title, content, language = 'text' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden my-4">
      <div className="flex justify-between items-center p-3 bg-gray-700/50">
        <h3 className="font-semibold text-gray-300">{title}</h3>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 text-sm bg-gray-600 hover:bg-gray-500 text-gray-200 px-3 py-1 rounded-md transition"
          aria-label={`Copy ${title}`}
        >
          {copied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <CopyIcon className="h-4 w-4" />}
          <span>{copied ? 'Disalin!' : 'Salin'}</span>
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-200 whitespace-pre-wrap break-words">
        <code className={`language-${language}`}>{content}</code>
      </pre>
    </div>
  );
};

const AccordionItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left font-semibold text-indigo-300 hover:bg-gray-800/50 transition"
      >
        <span>{title}</span>
        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-4 bg-gray-800/40">{children}</div>}
    </div>
  );
};

const Preview: React.FC<PreviewProps> = ({ data, taskType }) => {
  // Menggunakan useMemo untuk memformat JSON hanya sekali saat data berubah
  const formattedUiSpec = useMemo(() => {
    try {
      const parsed = JSON.parse(data.uiSpec);
      return JSON.stringify(parsed, null, 2); // Pretty-print dengan 2 spasi indentasi
    } catch (e) {
      // Jika parsing gagal, kembalikan string aslinya
      return data.uiSpec;
    }
  }, [data.uiSpec]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-indigo-400 border-b border-gray-700 pb-2">Hasil Generator</h2>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-300 mb-2">Ringkasan & Alasan</h3>
          <p className="text-gray-400 whitespace-pre-wrap">{data.summary}</p>
           <p className="mt-4 text-sm font-medium text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full inline-block">
            Teknik Terpilih: {data.techniques}
          </p>
        </div>
      </div>

      <CodeBlock title="Prompt Utama (Siap Tempel)" content={data.mainPrompt} />

      {taskType === 'image' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 -my-4">
          <CodeBlock title="Variasi A (Konservatif)" content={data.variantA} />
          <CodeBlock title="Variasi B (Kreatif)" content={data.variantB} />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <AccordionItem title="Variasi A (Konservatif)">
              <MarkdownRenderer content={data.variantA} />
          </AccordionItem>
          <AccordionItem title="Variasi B (Kreatif)">
              <MarkdownRenderer content={data.variantB} />
          </AccordionItem>
        </div>
      )}


      <CodeBlock title="UI Spec (JSON)" content={formattedUiSpec} language="json" />

      <div>
        <h3 className="text-xl font-semibold mb-2 text-gray-300">Checklist Kualitas & Keamanan</h3>
        <div className="bg-gray-800 p-4 rounded-lg">
          <MarkdownRenderer content={data.checklist} />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2 text-gray-300">Contoh Isian → Hasil</h3>
        <div className="bg-gray-800 p-4 rounded-lg">
          <MarkdownRenderer content={data.example} />
        </div>
      </div>
    </div>
  );
};

export default Preview;