
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FORM_STEPS } from './constants';
import { type FormData, type ParsedOutput, type CodeAnalysisResult, type FormFieldData } from './types';
import { generateMetaPrompt, extractInfoFromDocument, extractInfoWithInstruction, extractInfoFromIdea, detectTaskType, detectPreferences, analyzeCode, refineFormData } from './services/geminiService';
import { parseFile } from './services/fileParser';
import Step from './components/Step';
import Preview from './components/Preview';
import Placeholder from './components/Placeholder';
import SkeletonPreview from './components/SkeletonPreview';
import { Loader2 as LoaderIcon, AlertTriangle as AlertTriangleIcon, Sparkles as SparklesIcon, Upload as UploadIcon, Pencil as PencilIcon, XCircle as XCircleIcon, Code2 as CodeBracketIcon, Check as CheckIcon } from 'lucide-react';
import FormField from './components/FormField';

// Initial state creator
const createInitialState = (): FormData => {
    const initialState: FormData = {};
    FORM_STEPS.forEach(step => {
      step.fields.forEach(field => {
        const fieldShouldBeVisible = !field.showIf;
        if (field.type === 'checkbox' && fieldShouldBeVisible) {
          initialState[field.id] = field.default ?? [];
        } else if ((field.type === 'image_upload' || field.type === 'file_upload') && fieldShouldBeVisible) {
          initialState[field.id] = null;
        } else if (fieldShouldBeVisible) {
          initialState[field.id] = field.default ?? '';
        } else {
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

type TaskType = 'document' | 'agent' | 'application' | 'image' | 'video' | 'audio' | 'presentation' | 'spreadsheet';

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

const formatErrorMessage = (error: any, onRateLimit?: (seconds: number) => void): string => {
    const msg = error.message || "";
    if (error.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        if (onRateLimit) onRateLimit(60);
        return "Kuota API Terlampaui (429). Mohon tunggu sekitar 60 detik sebelum mencoba kembali. Jika Anda menggunakan Free Tier, limit biasanya 15 request per menit.";
    }
    if (msg.includes('token count exceeds') || msg.includes('INVALID_ARGUMENT') && msg.includes('maximum number of tokens')) {
        return "Dokumen atau konteks terlalu panjang! Ukuran input melebihi batas 1 juta token. Mohon kurangi jumlah file atau pendekkan teks yang ditempel.";
    }
    return error.message || "Terjadi kesalahan yang tidak terduga.";
};


// Debounce Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const App: React.FC = () => {
  const [formData, setFormData] = useState<FormData>(createInitialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ParsedOutput | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);

  // AI Quick Fill States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisInstruction, setAnalysisInstruction] = useState('');
  const debouncedInstruction = useDebounce(analysisInstruction, 1500);
  const [pastedContexts, setPastedContexts] = useState<string[]>([]);
  const [currentContextInput, setCurrentContextInput] = useState(''); 
  const [filesToAnalyze, setFilesToAnalyze] = useState<File[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ textForAnalysis: string, fileTextContent: string, hasFiles: boolean, hasInstruction: boolean, detectedTaskType: TaskType } | null>(null);
  const [autoFillCompleted, setAutoFillCompleted] = useState(false);
  const [refinementInstruction, setRefinementInstruction] = useState('');
  
  // Cooldown State for 429 Errors
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldown]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const taskSpecificFields = useMemo(() => {
    const map: Record<string, string[]> = {
      document: FORM_STEPS.find(s => s.id === 'document_details')?.fields.map(f => f.id) ?? [],
      agent: FORM_STEPS.find(s => s.id === 'agent_details')?.fields.map(f => f.id) ?? [],
      application: FORM_STEPS.find(s => s.id === 'application_details')?.fields.map(f => f.id) ?? [],
      image: FORM_STEPS.find(s => s.id === 'image_details')?.fields.map(f => f.id) ?? [],
      video: FORM_STEPS.find(s => s.id === 'video_details')?.fields.map(f => f.id) ?? [],
      audio: FORM_STEPS.find(s => s.id === 'audio_details')?.fields.map(f => f.id) ?? [],
      presentation: FORM_STEPS.find(s => s.id === 'presentation_details')?.fields.map(f => f.id) ?? [],
    };
    return map;
  }, []);

  const handleFormChange = useCallback((id: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [id]: value };
      
      // Jika task_type berubah, bersihkan field spesifik tugas lama
      if (id === 'task_type') {
        const oldTaskType = prev.task_type as string;
        const fieldsToClear = taskSpecificFields[oldTaskType] || [];
        const initialDefaults = createInitialState();
        
        fieldsToClear.forEach(fieldId => {
          newData[fieldId] = initialDefaults[fieldId];
        });
        
        if (oldTaskType === 'agent' || oldTaskType === 'application') {
          newData['contract_file_content'] = '';
          newData['code_analysis_summary'] = '';
        }
      }

      // Bersihkan field yang tidak lagi terlihat berdasarkan showIf
      const initialDefaults = createInitialState();
      FORM_STEPS.forEach(step => {
        const isStepVisible = !step.showIf || newData[step.showIf.field] === step.showIf.value;
        if (!isStepVisible) {
          step.fields.forEach(field => {
            if (newData[field.id] !== initialDefaults[field.id]) {
              newData[field.id] = initialDefaults[field.id];
            }
          });
        }
      });
      return newData;
    });
  }, [taskSpecificFields]);
  
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
    return { combinedText: successfulTexts.join('\n\n--- BATAS DOKUMEN ---\n\n'), failedFiles };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files;
    if (newFiles && newFiles.length > 0) {
      setFilesToAnalyze(prev => [...prev, ...Array.from(newFiles)]);
      setAnalysisError(null);
    }
  };
  
  const removeFile = (indexToRemove: number) => setFilesToAnalyze(prev => prev.filter((_, index) => index !== indexToRemove));

  const handleAddContext = () => {
    if (!currentContextInput.trim()) return;
    setPastedContexts(prev => [...prev, currentContextInput.trim()]);
    setCurrentContextInput('');
  };

  const removeContext = (indexToRemove: number) => setPastedContexts(prev => prev.filter((_, index) => index !== indexToRemove));

  const proceedWithExtraction = async (confirmedTaskType: TaskType) => {
      if (!analysisResult) return;
      setIsAnalyzing(true);
      setNeedsConfirmation(false);
      const { textForAnalysis, fileTextContent, hasFiles, hasInstruction } = analysisResult;
      const mergedData: Partial<FormData> = {};
      try {
          const detectedPrefs = await detectPreferences(textForAnalysis);
          Object.assign(mergedData, detectedPrefs);
          
          let extractedData: Partial<FormData> | null = null;
          
          if (hasFiles && hasInstruction) {
            extractedData = await extractInfoWithInstruction(fileTextContent, analysisInstruction, confirmedTaskType);
          } else if (hasFiles) {
            extractedData = await extractInfoFromDocument(fileTextContent, confirmedTaskType);
          } else if (hasInstruction) {
            extractedData = await extractInfoFromIdea(analysisInstruction, confirmedTaskType);
          }
          
          if (extractedData) {
              Object.assign(mergedData, extractedData);
          }

          const codeFile = filesToAnalyze.find(isCodeFile);
          if (codeFile && (confirmedTaskType === 'agent' || confirmedTaskType === 'application')) {
              const codeContent = await parseFile(codeFile);
              mergedData.contract_file_content = codeContent;
              const analysis = await analyzeCode(codeContent);
              mergedData.code_analysis_summary = analysis.summary;
              if (confirmedTaskType === 'agent') {
                  const currentTools = (mergedData.agent_tools as string[]) || [];
                  if (analysis.functions.length > 0 && !currentTools.includes('function_calling')) mergedData.agent_tools = [...currentTools, 'function_calling'];
                  mergedData.agent_context = `${mergedData.agent_context || ''}\n\n**Analisis Kode:**\nFungsi: ${analysis.functions.join(', ') || 'none'}.\nKelas: ${analysis.classes.join(', ') || 'none'}`.trim();
              } else if (confirmedTaskType === 'application') {
                  const newFeatures = analysis.functions.map(f => `- Kemampuan untuk ${f}`).join('\n');
                  mergedData.app_features = `${mergedData.app_features || ''}\n\n**Fitur dari Kode:**\n${newFeatures}`.trim();
              }
          }
          
          const fileToKeepForImage = filesToAnalyze.find(f => f.type.startsWith('image/'));
          
          setFormData(prev => {
              const initialState = createInitialState();
              return { 
                  ...initialState, 
                  task_type: confirmedTaskType, 
                  uploaded_image: confirmedTaskType === 'image' ? fileToKeepForImage || null : null, 
                  ...mergedData 
              };
          });
          setAutoFillCompleted(true);
          setAnalysisError(null);
      } catch (err: any) {
          setAnalysisError(formatErrorMessage(err, (s) => setCooldown(s)));
      } finally {
          setIsAnalyzing(false);
          setAnalysisResult(null);
      }
  }

  const handleAutoFill = async () => {
    let tempContexts = [...pastedContexts];
    if (currentContextInput.trim()) tempContexts.push(currentContextInput.trim());

    if (filesToAnalyze.length === 0 && !analysisInstruction.trim() && tempContexts.length === 0) {
      setAnalysisError("Silakan unggah dokumen, tempel konteks, atau tulis instruksi.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      let fileTextContent = '';
      if (filesToAnalyze.length > 0) {
        const parseResult = await parseAndCombineFiles(filesToAnalyze);
        fileTextContent = parseResult.combinedText;
      }
      if (tempContexts.length > 0) {
          if (fileTextContent) fileTextContent += '\n\n';
          fileTextContent += `--- KONTEKS TAMBAHAN ---\n${tempContexts.map((txt, idx) => `Snippet ${idx + 1}:\n${txt}`).join('\n\n')}`;
      }
      let textForAnalysis = fileTextContent + (analysisInstruction ? `\n\n--- INSTRUKSI ---\n${analysisInstruction}` : '');
      const detectedTaskType = await detectTaskType(textForAnalysis) as TaskType;
      
      setAnalysisResult({ 
          textForAnalysis, 
          fileTextContent, 
          hasFiles: (filesToAnalyze.length > 0 || tempContexts.length > 0), 
          hasInstruction: !!analysisInstruction.trim(), 
          detectedTaskType 
      });
      
      if (currentContextInput.trim()) { 
          setPastedContexts(prev => [...prev, currentContextInput.trim()]); 
          setCurrentContextInput(''); 
      }
      setNeedsConfirmation(true);
    } catch (err: any) {
      setAnalysisError(formatErrorMessage(err, (s) => setCooldown(s)));
      setIsAnalyzing(false);
    }
  };

  const handleConfirmation = (chosenType: TaskType) => proceedWithExtraction(chosenType);
  const cancelConfirmation = () => { setNeedsConfirmation(false); setAnalysisResult(null); setIsAnalyzing(false); }

  const handleRefine = async () => {
    if (!refinementInstruction.trim()) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
        const refinedData = await refineFormData(formData, refinementInstruction, formData.task_type as string);
        setFormData(prev => ({ ...prev, ...refinedData }));
        setRefinementInstruction('');
        setAnalysisError(null);
    } catch (err: any) {
        setAnalysisError(formatErrorMessage(err, (s) => setCooldown(s)));
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    const finalFormData = { ...formData };
    if (finalFormData.task_type === 'image') {
        const imageFile = finalFormData.uploaded_image as File | null;
        if (imageFile) {
            try {
                const { base64, mimeType } = await fileToBase64(imageFile);
                finalFormData.uploaded_image_base64 = base64; 
                finalFormData.uploaded_image_mime_type = mimeType;
            } catch (err: any) { 
                setError(err.message); 
                setIsLoading(false); 
                return; 
            }
        }
    }
    try {
      const result = await generateMetaPrompt(finalFormData);
      setOutput(result); 
      setSubmissionCount(prev => prev + 1);
    } catch (e: any) { 
      setError(formatErrorMessage(e, (s) => setCooldown(s))); 
      setOutput(null); 
    } finally { 
      setIsLoading(false); 
    }
  };
  
  const resetAutoFill = () => { setAutoFillCompleted(false); setFilesToAnalyze([]); setPastedContexts([]); setCurrentContextInput(''); setAnalysisInstruction(''); setAnalysisError(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const startOver = useCallback(() => { setOutput(null); setError(null); setAnalysisError(null); setFormData(createInitialState()); setSubmissionCount(0); setNeedsConfirmation(false); setAnalysisResult(null); resetAutoFill(); }, []);
  
  const isAutoFillDisabled = isAnalyzing || (filesToAnalyze.length === 0 && pastedContexts.length === 0 && !currentContextInput.trim() && !analysisInstruction.trim());
  const taskTypeOptions = FORM_STEPS.find(s => s.id === "task_definition")?.fields[0].options as { value: TaskType, label: string }[];

  const activeSteps = useMemo(() => FORM_STEPS.filter(step => !step.showIf || formData[step.showIf.field] === step.showIf.value), [formData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-5xl sm:text-7xl font-black gradient-brand tracking-tighter pb-2">Meta-Prompt Generator</h1>
          <p className="text-slate-400 mt-4 text-lg max-w-2xl mx-auto font-medium">Bentuk prompt canggih masa depan dengan rekayasa bahasa AI yang presisi.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="card-premium p-6 sm:p-10 lg:sticky top-8">
            {error && (
               <div className="bg-red-900/30 border border-red-500/50 text-red-100 px-6 py-4 rounded-2xl relative mb-8 flex items-start space-x-4 animate-in zoom-in-95" role="alert">
                <AlertTriangleIcon className="h-6 w-6 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="font-black uppercase tracking-widest text-xs">Sistem Error</strong>
                  <span className="block mt-1 text-sm opacity-90">{error}</span>
                </div>
              </div>
            )}
            
            <div className="bg-slate-800/20 rounded-3xl mb-10 border border-slate-700/30 p-1">
                <div className="p-6">
                    <h2 className="font-black text-2xl text-white tracking-tight flex items-center space-x-3">
                        <SparklesIcon className="h-6 w-6 text-indigo-400" />
                        <span>AI Forge</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Biarkan Gemini merancang pondasi formulir Anda secara otomatis.</p>
                </div>

                <div className="px-6 pb-6 pt-2">
                  {!autoFillCompleted ? (
                    <>
                      {needsConfirmation && analysisResult ? (
                        <div className="glass-card p-8 rounded-3xl animate-in zoom-in-95 duration-500 relative overflow-hidden ring-1 ring-white/10">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                              <SparklesIcon className="h-12 w-12 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter mb-2">Konfirmasi Tugas</h3>
                            <p className="text-slate-400 leading-relaxed text-sm mb-8">AI mendeteksi sebagai: <span className="text-indigo-300 font-bold px-3 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 ml-1">{taskTypeOptions.find(o => o.value === analysisResult.detectedTaskType)?.label || analysisResult.detectedTaskType}</span></p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button type="button" onClick={() => handleConfirmation(analysisResult.detectedTaskType)} className="btn-primary flex-1">Siap, Jalankan</button>
                                <div className="flex-1 relative">
                                  <select 
                                    onChange={(e) => handleConfirmation(e.target.value as TaskType)} 
                                    defaultValue="" 
                                    className="w-full px-6 py-4 text-sm font-black text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition appearance-none text-center cursor-pointer focus:ring-2 focus:ring-indigo-500/30"
                                  >
                                      <option value="" disabled>Ganti Kategori...</option>
                                      {taskTypeOptions.filter(o => o.value !== analysisResult.detectedTaskType).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                  </select>
                                </div>
                            </div>
                            <button type="button" onClick={cancelConfirmation} className="w-full text-center text-xs font-black text-slate-500 hover:text-slate-300 mt-8 uppercase tracking-widest transition-colors">Batalkan Prosedur</button>
                        </div>
                      ) : (
                        <div className="space-y-10 animate-in fade-in duration-700">
                             <div className="space-y-4">
                                <label htmlFor="analysis-instruction" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">1. Master Blueprint / Ide</label>
                                <textarea id="analysis-instruction" value={analysisInstruction} onChange={(e) => setAnalysisInstruction(e.target.value)} placeholder="Tuliskan misi prompt Anda di sini..." className="input-professional h-40 resize-none bg-slate-950/50" disabled={isAnalyzing} />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">2. Data & Konteks Pendukung</label>
                                
                                {(filesToAnalyze.length > 0 || pastedContexts.length > 0) && (
                                    <div className="space-y-3 mb-6 max-h-72 overflow-y-auto scrollbar-custom bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                      {filesToAnalyze.map((file, index) => (
                                        <div key={`file-${index}`} className="flex items-center justify-between bg-slate-800/30 border border-slate-700/30 p-4 rounded-xl text-sm group animate-in slide-in-from-left-4 duration-300">
                                          <div className="flex items-center space-x-4 truncate">
                                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                              <CodeBracketIcon className="h-4 w-4 text-indigo-400" />
                                            </div>
                                            <span className="text-slate-300 font-bold truncate tracking-tight">{file.name}</span>
                                          </div>
                                          <button type="button" onClick={() => removeFile(index)} disabled={isAnalyzing} className="text-slate-600 hover:text-red-400 transition-all p-1.5 active:scale-90"><XCircleIcon className="h-5 w-5" /></button>
                                        </div>
                                      ))}
                                      {pastedContexts.map((txt, index) => (
                                        <div key={`txt-${index}`} className="flex items-center justify-between bg-slate-800/30 border border-violet-500/10 p-4 rounded-xl text-sm group animate-in slide-in-from-left-4 duration-300">
                                          <div className="flex items-center space-x-4 truncate">
                                            <div className="p-2 bg-violet-500/10 rounded-lg">
                                              <PencilIcon className="h-4 w-4 text-violet-400" />
                                            </div>
                                            <span className="text-slate-400 font-medium truncate italic opacity-80">"{txt.substring(0, 40)}..."</span>
                                          </div>
                                          <button type="button" onClick={() => removeContext(index)} disabled={isAnalyzing} className="text-slate-600 hover:text-red-400 transition-all p-1.5 active:scale-90"><XCircleIcon className="h-5 w-5" /></button>
                                        </div>
                                      ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex flex-col items-center justify-center p-8 rounded-3xl transition-all border-2 border-dashed border-slate-800/50 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-slate-500 hover:text-indigo-400 group h-full min-h-[160px]">
                                        <UploadIcon className="h-10 w-10 mb-3 group-hover:scale-110 transition-transform duration-500" /> 
                                        <span className="text-[10px] font-black uppercase tracking-widest text-center">Injeksi Dokumen</span>
                                    </button>
                                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={isAnalyzing} accept=".pdf,.docx,.pptx,.txt,.md,.xlsx,image/*,.sol,.js,.ts,.py" multiple />

                                    <div className="relative h-full">
                                        <textarea value={currentContextInput} onChange={(e) => setCurrentContextInput(e.target.value)} placeholder="Snippet Konteks..." className="input-professional h-full min-h-[160px] pr-14 resize-none bg-slate-950/50" disabled={isAnalyzing} />
                                        <button type="button" onClick={handleAddContext} disabled={!currentContextInput.trim() || isAnalyzing} className="absolute right-3 bottom-3 p-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl disabled:opacity-5 transition-all shadow-lg active:scale-90">
                                          <SparklesIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button 
                              type="button" 
                              onClick={handleAutoFill} 
                              disabled={isAutoFillDisabled || cooldown > 0} 
                              className="btn-primary w-full group relative overflow-hidden py-5"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              {isAnalyzing ? ( 
                                <> <LoaderIcon className="h-7 w-7 animate-spin" /> <span>Sinkronisasi Data...</span> </> 
                              ) : cooldown > 0 ? (
                                <> <span>Tunggu {cooldown}s...</span> </>
                              ) : ( 
                                <> <SparklesIcon className="h-6 w-6 group-hover:rotate-12 transition-transform duration-500" /> <span>Ekstrak & Persiapkan Form</span> </> 
                              )}
                            </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="status-success-premium">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-emerald-500/20 shadow-2xl shadow-emerald-950/40">
                              <CheckIcon className="h-10 w-10 text-emerald-400" />
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tighter">Analisis Sempurna</h3>
                            <p className="text-slate-400 mt-2 font-medium max-w-sm">Basis pengetahuan telah diserap. Silakan sempurnakan jika diperlukan.</p>
                        </div>
                        
                        <div className="space-y-8">
                            <div className="relative group">
                                <textarea 
                                    value={refinementInstruction} 
                                    onChange={(e) => setRefinementInstruction(e.target.value)} 
                                    placeholder="Contoh: 'Ubah nada bicaranya menjadi lebih formal'..." 
                                    className="input-professional bg-slate-950/80 border-emerald-500/20 pr-16 h-32 resize-none" 
                                    disabled={isAnalyzing} 
                                />
                                <button 
                                    type="button" 
                                    onClick={handleRefine} 
                                    disabled={!refinementInstruction.trim() || isAnalyzing || cooldown > 0} 
                                    className="absolute right-4 bottom-4 p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-20 transition-all active:scale-95 shadow-xl shadow-emerald-950/40"
                                >
                                    {isAnalyzing ? <LoaderIcon className="h-5 w-5 animate-spin" /> : cooldown > 0 ? <span className="text-[10px] font-bold">{cooldown}s</span> : <SparklesIcon className="h-5 w-5" />}
                                </button>
                            </div>
                            
                            <button type="button" onClick={resetAutoFill} className="w-full text-center text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-[0.3em]">
                              Reset Pipeline Analisis
                            </button>
                        </div>
                    </div>
                  )}

                  {analysisError && (
                    <div className={`mt-2 text-sm flex items-start space-x-2 p-2 rounded-md border ${analysisError.includes('429') || analysisError.includes('Kuota') ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50 shadow-lg shadow-yellow-900/20' : 'text-red-400 bg-red-900/30 border-red-700/50'}`}>
                      <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{analysisError}</span>
                    </div>
                  )}
                </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-16">
              <div className="space-y-16 mt-12 pb-12">
                {activeSteps.map((step) => (
                  <div key={step.id}>
                    <Step stepData={step} formData={formData} onFormChange={handleFormChange} />
                  </div>
                ))}
              </div>
              
              <div className="sticky bottom-6 z-20 glass-card mx-0 mt-8 p-8 rounded-[2.5rem] flex flex-col sm:flex-row gap-5 items-center ring-1 ring-white/10 shadow-indigo-900/10">
                  <button type="button" onClick={startOver} className="btn-secondary w-full sm:w-auto px-12">Reset</button>
                  <button type="submit" disabled={isLoading || isAnalyzing || cooldown > 0} className="btn-primary w-full sm:flex-1 py-5 text-xl tracking-tight">
                    {isLoading ? <LoaderIcon className="h-7 w-7 animate-spin" /> : <SparklesIcon className="h-7 w-7" />}
                    <span>{isLoading ? 'Merekayasa...' : cooldown > 0 ? `Tunggu (${cooldown}s)` : 'Forge Meta-Prompt'}</span>
                  </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-1 h-full min-h-[600px]">
            {isLoading ? (
              <div className="animate-in fade-in zoom-in-95 duration-1000">
                <SkeletonPreview />
              </div>
            ) : output ? (
              <div key={submissionCount} className="animate-in fade-in slide-in-from-right-12 duration-1000 ease-out">
                <Preview data={output} taskType={formData.task_type as string} />
              </div>
            ) : (
              <div className="animate-in fade-in duration-1000 opacity-90 lg:sticky top-8">
                <Placeholder />
              </div>
            )}
          </div>
        </div>

        <footer className="text-center mt-32 py-16 border-t border-slate-900 text-slate-700 text-[10px] font-black tracking-[0.4em] uppercase">
          <p>© 2026 Promptware Architecture — Engine: Gemini 1.5 Pro</p>
        </footer>
      </div>
    </div>
  );

};

export default App;
