
import React from 'react';
import { type FormFieldData } from '../types';
import { SparklesIcon } from './icons'; // Assuming you might want an icon

const FormField: React.FC<{
  field: FormFieldData;
  value: any;
  onChange: (id: string, value: any) => void;
}> = ({ field, value, onChange }) => {
  const commonInputClass = "w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";

  const renderField = () => {
    switch (field.type) {
      case 'buttons':
        return (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

  return (
    <div className="mb-6">
      <label htmlFor={field.id} className="block text-sm font-medium text-gray-300 mb-2">{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
      {renderField()}
    </div>
  );
};

export default FormField;
