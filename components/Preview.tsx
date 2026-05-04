import React, { useState, useCallback, useMemo } from 'react';
import { type ParsedOutput } from '../types';
import { Copy as CopyIcon, Check as CheckIcon, ChevronDown as ChevronDownIcon } from 'lucide-react';

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

  return (
    <div
      className="prose-premium"
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
    <div className="bg-gray-800 rounded-xl overflow-hidden my-8 shadow-xl border border-gray-700/50">
      <div className="flex justify-between items-center px-6 py-4 bg-gray-700/40 border-b border-gray-700">
        <h3 className="font-bold text-gray-200 tracking-wide uppercase text-sm">{title}</h3>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all active:scale-95 shadow-lg"
          aria-label={`Copy ${title}`}
        >
          {copied ? <CheckIcon className="h-4 w-4 text-green-200" /> : <CopyIcon className="h-4 w-4" />}
          <span className="font-medium">{copied ? 'Berhasil Disalin' : 'Salin Prompt'}</span>
        </button>
      </div>
      <pre className="p-8 text-sm text-gray-200 whitespace-pre-wrap break-words leading-loose font-mono bg-gray-900/20">
        <code className={`language-${language}`}>{content}</code>
      </pre>
    </div>
  );
};

const AccordionItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-700/50 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-6 py-5 text-left font-bold text-indigo-300 hover:bg-indigo-500/5 transition-all"
      >
        <span className="text-lg">{title}</span>
        <ChevronDownIcon className={`h-6 w-6 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : 'text-gray-500'}`} />
      </button>
      {isOpen && (
        <div className="px-8 py-8 bg-gray-800/60 border-t border-gray-700/30 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
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
    <div className="space-y-16 pb-20">
      <div className="card-premium overflow-hidden ring-1 ring-white/10">
        <div className="bg-indigo-600/10 px-10 py-8 border-b border-indigo-500/10">
          <h2 className="text-4xl font-black text-white tracking-tighter">Forge Result</h2>
          <p className="text-indigo-400 font-bold text-xs mt-2 uppercase tracking-[0.2em]">Engineered via RTFD Framework v2.1</p>
        </div>
        
        <div className="p-10 space-y-12">
          <div className="bg-slate-950/50 p-10 rounded-[2rem] border border-slate-800/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
            <h3 className="font-black text-slate-500 mb-6 flex items-center space-x-4 uppercase text-[10px] tracking-[0.3em]">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
              <span>Strategic Intelligence</span>
            </h3>
            <p className="text-slate-200 leading-relaxed text-xl font-medium tracking-tight">{data.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {data.techniques.split(',').map((tech, idx) => (
                <span key={idx} className="text-[10px] font-black text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 uppercase tracking-widest">
                  {tech.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CodeBlock title="Master Core Prompt" content={data.mainPrompt} />

      {taskType === 'image' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <CodeBlock title="Variant A: High Contrast" content={data.variantA} />
          <CodeBlock title="Variant B: Deep Aesthetic" content={data.variantB} />
        </div>
      ) : (
        <div className="card-premium overflow-hidden border border-slate-800/50 ring-1 ring-white/10 shadow-2xl">
          <AccordionItem title="Variant Path A: Technical Precision">
              <MarkdownRenderer content={data.variantA} />
          </AccordionItem>
          <AccordionItem title="Variant Path B: Creative Narrative">
              <MarkdownRenderer content={data.variantB} />
          </AccordionItem>
        </div>
      )}

      <CodeBlock title="Integration UI Manifest (JSON)" content={formattedUiSpec} language="json" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="card-premium p-10 ring-1 ring-white/5">
          <h3 className="text-2xl font-black mb-8 text-indigo-400 tracking-tighter uppercase">Quality Matrix</h3>
          <MarkdownRenderer content={data.checklist} />
        </div>

        <div className="card-premium p-10 ring-1 ring-white/5">
          <h3 className="text-2xl font-black mb-8 text-emerald-400 tracking-tighter uppercase">Simulated Neural Output</h3>
          <MarkdownRenderer content={data.example} />
        </div>
      </div>
    </div>
  );
};


export default Preview;