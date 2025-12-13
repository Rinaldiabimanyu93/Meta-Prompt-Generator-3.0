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
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-indigo-400 border-b border-gray-700 pb-2">{stepData.title}</h2>
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
  );
};

export default Step;