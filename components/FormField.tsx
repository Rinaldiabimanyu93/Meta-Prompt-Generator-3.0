

import React, { useState, useEffect, useCallback } from 'react';
import { type FormFieldData } from '../types';
import { Sparkles as SparklesIcon, Upload as UploadIcon, XCircle as XCircleIcon, Check as CheckIcon } from 'lucide-react';

// Component for Generic File Upload, for code files etc.
const FileUploadField: React.FC<{
  value: File | null;
  onChange: (file: File | null) => void;
  helperText?: string;
  accept?: string;
}> = ({ value, onChange, helperText, accept }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    onChange(file || null);
  };
  
  const handleRemoveFile = () => {
    onChange(null);
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div>
        <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
        />
        {!value ? (
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 w-full px-4 py-2 rounded-md transition cursor-pointer border-2 border-dashed border-gray-600 hover:border-indigo-500 hover:bg-gray-700/50"
            >
                <UploadIcon className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">Pilih File</span>
            </button>
        ) : (
             <div className="flex items-center justify-between bg-gray-700/80 p-3 rounded-md text-sm">
                <span className="text-gray-200 truncate" title={value.name}>{value.name}</span>
                <button type="button" onClick={handleRemoveFile} className="text-gray-400 hover:text-red-400 ml-2 flex-shrink-0">
                    <XCircleIcon className="h-5 w-5" />
                </button>
            </div>
        )}
         {helperText && <p className="text-xs text-gray-500 mt-2">{helperText}</p>}
    </div>
  );
};


