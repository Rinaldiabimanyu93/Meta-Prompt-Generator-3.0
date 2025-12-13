
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FORM_STEPS } from './constants';
import { type FormData, type ParsedOutput, type CodeAnalysisResult, type FormFieldData } from './types';
import { generateMetaPrompt, extractInfoFromDocument, extractInfoWithInstruction, extractInfoFromIdea, detectTaskType, detectPreferences, analyzeCode } from './services/geminiService';
import { parseFile } from './services/fileParser';
import Step from './components/Step';
import Preview from './components/Preview';
import Placeholder from './components/Placeholder';
import SkeletonPreview from './components/SkeletonPreview';
import { LoaderIcon, AlertTriangleIcon, SparklesIcon, UploadIcon, PencilIcon, XCircleIcon, CodeBracketIcon } from './components/icons';
// FIX: Import FormField component to resolve 'Cannot find name' error.
import FormField from './components/FormField';

// Initial state creator
const createInitialState = (): FormData => {
    const initialState: FormData = {};
    FORM_STEPS.forEach(step => {
      step.fields.forEach(field => {
        // A field should be visible by default if it has no `showIf` condition.
        const fieldShouldBeVisible = !field.showIf;

        if (field.type === 'checkbox' && fieldShouldBeVisible) {
          initialState[field.id] = field.default ?? [];
        } else if ((field.type === 'image_upload' || field.type === 'file_upload') && fieldShouldBeVisible) {
          initialState[field.id] = null;
        } else if (fieldShouldBeVisible) {
          initialState[field.id] = field.default ?? '';
        } else {
          // For conditional fields, still initialize them to their default, or an appropriate empty state.
           switch (field.type) {
                case 'checkbox':
                    initialState[field.id] = field.default ?? [];
                    break;
                case 'toggle':
                    initialState[field.id] = field.default ?? false;
                    break;
                case 'image_upload':
                case 'file_upload':
                     initialState[field.id] = null;
                     break;
                default:
                    initialState[field.id] = field.default ?? '';
            }
        }
      });
    });
    return initialState;
};

type TaskType = 'document' | 'agent' | 'application' | 'image';

const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
          reject(new Error("Gagal mengonversi file ke base64."));
          return;
      }
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = error => reject(error);
  });
};

