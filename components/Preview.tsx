import React, { useState, useCallback } from 'react';
import { type ParsedOutput } from '../types';
import { CopyIcon, CheckIcon, ChevronDownIcon } from './icons';

interface PreviewProps {
  data: ParsedOutput;
}

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
      <pre className="p-4 text-sm text-gray-200 overflow-x-auto">
        <code className={`language-${language}`}>{content}</code>
      </pre>
    </div>
  );
};

const AccordionItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left font-semibold text-indigo-300 hover:bg-gray-800/50 transition"
      >
        <span>{title}</span>
        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-4 bg-gray-900">{children}</div>}
    </div>
  );
};

const Preview: React.FC<PreviewProps> = ({ data }) => {
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

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <AccordionItem title="Variasi A (Konservatif)">
            <p className="text-gray-300 whitespace-pre-wrap">{data.variantA}</p>
        </AccordionItem>
        <AccordionItem title="Variasi B (Kreatif)">
            <p className="text-gray-300 whitespace-pre-wrap">{data.variantB}</p>
        </AccordionItem>
      </div>

      <CodeBlock title="UI Spec (JSON)" content={data.uiSpec} language="json" />

      <div>
        <h3 className="text-xl font-semibold mb-2 text-gray-300">Checklist Kualitas & Keamanan</h3>
        <div className="bg-gray-800 p-4 rounded-lg text-gray-400 whitespace-pre-wrap">
          {data.checklist}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2 text-gray-300">Contoh Isian → Hasil</h3>
        <div className="bg-gray-800 p-4 rounded-lg text-gray-400 whitespace-pre-wrap">
          {data.example}
        </div>
      </div>
    </div>
  );
};

export default Preview;