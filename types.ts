
export interface FormFieldData {
  id: string;
  label: string;
  type: 'textarea' | 'text' | 'select' | 'toggle' | 'radio' | 'checkbox' | 'readonly' | 'codeblock' | 'accordion' | 'buttons';
  required?: boolean;
  options?: string[];
  default?: string | boolean;
  helperText?: string;
}

export interface StepData {
  id: string;
  title: string;
  fields: FormFieldData[];
}

export interface FormData {
  [key: string]: string | boolean | string[];
}

export interface ParsedOutput {
  summary: string;
  mainPrompt: string;
  variantA: string;
  variantB: string;
  uiSpec: string; // Keep as string for display
  checklist: string;
  example: string;
  techniques: string;
}