const isCodeFile = (file: File): boolean => {
    const codeExtensions = ['sol', 'js', 'ts', 'py', 'json'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    return !!extension && codeExtensions.includes(extension);
};


const App: React.FC = () => {
  // Optimization: Use lazy initialization for state to run createInitialState only once.
  const [formData, setFormData] = useState<FormData>(createInitialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ParsedOutput | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);

  // --- States for Auto-Fill Feature ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisInstruction, setAnalysisInstruction] = useState('');
  
  // CHANGED: Manage multiple text contexts instead of one string
  const [pastedContexts, setPastedContexts] = useState<string[]>([]);
  const [currentContextInput, setCurrentContextInput] = useState(''); 
  
  const [filesToAnalyze, setFilesToAnalyze] = useState<File[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ textForAnalysis: string, fileTextContent: string, hasFiles: boolean, hasInstruction: boolean, detectedTaskType: TaskType } | null>(null);
  const [autoFillCompleted, setAutoFillCompleted] = useState(false);
  
  // Ref to track previous task type to detect changes and clear form.
  const prevTaskTypeRef = useRef<string | boolean | string[] | File | null>(formData.task_type);

  // --- IMPROVEMENT: Robust file input handling using a ref ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OPTIMIZATION & BUG FIX: Dynamically generate task-specific fields to avoid manual updates.
  // This map is used to clear form fields when the task type changes.
  const taskSpecificFields = useMemo(() => {
    const map: Record<string, string[]> = {
      document: FORM_STEPS.find(s => s.id === 'document_details')?.fields.map(f => f.id) ?? [],
      agent: FORM_STEPS.find(s => s.id === 'agent_details')?.fields.map(f => f.id) ?? [],
      application: FORM_STEPS.find(s => s.id === 'application_details')?.fields.map(f => f.id) ?? [],
      image: FORM_STEPS.find(s => s.id === 'image_details')?.fields.map(f => f.id) ?? [],
    };
    return map;
  }, []);


  // Optimization & UX Fix: Clear task-specific fields when the task type changes.
  useEffect(() => {
    const currentTaskType = formData.task_type;
    const prevTaskType = prevTaskTypeRef.current;

    if (prevTaskType && prevTaskType !== currentTaskType) {
      const oldTaskType = prevTaskType as string;
      const fieldsToClear = taskSpecificFields[oldTaskType];

      if (fieldsToClear && fieldsToClear.length > 0) {
        setFormData(currentData => {
          const newData = { ...currentData };
          const initialDefaults = createInitialState();
          fieldsToClear.forEach(fieldId => {
            newData[fieldId] = initialDefaults[fieldId]; // Reset to default value
          });
           // Also clear derived data for contracts
          if (oldTaskType === 'agent' || oldTaskType === 'application') {
              newData['contract_file_content'] = '';
              newData['code_analysis_summary'] = '';
          }
          return newData;
        });
      }
    }
    // Update the ref for the next render
    prevTaskTypeRef.current = currentTaskType;
  }, [formData.task_type, taskSpecificFields]);


  const handleFormChange = useCallback((id: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [id]: value };
      const initialDefaults = createInitialState();
      
      // BUG FIX: Stale State Cleanup
      // Atomically check visibility and clear hidden fields within the same state update
      FORM_STEPS.forEach(step => {
        const isStepVisible = !step.showIf || newData[step.showIf.field] === step.showIf.value;
        if (!isStepVisible) {
          // If the entire step is hidden, reset all its fields
          step.fields.forEach(field => {
            if (newData[field.id] !== initialDefaults[field.id]) {
              newData[field.id] = initialDefaults[field.id];
            }
          });
        } else {
          // If the step is visible, check its individual fields
          step.fields.forEach(field => {
            const isFieldVisible = !field.showIf || newData[field.showIf.field] === field.showIf.value;
            if (!isFieldVisible && newData[field.id] !== initialDefaults[field.id]) {
              newData[field.id] = initialDefaults[field.id];
            }
          });
        }
      });

      return newData;
    });
  }, []);
  
  const parseAndCombineFiles = async (files: File[]): Promise<{ combinedText: string; failedFiles: string[] }> => {
    if (files.length === 0) return { combinedText: '', failedFiles: [] };

    const parsingPromises = files.map(file => 
      parseFile(file)
        .then(text => ({ status: 'fulfilled' as const, value: text, file }))
        .catch(error => ({ status: 'rejected' as const, reason: error, file }))
    );
      
    const results = await Promise.all(parsingPromises);

    const successfulTexts: string[] = [];
    const failedFiles: string[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successfulTexts.push(`--- Dokumen: ${result.file.name} ---\n${result.value}`);
      } else {
        failedFiles.push(result.file.name);
      }
    });

    const combinedText = successfulTexts.join('\n\n--- BATAS DOKUMEN ---\n\n');
    return { combinedText, failedFiles };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files;
    if (newFiles && newFiles.length > 0) {
      setFilesToAnalyze(prev => [...prev, ...Array.from(newFiles)]);
      setAnalysisError(null); // Clear previous errors on new file add
    }
  };
  
  const removeFile = (indexToRemove: number) => {
    setFilesToAnalyze(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // New function to handle adding text context
  const handleAddContext = () => {
    if (!currentContextInput.trim()) return;
    setPastedContexts(prev => [...prev, currentContextInput.trim()]);
    setCurrentContextInput('');
  };

  const removeContext = (indexToRemove: number) => {
    setPastedContexts(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleUploadButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const proceedWithExtraction = async (confirmedTaskType: TaskType) => {
      if (!analysisResult) return;
      
      setIsAnalyzing(true);
      setNeedsConfirmation(false);

      const { textForAnalysis, fileTextContent, hasFiles, hasInstruction } = analysisResult;
      const mergedData: Partial<FormData> = {};
      
      try {
          // Base extraction and preference detection
          const detectedPrefs = await detectPreferences(textForAnalysis);
          Object.assign(mergedData, detectedPrefs);
          
          let extractedData: Partial<FormData> | null = null;
          if (hasFiles && hasInstruction && confirmedTaskType !== 'image') {
            extractedData = await extractInfoWithInstruction(fileTextContent, analysisInstruction, confirmedTaskType);
          } else if (hasFiles && confirmedTaskType !== 'image') {
            extractedData = await extractInfoFromDocument(fileTextContent, confirmedTaskType);
          } else if (hasInstruction) {
            extractedData = await extractInfoFromIdea(analysisInstruction, confirmedTaskType);
          }
          if (extractedData) Object.assign(mergedData, extractedData);

          // Proactive Code Analysis
          const codeFile = filesToAnalyze.find(isCodeFile);
          if (codeFile && (confirmedTaskType === 'agent' || confirmedTaskType === 'application')) {
              const codeContent = await parseFile(codeFile);
              mergedData.contract_file_content = codeContent; // Store content for the prompt
              const analysis = await analyzeCode(codeContent);
              
              mergedData.code_analysis_summary = analysis.summary;
              if (confirmedTaskType === 'agent') {
                  const currentTools = (mergedData.agent_tools as string[]) || [];
                  if (analysis.functions.length > 0 && !currentTools.includes('function_calling')) {
                      mergedData.agent_tools = [...currentTools, 'function_calling'];
                  }
                  const originalContext = mergedData.agent_context || '';
                  mergedData.agent_context = `${originalContext}\n\n**Analisis Kode:**\nFungsi: ${analysis.functions.join(', ') || 'none'}.\nKelas: ${analysis.classes.join(', ') || 'none'}`.trim();
              } else if (confirmedTaskType === 'application') {
                  const originalFeatures = mergedData.app_features || '';
                  const newFeatures = analysis.functions.map(f => `- Kemampuan untuk ${f}`).join('\n');
                  mergedData.app_features = `${originalFeatures}\n\n**Fitur dari Kode:**\n${newFeatures}`.trim();
              }
          }
    
          // Prepare file objects for the final form state
          const fileToKeepForImage = filesToAnalyze.find(f => f.type.startsWith('image/'));
          
          // Combine all results and perform a single, atomic state update
          setFormData(prev => ({
            ...createInitialState(), // Start fresh to clear all old data
            task_type: confirmedTaskType,
            uploaded_image: confirmedTaskType === 'image' ? fileToKeepForImage || null : null,
            ...mergedData,
          }));
          
          setAutoFillCompleted(true); // UX IMPROVEMENT

      } catch (err: any) {
          setAnalysisError(err.message || 'Gagal mengekstrak detail dari input Anda.');
      } finally {
          setIsAnalyzing(false);
          setAnalysisResult(null);
      }
  }


  // STEP 1: Just detect the task type
  const handleAutoFill = async () => {
    const hasFiles = filesToAnalyze.length > 0;
    const hasPastedContext = pastedContexts.length > 0;
    const hasInstruction = analysisInstruction.trim().length > 0;

    if (!hasFiles && !hasInstruction && !hasPastedContext && !currentContextInput.trim()) {
      setAnalysisError("Silakan unggah dokumen, tempel konteks, atau tulis instruksi untuk dianalisis.");
      return;
    }

    // Auto-add current text input if user forgot to click "Add"
    let tempContexts = [...pastedContexts];
    if (currentContextInput.trim()) {
        tempContexts.push(currentContextInput.trim());
        // We don't clear state here to avoid UI flicker, but we use the value
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setError(null);

    try {
      let fileTextContent = '';
      let analysisWarning: string | null = null;
      let detectedTaskType: TaskType;

      if (hasFiles) {
        const parseResult = await parseAndCombineFiles(filesToAnalyze);
        fileTextContent = parseResult.combinedText;
        if (parseResult.failedFiles.length > 0) {
          analysisWarning = `Beberapa file gagal diproses: ${parseResult.failedFiles.join(', ')}.`;
        }
      }

      // MERGE PASTED CONTEXTS
      if (tempContexts.length > 0) {
          if (fileTextContent) fileTextContent += '\n\n';
          const pastedTextCombined = tempContexts.map((txt, idx) => `--- Snippet Teks ${idx + 1} ---\n${txt}`).join('\n\n');
          fileTextContent += `--- KONTEKS TAMBAHAN DARI INPUT ---\n${pastedTextCombined}`;
      }

      let textForAnalysis = fileTextContent;
      if (hasInstruction) {
        textForAnalysis += `\n\n--- INSTRUCTION ---\n${analysisInstruction.trim()}`;
      }

      if (!textForAnalysis.trim()) {
          throw new Error("Tidak ada konten untuk dianalisis.");
      }
      
      detectedTaskType = await detectTaskType(textForAnalysis);
      
      // Update hasFiles to mean "hasContent" (files or pasted context)
      setAnalysisResult({ textForAnalysis, fileTextContent, hasFiles: (hasFiles || tempContexts.length > 0), hasInstruction, detectedTaskType });
      
      if (currentContextInput.trim()) {
          setPastedContexts(prev => [...prev, currentContextInput.trim()]);
          setCurrentContextInput('');
      }

      setNeedsConfirmation(true);

      if (analysisWarning) {
        setAnalysisError(analysisWarning);
      }

    } catch (err: any)
 {
      setAnalysisError(err.message || 'Gagal menganalisis input Anda.');
      setIsAnalyzing(false); // Stop analyzing on initial error
    } 
    // `isAnalyzing` will be set to false in `proceedWithExtraction` or if the user cancels.
  };

  const handleConfirmation = (chosenType: TaskType) => {
    proceedWithExtraction(chosenType);
  }

  const cancelConfirmation = () => {
    setNeedsConfirmation(false);
    setAnalysisResult(null);
    setIsAnalyzing(false);
  }

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisError(null);

    const finalFormData = { ...formData };
    
    if (finalFormData.task_type === 'image') {
        const imageFile = finalFormData.uploaded_image as File | null;
        if (!imageFile) {
            setError("Silakan unggah gambar untuk tipe tugas Edit Gambar.");
            setIsLoading(false);
            return;
        }
        try {
            const { base64, mimeType } = await fileToBase64(imageFile);
            finalFormData.uploaded_image_base64 = base64;
            finalFormData.uploaded_image_mime_type = mimeType;
        } catch (err: any) {
            setError(err.message || "Gagal memproses file gambar.");
            setIsLoading(false);
            return;
        }
    }

    try {
      const result = await generateMetaPrompt(finalFormData);
      setOutput(result);
      setSubmissionCount(prev => prev + 1);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
      setOutput(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetAutoFill = () => {
    setAutoFillCompleted(false);
    setFilesToAnalyze([]);
    setPastedContexts([]); // Reset contexts
    setCurrentContextInput('');
    setAnalysisInstruction('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const startOver = useCallback(() => {
    setOutput(null);
    setError(null);
    setAnalysisError(null);
    setFormData(createInitialState());
    setSubmissionCount(0);
    setNeedsConfirmation(false);
    setAnalysisResult(null);
    resetAutoFill();
  }, []);
  
  const isAutoFillDisabled = isAnalyzing || (filesToAnalyze.length === 0 && pastedContexts.length === 0 && !currentContextInput.trim() && !analysisInstruction.trim());
  const taskTypeOptions = FORM_STEPS.find(s => s.id === 'task_definition')?.fields[0].options as { value: TaskType, label: string }[];

  const activeSteps = useMemo(() => 
    FORM_STEPS.filter(step => !step.showIf || formData[step.showIf.field] === step.showIf.value),
  [formData]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            Meta-Prompt Generator
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl mx-auto">Rancang prompt canggih untuk teks, alur kerja AI, spesifikasi aplikasi, dan editing gambar dengan mudah.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-10">
          
          {/* Left Column: Form */}
          <div className="bg-gray-800/50 rounded-2xl shadow-2xl shadow-indigo-900/20 p-6 sm:p-8 border border-gray-700 h-fit md:sticky top-8">
            {error && (
               <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg relative mb-6 flex items-start space-x-3" role="alert">
                <AlertTriangleIcon className="h-5 w-5 text-red-400 mt-1 flex-shrink-0" />
                <div>
                  <strong className="font-bold">Terjadi Kesalahan</strong>
                  <span className="block mt-1">{error}</span>
                </div>
              </div>
            )}
            
            {/* --- NEW: AI Quick Fill at the top --- */}
             <div className="bg-gray-700/30 rounded-lg mb-8 border border-gray-600/50 p-4 space-y-4">
                <h2 className="font-bold text-xl text-indigo-400">Isi Cepat dengan AI</h2>
                {!autoFillCompleted ? (
                  <>
                  <p className="text-sm text-gray-400 -mt-2">Mulai dengan mengunggah dokumen, menulis ide, atau keduanya.</p>
                  
                  {needsConfirmation && analysisResult ? (
                      <div className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-700 animate-fade-in">
                          <h3 className="font-semibold text-white">Konfirmasi Jenis Tugas</h3>
                          <p className="text-sm text-indigo-200 mt-1">AI mendeteksi tugas ini sebagai: <strong className="font-bold">{taskTypeOptions.find(o => o.value === analysisResult.detectedTaskType)?.label || analysisResult.detectedTaskType}</strong>. Apakah ini benar?</p>
                          <div className="mt-4 flex flex-col sm:flex-row gap-2">
                              <button type="button" onClick={() => handleConfirmation(analysisResult.detectedTaskType)} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition">
                                  Ya, Lanjutkan
                              </button>
                              <select 
                                onChange={(e) => handleConfirmation(e.target.value as TaskType)}
                                defaultValue=""
                                className="flex-1 px-4 py-2 text-sm text-white bg-gray-600 hover:bg-gray-500 border-gray-500 rounded-md transition appearance-none text-center"
                                >
                                    <option value="" disabled>Bukan, ganti ke...</option>
                                    {taskTypeOptions
                                      .filter(o => o.value !== analysisResult.detectedTaskType)
                                      .map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                                    }
                                </select>
                          </div>
                          <button type="button" onClick={cancelConfirmation} className="w-full text-center text-xs text-gray-400 hover:text-white mt-3">Batal</button>
                      </div>
                  ) : (
                    <div className="space-y-6 animate-fade-in-fast">
                        
                         {/* SECTION 1: INSTRUCTION (Now First) */}
                         <div>
                            <label htmlFor="analysis-instruction" className="text-sm font-medium text-gray-300 mb-2 block">1. Tulis Ide / Instruksi (Opsional)</label>
                            <textarea
                              id="analysis-instruction"
                              value={analysisInstruction}
                              onChange={(e) => setAnalysisInstruction(e.target.value)}
                              placeholder="Apa yang ingin Anda lakukan? Contoh: 'Buat ringkasan', 'Perbaiki bug', 'Ubah jadi SOP'."
                              className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 h-24 placeholder-gray-500"
                              disabled={isAnalyzing}
                            />
                        </div>

                        {/* SECTION 2: SOURCES (Files & Contexts) (Now Second) */}
                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">2. Unggah Dokumen / Kode / Tempel Konteks</label>
                            
                            {/* List of Added Items */}
                            {(filesToAnalyze.length > 0 || pastedContexts.length > 0) && (
                                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto custom-scrollbar">
                                  {filesToAnalyze.map((file, index) => (
                                    <div key={`file-${index}`} className="flex items-center justify-between bg-gray-700/50 border border-gray-600/50 p-2 rounded-md text-sm">
                                      <div className="flex items-center space-x-2 truncate">
                                        <CodeBracketIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                                        <span className="text-gray-300 truncate" title={file.name}>{file.name}</span>
                                      </div>
                                      <button type="button" onClick={() => removeFile(index)} disabled={isAnalyzing} className="text-gray-400 hover:text-red-400 ml-2 p-1 rounded-full hover:bg-gray-600/50 transition">
                                        <XCircleIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                  {pastedContexts.map((txt, index) => (
                                    <div key={`txt-${index}`} className="flex items-center justify-between bg-gray-700/50 border border-gray-600/50 p-2 rounded-md text-sm">
                                      <div className="flex items-center space-x-2 truncate">
                                        <PencilIcon className="h-4 w-4 text-purple-400 flex-shrink-0" />
                                        <span className="text-gray-300 truncate" title={txt}>"{txt.substring(0, 30)}{txt.length > 30 ? '...' : ''}"</span>
                                      </div>
                                      <button type="button" onClick={() => removeContext(index)} disabled={isAnalyzing} className="text-gray-400 hover:text-red-400 ml-2 p-1 rounded-full hover:bg-gray-600/50 transition">
                                        <XCircleIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                            )}

                            {/* Actions Area */}
                            <div className="space-y-3">
                                {/* Upload Button */}
                                <button
                                    type="button"
                                    onClick={handleUploadButtonClick}
                                    disabled={isAnalyzing}
                                    className={`flex items-center justify-center space-x-2 w-full px-4 py-2.5 rounded-md transition cursor-pointer border border-dashed border-gray-500 hover:border-indigo-400 hover:bg-gray-700/50 hover:text-indigo-300 text-gray-400 ${isAnalyzing ? 'opacity-50' : ''}`}
                                >
                                    <UploadIcon className="h-5 w-5" />
                                    <span className="text-sm font-medium">Unggah File</span>
                                </button>
                                <input 
                                  ref={fileInputRef}
                                  type="file" 
                                  className="hidden" 
                                  onChange={handleFileChange} 
                                  disabled={isAnalyzing} 
                                  accept=".pdf,.docx,.pptx,.txt,.md,.xlsx,image/*,.sol,.js,.ts,.py" 
                                  multiple 
                                />

                                {/* Paste Context Area */}
                                <div className="relative">
                                    <textarea
                                      value={currentContextInput}
                                      onChange={(e) => setCurrentContextInput(e.target.value)}
                                      placeholder="Atau tempel kode, artikel, atau teks referensi di sini lalu klik Tambah..."
                                      className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-3 pr-16 text-sm focus:ring-2 focus:ring-indigo-500 h-20 placeholder-gray-500 resize-none"
                                      disabled={isAnalyzing}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleAddContext}
                                        disabled={!currentContextInput.trim() || isAnalyzing}
                                        className="absolute right-2 bottom-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Tambah
                                    </button>
                                </div>
                            </div>
                        </div>

                          <button
                            type="button"
                            onClick={handleAutoFill}
                            disabled={isAutoFillDisabled}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                          >
                            {isAnalyzing ? (
                                <> <LoaderIcon className="h-5 w-5" /> <span>Menganalisis...</span> </>
                            ) : (
                                <> <SparklesIcon className="h-5 w-5" /> <span>Analisis & Isi Formulir</span> </>
                            )}
                        </button>
                    </div>
                  )}
                  </>
                ) : (
                  <div className="bg-green-900/30 p-4 rounded-lg border border-green-700 animate-fade-in text-center">
                      <h3 className="font-semibold text-green-300">✅ Analisis Berhasil</h3>
                      <p className="text-sm text-green-400 mt-1">Formulir telah diisi. Silakan tinjau dan sesuaikan di bawah.</p>
                      <button type="button" onClick={resetAutoFill} className="mt-3 text-sm font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-500/20 px-3 py-1 rounded-md">
                        Ubah Input
                      </button>
                  </div>
                )}


                {analysisError && (
                    <div className={`mt-2 text-sm flex items-start space-x-2 p-2 rounded-md border ${analysisError.includes('gagal diproses') ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50' : 'text-red-400 bg-red-900/30 border-red-700/50'}`}>
                        <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{analysisError}</span>
                    </div>
                )}
            </div>


            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="space-y-8">
                {activeSteps.map((step) => (
                  <div key={step.id}>
                    <Step
                      stepData={step}
                      formData={formData}
                      onFormChange={handleFormChange}
                    />
                  </div>
                ))}
              </div>

              {/* UX IMPROVEMENT: Sticky Action Panel */}
              <div className="sticky bottom-0 z-10 bg-gray-800/80 backdrop-blur-sm -mx-6 -mb-6 mt-8 px-6 py-4 border-t border-gray-700">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                    {/* UX IMPROVEMENT: Secondary Button Style */}
                    <button
                        type="button"
                        onClick={startOver}
                        className="font-bold py-3 px-6 rounded-lg transition duration-300 w-full sm:w-auto bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                        Reset Form
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || isAnalyzing}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {isLoading && <LoaderIcon />}
                      <span>{isLoading ? 'Memproses...' : 'Buat Prompt'}</span>
                    </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Output */}
          <div className="mt-10 md:mt-0">
            {isLoading ? (
              <div className="animate-fade-in">
                <SkeletonPreview />
              </div>
            ) : output ? (
              <div key={submissionCount} className="animate-fade-in">
                <Preview data={output} taskType={formData.task_type as string} />
              </div>
            ) : (
              <div className="animate-fade-in">
                <Placeholder />
              </div>
            )}
          </div>
        </div>
        
        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Powered by Google Gemini & React</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
