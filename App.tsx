
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

type TaskType = 'document' | 'agent' | 'application' | 'image' | 'video' | 'audio' | 'presentation';

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

const formatErrorMessage = (error: any): string => {
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        return "Kuota API Terlampaui (429). Mohon tunggu beberapa saat sebelum mencoba kembali atau gunakan API key dengan batas yang lebih tinggi.";
    }
    return error.message || "Terjadi kesalahan yang tidak terduga.";
};


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
  const [pastedContexts, setPastedContexts] = useState<string[]>([]);
  const [currentContextInput, setCurrentContextInput] = useState(''); 
  const [filesToAnalyze, setFilesToAnalyze] = useState<File[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ textForAnalysis: string, fileTextContent: string, hasFiles: boolean, hasInstruction: boolean, detectedTaskType: TaskType } | null>(null);
  const [autoFillCompleted, setAutoFillCompleted] = useState(false);
  
  const prevTaskTypeRef = useRef<string | boolean | string[] | File | null>(formData.task_type);
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
            newData[fieldId] = initialDefaults[fieldId];
          });
          if (oldTaskType === 'agent' || oldTaskType === 'application') {
              newData['contract_file_content'] = '';
              newData['code_analysis_summary'] = '';
          }
          return newData;
        });
      }
    }
    prevTaskTypeRef.current = currentTaskType;
  }, [formData.task_type, taskSpecificFields]);

  const handleFormChange = useCallback((id: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [id]: value };
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
          
          setFormData(prev => ({ 
              ...createInitialState(), 
              task_type: confirmedTaskType, 
              uploaded_image: confirmedTaskType === 'image' ? fileToKeepForImage || null : null, 
              ...mergedData 
          }));
          setAutoFillCompleted(true);
      } catch (err: any) {
          setAnalysisError(formatErrorMessage(err));
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
      setAnalysisError(formatErrorMessage(err));
      setIsAnalyzing(false);
    }
  };

  const handleConfirmation = (chosenType: TaskType) => proceedWithExtraction(chosenType);
  const cancelConfirmation = () => { setNeedsConfirmation(false); setAnalysisResult(null); setIsAnalyzing(false); }

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
      setError(formatErrorMessage(e)); 
      setOutput(null); 
    } finally { 
      setIsLoading(false); 
    }
  };
  
  const resetAutoFill = () => { setAutoFillCompleted(false); setFilesToAnalyze([]); setPastedContexts([]); setCurrentContextInput(''); setAnalysisInstruction(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const startOver = useCallback(() => { setOutput(null); setError(null); setAnalysisError(null); setFormData(createInitialState()); setSubmissionCount(0); setNeedsConfirmation(false); setAnalysisResult(null); resetAutoFill(); }, []);
  
  const isAutoFillDisabled = isAnalyzing || (filesToAnalyze.length === 0 && pastedContexts.length === 0 && !currentContextInput.trim() && !analysisInstruction.trim());
  const taskTypeOptions = FORM_STEPS.find(s => s.id === "task_definition")?.fields[0].options as { value: TaskType, label: string }[];

  const activeSteps = useMemo(() => FORM_STEPS.filter(step => !step.showIf || formData[step.showIf.field] === step.showIf.value), [formData]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Meta-Prompt Generator</h1>
          <p className="text-gray-400 mt-2 max-w-2xl mx-auto">Rancang prompt canggih untuk teks, alur kerja AI, spesifikasi aplikasi, dan editing gambar dengan mudah.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-10">
          <div className="bg-gray-800/50 rounded-2xl shadow-2xl shadow-indigo-900/20 p-6 sm:p-8 border border-gray-700 h-fit md:sticky top-8">
            {error && (
               <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg relative mb-6 flex items-start space-x-3" role="alert">
                <AlertTriangleIcon className="h-5 w-5 text-red-400 mt-1 flex-shrink-0" />
                <div><strong className="font-bold">Terjadi Kesalahan</strong><span className="block mt-1">{error}</span></div>
              </div>
            )}
            
             <div className="bg-gray-700/30 rounded-lg mb-8 border border-gray-600/50 p-4 space-y-4">
                <h2 className="font-bold text-xl text-indigo-400">Isi Cepat dengan AI</h2>
                {!autoFillCompleted ? (
                  <>
                  <p className="text-sm text-gray-400 -mt-2">Lengkapi instruksi dan tempelkan konteks sebanyak yang Anda butuhkan.</p>
                  
                  {needsConfirmation && analysisResult ? (
                      <div className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-700 animate-fade-in">
                          <h3 className="font-semibold text-white">Konfirmasi Jenis Tugas</h3>
                          <p className="text-sm text-indigo-200 mt-1">AI mendeteksi tugas ini sebagai: <strong className="font-bold">{taskTypeOptions.find(o => o.value === analysisResult.detectedTaskType)?.label || analysisResult.detectedTaskType}</strong>. Apakah ini benar?</p>
                          <div className="mt-4 flex flex-col sm:flex-row gap-2">
                              <button type="button" onClick={() => handleConfirmation(analysisResult.detectedTaskType)} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition">Ya, Lanjutkan</button>
                              <select onChange={(e) => handleConfirmation(e.target.value as TaskType)} defaultValue="" className="flex-1 px-4 py-2 text-sm text-white bg-gray-600 hover:bg-gray-500 border-gray-500 rounded-md transition appearance-none text-center">
                                    <option value="" disabled>Bukan, ganti ke...</option>
                                    {taskTypeOptions.filter(o => o.value !== analysisResult.detectedTaskType).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                          </div>
                          <button type="button" onClick={cancelConfirmation} className="w-full text-center text-xs text-gray-400 hover:text-white mt-3">Batal</button>
                      </div>
                  ) : (
                    <div className="space-y-6 animate-fade-in-fast">
                         <div>
                            <label htmlFor="analysis-instruction" className="text-sm font-medium text-gray-300 mb-2 block">1. Tulis Ide / Instruksi</label>
                            <textarea id="analysis-instruction" value={analysisInstruction} onChange={(e) => setAnalysisInstruction(e.target.value)} placeholder="Contoh: 'Bantu saya buat skrip video tiktok dari artikel ini' atau 'Rancang bot untuk cek stok barang'." className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 h-24 placeholder-gray-500" disabled={isAnalyzing} />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">2. Unggah Dokumen / Tempel Referensi (Multi-Konteks)</label>
                            
                            {(filesToAnalyze.length > 0 || pastedContexts.length > 0) && (
                                <div className="space-y-2 mb-3 max-h-56 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded-lg">
                                  {filesToAnalyze.map((file, index) => (
                                    <div key={`file-${index}`} className="flex items-center justify-between bg-gray-700/50 border border-gray-600/50 p-2 rounded-md text-sm">
                                      <div className="flex items-center space-x-2 truncate"><CodeBracketIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" /><span className="text-gray-300 truncate">{file.name}</span></div>
                                      <button type="button" onClick={() => removeFile(index)} disabled={isAnalyzing} className="text-gray-400 hover:text-red-400 ml-2 p-1 rounded-full hover:bg-gray-600 transition"><XCircleIcon className="h-4 w-4" /></button>
                                    </div>
                                  ))}
                                  {pastedContexts.map((txt, index) => (
                                    <div key={`txt-${index}`} className="flex items-center justify-between bg-gray-700/50 border border-indigo-900/50 p-2 rounded-md text-sm group">
                                      <div className="flex items-center space-x-2 truncate"><PencilIcon className="h-4 w-4 text-purple-400 flex-shrink-0" /><span className="text-gray-300 truncate">"{txt.substring(0, 40)}..."</span></div>
                                      <button type="button" onClick={() => removeContext(index)} disabled={isAnalyzing} className="text-gray-400 hover:text-red-400 ml-2 p-1 rounded-full hover:bg-gray-600 transition"><XCircleIcon className="h-4 w-4" /></button>
                                    </div>
                                  ))}
                                </div>
                            )}

                            <div className="space-y-3">
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center justify-center space-x-2 w-full px-4 py-2 rounded-md transition border border-dashed border-gray-500 hover:border-indigo-400 hover:bg-gray-700/50 text-gray-400">
                                    <UploadIcon className="h-5 w-5" /> <span className="text-sm font-medium">Unggah File</span>
                                </button>
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={isAnalyzing} accept=".pdf,.docx,.pptx,.txt,.md,.xlsx,image/*,.sol,.js,.ts,.py" multiple />

                                <div className="relative">
                                    <textarea value={currentContextInput} onChange={(e) => setCurrentContextInput(e.target.value)} placeholder="Atau tempelkan potongan teks di sini..." className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-3 pr-20 text-sm focus:ring-2 focus:ring-indigo-500 h-20 placeholder-gray-500 resize-none" disabled={isAnalyzing} />
                                    <button type="button" onClick={handleAddContext} disabled={!currentContextInput.trim() || isAnalyzing} className="absolute right-2 bottom-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded disabled:opacity-50 transition">Tambah</button>
                                </div>
                            </div>
                        </div>

                          <button type="button" onClick={handleAutoFill} disabled={isAutoFillDisabled} className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-900/50 disabled:opacity-50 mt-4">
                            {isAnalyzing ? ( <> <LoaderIcon className="h-5 w-5" /> <span>Menganalisis...</span> </> ) : ( <> <SparklesIcon className="h-5 w-5" /> <span>Analisis & Isi Formulir</span> </> )}
                        </button>
                    </div>
                  )}
                  </>
                ) : (
                  <div className="bg-green-900/30 p-4 rounded-lg border border-green-700 animate-fade-in text-center">
                      <h3 className="font-semibold text-green-300">✅ Analisis Berhasil</h3>
                      <p className="text-sm text-green-400 mt-1">Formulir telah diisi. Silakan tinjau dan sesuaikan di bawah.</p>
                      <button type="button" onClick={resetAutoFill} className="mt-3 text-sm font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-500/20 px-3 py-1 rounded-md">Ubah Input / Tambah Konteks</button>
                  </div>
                )}
                {analysisError && <div className={`mt-2 text-sm flex items-start space-x-2 p-2 rounded-md border ${analysisError.includes('429') || analysisError.includes('Kuota') ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50' : 'text-red-400 bg-red-900/30 border-red-700/50'}`}><AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{analysisError}</span></div>}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="space-y-8">{activeSteps.map((step) => <div key={step.id}><Step stepData={step} formData={formData} onFormChange={handleFormChange} /></div>)}</div>
              <div className="sticky bottom-0 z-10 bg-gray-800/80 backdrop-blur-sm -mx-6 -mb-6 mt-8 px-6 py-4 border-t border-gray-700">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <button type="button" onClick={startOver} className="font-bold py-3 px-6 rounded-lg transition bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto">Reset Form</button>
                    <button type="submit" disabled={isLoading || isAnalyzing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 w-full sm:w-auto">
                      {isLoading && <LoaderIcon />} <span>{isLoading ? 'Memproses...' : 'Buat Prompt'}</span>
                    </button>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-10 md:mt-0">
            {isLoading ? <div className="animate-fade-in"><SkeletonPreview /></div> : output ? <div key={submissionCount} className="animate-fade-in"><Preview data={output} taskType={formData.task_type as string} /></div> : <div className="animate-fade-in"><Placeholder /></div>}
          </div>
        </div>
        <footer className="text-center mt-12 text-gray-500 text-sm"><p>Powered by Google Gemini & React</p></footer>
      </div>
    </div>
  );
};

export default App;
