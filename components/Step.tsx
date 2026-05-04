import React from 'react';
import { type StepData, type FormData } from '../types';
import FormField from './FormField';

interface StepProps {
  stepData: StepData;
  formData: FormData;
  onFormChange: (id: string, value: any) => void;
}

const Step: React.FC<StepProps> = ({ stepData, formData, onFormChange }) => {
  return (
    <div className="animate-in fade-in slide-in-from-left-8 duration-700">
      <div className="mb-10 relative">
        <h2 className="text-4xl font-black text-white tracking-tighter mb-1">{stepData.title}</h2>
        <div className="h-1.5 w-12 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      </div>
      
      <div className="space-y-2">
        {stepData.fields.map(field => {
          // Logika visibilitas bidang sekarang ditangani di sini, di dalam komponen Step.
          const isVisible = !field.showIf || formData[field.showIf.field] === field.showIf.value;
          if (!isVisible) {
            return null;
          }
          return (
            <FormField
              key={field.id}
              field={field}
              value={formData[field.id]}
              onChange={onFormChange}
            />
          );
        })}
      </div>
    </div>
  );
};


export default Step;