// Component for Image Upload, integrated here to avoid creating new files
const ImageUploadField: React.FC<{
  value: File | null;
  onChange: (file: File | null) => void;
  helperText?: string;
}> = ({ value, onChange, helperText }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(value);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value]);

  const handleFile = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      onChange(file);
    } else if (file) {
      // Simple error handling for non-image files
      alert('Hanya file gambar yang diperbolehkan.');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };
  
  const handleRemoveImage = () => {
    onChange(null);
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors duration-200 ${isDragging ? 'border-indigo-500 bg-gray-700/50' : 'border-gray-600'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      {preview ? (
        <>
            <img src={preview} alt="Pratinjau" className="mx-auto max-h-48 rounded-md" />
            <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1 bg-gray-800/80 rounded-full text-gray-400 hover:text-white hover:bg-red-500/80 transition-all"
                aria-label="Hapus gambar"
            >
                <XCircleIcon className="w-6 h-6" />
            </button>
        </>
      ) : (
        <div className="flex flex-col items-center">
            <UploadIcon className="w-10 h-10 text-gray-500" />
            <p className="mt-2 text-gray-400">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-semibold text-indigo-400 hover:text-indigo-300 focus:outline-none"
                >
                    Unggah file
                </button>
                {' '}atau seret ke sini
            </p>
            {helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
        </div>
      )}
    </div>
  );
};


const FormField: React.FC<{
  field: FormFieldData;
  value: any;
  onChange: (id: string, value: any) => void;
}> = ({ field, value, onChange }) => {
  const commonInputClass = "input-professional";

  const renderField = () => {
    switch (field.type) {
      case 'readonly':
        if (!value) return null; 
        return (
           <div className="w-full bg-slate-900/50 border border-slate-700/20 rounded-xl p-5 text-sm text-slate-500 font-medium italic leading-relaxed shadow-inner">
              {value}
           </div>
        );
      case 'file_upload':
        return (
          <FileUploadField
             value={value as File | null}
             onChange={(file) => onChange(field.id, file)}
             helperText={field.helperText}
          />
        );
      case 'image_upload':
        return (
          <ImageUploadField 
             value={value as File | null}
             onChange={(file) => onChange(field.id, file)}
             helperText={field.helperText}
          />
        )
      case 'buttons':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field.options && Array.isArray(field.options) && field.options.map(opt => {
              if (typeof opt === 'string') return null;
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(field.id, opt.value)}
                  className={`p-6 rounded-3xl border-2 text-left transition-all duration-500 flex flex-col h-full active:scale-[0.98] group relative overflow-hidden ${
                    isSelected
                      ? 'bg-indigo-500/10 border-indigo-500/80 shadow-2xl shadow-indigo-950/40 ring-1 ring-indigo-500/20'
                      : 'bg-slate-900/40 border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-800/40 shadow-lg'
                  }`}
                >
                  <div className={`font-black text-xl tracking-tighter mb-2 ${isSelected ? 'text-white' : 'text-slate-200'}`}>{opt.label}</div>
                  <div className={`text-sm tracking-tight leading-relaxed flex-grow font-medium ${isSelected ? 'text-indigo-200/70' : 'text-slate-500 group-hover:text-slate-400'}`}>{opt.description}</div>
                  {isSelected && (
                    <div className="mt-6 flex justify-end">
                      <div className="bg-indigo-500 p-1.5 rounded-full shadow-lg shadow-indigo-500/40">
                        <CheckIcon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      case 'textarea':
        return (
          <textarea
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            required={field.required}
            className={`${commonInputClass} h-40 resize-none text-lg font-medium`}
            placeholder={field.helperText}
          />
        );
      case 'text':
        return (
          <input
            type="text"
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            required={field.required}
            className={`${commonInputClass} text-lg font-medium`}
            placeholder={field.helperText}
          />
        );
      case 'select':
        return (
          <div className="relative group">
            <select
              id={field.id}
              value={value || field.default}
              onChange={(e) => onChange(field.id, e.target.value)}
              className={`${commonInputClass} appearance-none cursor-pointer pr-12 font-bold text-slate-300`}
            >
              {field.options?.map(opt => <option key={String(opt)} value={String(opt)} className="bg-slate-900">{String(opt)}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        );
      case 'toggle':
        const isChecked = value === true;
        return (
          <label htmlFor={field.id} className="flex items-center cursor-pointer group w-fit">
            <div className="relative">
              <input 
                type="checkbox" 
                id={field.id} 
                className="sr-only" 
                checked={isChecked}
                onChange={(e) => onChange(field.id, e.target.checked)}
              />
              <div className={`block w-16 h-9 rounded-full transition-all duration-500 ${isChecked ? 'bg-indigo-500 shadow-xl shadow-indigo-900/50 ring-1 ring-white/20' : 'bg-slate-800 border border-slate-700'}`}></div>
              <div className={`dot absolute left-1.5 top-1.5 bg-white w-6 h-6 rounded-full transition-all duration-500 transform ${isChecked ? 'translate-x-7 scale-110' : 'scale-90'} shadow-xl`}></div>
            </div>
          </label>
        );
      case 'radio':
        return (
          <div className="flex flex-wrap gap-8 mt-2">
            {field.options?.map(opt => (
              <label key={String(opt)} className="flex items-center space-x-4 cursor-pointer group bg-slate-900/40 px-5 py-3 rounded-2xl border border-transparent hover:border-slate-800 transition-all">
                <div className="relative flex items-center justify-center">
                  <input
                    type="radio"
                    name={field.id}
                    value={String(opt)}
                    checked={value === String(opt)}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className="sr-only"
                  />
                  <div className={`h-6 w-6 rounded-full border-2 transition-all duration-300 ${value === String(opt) ? 'border-indigo-500 bg-indigo-500/20' : 'border-slate-700 bg-slate-900'}`}>
                    {value === String(opt) && <div className="absolute inset-1.5 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/60"></div>}
                  </div>
                </div>
                <span className={`capitalize font-black text-xs tracking-[0.1em] ${value === String(opt) ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{String(opt)}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {field.options?.map(opt => (
              <label key={String(opt)} className={`flex items-center space-x-4 p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer group ${
                (value as string[] || []).includes(String(opt))
                  ? 'bg-indigo-500/10 border-indigo-500/60 text-white shadow-xl shadow-indigo-950/20'
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-500 hover:border-indigo-500/30'
              }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    (value as string[] || []).includes(String(opt)) ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-950 border-slate-700'
                }`}>
                    {(value as string[] || []).includes(String(opt)) && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  value={String(opt)}
                  checked={(value as string[] || []).includes(String(opt))}
                  onChange={(e) => {
                    const currentValues = (value as string[] || []);
                    const newValues = e.target.checked
                      ? [...currentValues, String(opt)]
                      : currentValues.filter(v => v !== String(opt));
                    onChange(field.id, newValues);
                  }}
                  className="sr-only"
                />
                <span className="capitalize font-black text-sm tracking-tight">{String(opt)}</span>
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const isVisible = !(field.type === 'readonly' && !value);
  if (!isVisible) return null;

  return (
    <div className="mb-14 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <label htmlFor={field.id} className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-1">{field.label}{field.required && <span className="text-indigo-400 ml-1.5">*</span>}</label>
      {renderField()}
       {field.type !== 'readonly' && field.helperText && <p className="text-[11px] text-slate-600 mt-4 italic px-2 font-medium leading-relaxed opacity-80">{field.helperText}</p>}
    </div>
  );
};


export default FormField;