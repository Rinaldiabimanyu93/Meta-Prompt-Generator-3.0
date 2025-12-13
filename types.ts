
export interface FormFieldData {
  id: string;
  label: string;
  type: 'textarea' | 'text' | 'select' | 'toggle' | 'radio' | 'checkbox' | 'readonly' | 'codeblock' | 'accordion' | 'buttons' | 'image_upload' | 'file_upload';
  required?: boolean;
  options?: string[] | { value: string; label: string; description: string; }[];
  default?: string | boolean;
  helperText?: string;
  showIf?: { field: string; value: string };
}

export interface StepData {
  id: string;
  title: string;
  fields: FormFieldData[];
  showIf?: { field: string; value: string };
}

export interface FormData {
  [key: string]: string | boolean | string[] | File | null;
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

export interface CodeAnalysisResult {
  summary: string;
  functions: string[];
  classes: string[];
  events?: string[];
  dataStructures?: string[];
}
