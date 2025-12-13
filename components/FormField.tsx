

import React, { useState, useEffect, useCallback } from 'react';
import { type FormFieldData } from '../types';
import { SparklesIcon, UploadIcon, XCircleIcon } from './icons';

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
  const commonInputClass = "w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";

  const renderField = () => {
    switch (field.type) {
      case 'readonly':
        if (!value) return null; // Don't render if there's no value
        return (
           <div className="w-full bg-gray-800/60 border border-gray-700 rounded-md p-3 text-sm text-gray-400 italic">
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
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field.options && Array.isArray(field.options) && field.options.map(opt => {
              if (typeof opt === 'string') return null; // Should not happen with new type
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(field.id, opt.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all duration-200 transform hover:scale-105 ${
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-500 shadow-lg'
                      : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="font-bold text-white">{opt.label}</div>
                  <div className="text-sm text-gray-400 mt-1">{opt.description}</div>
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
            className={`${commonInputClass} h-24`}
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
            className={commonInputClass}
            placeholder={field.helperText}
          />
        );
      case 'select':
        return (
          <select
            id={field.id}
            value={value || field.default}
            onChange={(e) => onChange(field.id, e.target.value)}
            className={commonInputClass}
          >
            {field.options?.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
          </select>
        );
      case 'toggle':
        const isChecked = value === true;
        return (
          <label htmlFor={field.id} className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                id={field.id} 
                className="sr-only" 
                checked={isChecked}
                onChange={(e) => onChange(field.id, e.target.checked)}
              />
              <div className={`block w-14 h-8 rounded-full transition ${isChecked ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${isChecked ? 'translate-x-6' : ''}`}></div>
            </div>
          </label>
        );
      case 'radio':
        return (
          <div className="flex space-x-4">
            {field.options?.map(opt => (
              <label key={String(opt)} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={String(opt)}
                  checked={value === String(opt)}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="form-radio h-4 w-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                />
                <span className="capitalize">{String(opt)}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="flex flex-col space-y-2">
            {field.options?.map(opt => (
              <label key={String(opt)} className="flex items-center space-x-2 cursor-pointer">
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
                  className="form-checkbox h-4 w-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="capitalize">{String(opt)}</span>
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
    <div className="mb-6">
      <label htmlFor={field.id} className="block text-sm font-medium text-gray-300 mb-2">{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
      {renderField()}
       {field.type !== 'readonly' && field.helperText && <p className="text-xs text-gray-500 mt-2">{field.helperText}</p>}
    </div>
  );
};

export default FormField;