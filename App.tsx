import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FORM_STEPS } from './constants';
import { type FormData, type ParsedOutput } from './types';
import { generateMetaPrompt, extractInfoFromDocument, extractInfoWithInstruction, extractInfoFromIdea } from './services/geminiService';
import { parseFile } from './services/fileParser';
import FormField from './components/FormField';
import Preview from './components/Preview';
import { LoaderIcon, AlertTriangleIcon, SparklesIcon, UploadIcon, PencilIcon, XCircleIcon } from './components/icons';

// New component for the right panel placeholder
const Placeholder = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800/30 p-8">
    <div className="text-center">
      <SparklesIcon className="mx-auto h-12 w-12 text-gray-500" />
      <h3 className="mt-4 text-lg font-medium text-gray-400">Hasil akan muncul di sini</h3>
      <p className="mt-1 text-sm text-gray-500">Pilih jenis tugas dan isi formulir untuk menghasilkan prompt Anda.</p>
    </div>
  </div>
);

// New component for the skeleton loader
const SkeletonPreview = () => (
  <div className="space-y-8 animate-pulse">
    <div>
      <div className="h-8 w-3/4 bg-gray-700 rounded-md mb-4"></div>
      <div className="bg-gray-700/80 p-4 rounded-lg">
        <div className="h-4 w-1/3 bg-gray-600 rounded-md mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-600 rounded-md"></div>
          <div className="h-3 w-5/6 bg-gray-600 rounded-md"></div>
           <div className="h-3 w-full bg-gray-600 rounded-md"></div>
        </div>
      </div>
    </div>
    <div className="bg-gray-700/80 rounded-lg">
       <div className="h-12 w-full bg-gray-700/50 rounded-t-lg"></div>
       <div className="p-4"><div className="h-20 w-full bg-gray-600 rounded-md"></div></div>
    </div>
     <div className="bg-gray-700/80 rounded-lg">
       <div className="h-12 w-full bg-gray-700/50 rounded-t-lg"></div>
    </div>
      <div className="bg-gray-700/80 rounded-lg">
       <div className="h-12 w-full bg-gray-700/50 rounded-t-lg"></div>
    </div>
  </div>
);


// Initial state creator
const createInitialState = (): FormData => {
    const initialState: FormData = {};
    FORM_STEPS.forEach(step => {
      step.fields.forEach(field => {
        if (field.type === 'checkbox') {
          initialState[field.id] = [];
        } else {
          initialState[field.id] = field.default ?? '';
        }
      });
    });
    return initialState;
};

// Create a map of task types to their specific form fields for easy lookup
const taskSpecificFields: Record<string, string[]> = {
  document: FORM_STEPS.find(s => s.id === 'document_details')?.fields.map(f => f.id) ?? [],
  agent: FORM_STEPS.find(s => s.id === 'agent_details')?.fields.map(f => f.id) ?? [],
  application: FORM_STEPS.find(s => s.id === 'application_details')?.fields.map(f => f.id) ?? [],
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
  const [filesToAnalyze, setFilesToAnalyze] = useState<File[]>([]);
  
  // Ref to track previous task type to detect changes and clear form.
  const prevTaskTypeRef = useRef<string | boolean | string[]>(formData.task_type);

  // --- IMPROVEMENT: Robust file input handling using a ref ---
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          return newData;
        });
      }
    }
    // Update the ref for the next render
    prevTaskTypeRef.current = currentTaskType;
  }, [formData.task_type]);


  const handleFormChange = useCallback((id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
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

  const handleUploadButtonClick = () => {
    // ALTERNATIVE: Reset the input's value right before triggering a click.
    // This is a very robust way to ensure the onChange event fires even if the same file is selected again,
    // and it decouples the reset logic from the onChange handler itself.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };


  // --- NEW: Rebuilt Auto-Fill Handler for the new flexible workflow ---
  const handleAutoFill = async () => {
    const hasFiles = filesToAnalyze.length > 0;
    const hasInstruction = analysisInstruction.trim().length > 0;

    if (!hasFiles && !hasInstruction) {
      setAnalysisError("Silakan unggah dokumen atau tulis instruksi untuk dianalisis.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setError(null);

    const taskType = formData.task_type as 'document' | 'agent' | 'application';

    try {
      let extractedData: Partial<FormData> | null = null;
      let analysisWarning: string | null = null;
      
      // -- Logic Branching --
      if (hasFiles && hasInstruction) {
        // SCENARIO 1: Files + Instruction
        const { combinedText, failedFiles } = await parseAndCombineFiles(filesToAnalyze);
        if (failedFiles.length > 0) analysisWarning = `Beberapa file gagal diproses: ${failedFiles.join(', ')}.`;
        if (!combinedText && failedFiles.length === filesToAnalyze.length) throw new Error(`Semua file gagal diproses. ${analysisWarning || 'Periksa format file.'}`);
        extractedData = await extractInfoWithInstruction(combinedText, analysisInstruction, taskType);

      } else if (hasFiles) {
        // SCENARIO 2: Files only
        const { combinedText, failedFiles } = await parseAndCombineFiles(filesToAnalyze);
        if (failedFiles.length > 0) analysisWarning = `Beberapa file gagal diproses: ${failedFiles.join(', ')}.`;
        if (!combinedText && failedFiles.length === filesToAnalyze.length) throw new Error(`Semua file gagal diproses. ${analysisWarning || 'Periksa format file.'}`);
        extractedData = await extractInfoFromDocument(combinedText, taskType);

      } else if (hasInstruction) {
        // SCENARIO 3: Instruction only
        extractedData = await extractInfoFromIdea(analysisInstruction, taskType);
      }
      
      if (extractedData) {
        setFormData(prev => ({ ...prev, ...extractedData }));
      }
      if (analysisWarning) {
        setAnalysisError(analysisWarning); // Show warning but don't block the result
      }

    } catch (err: any) {
      setAnalysisError(err.message || 'Gagal menganalisis input Anda.');
    } finally {
      setIsAnalyzing(false);
      // Clear inputs after an analysis
      setFilesToAnalyze([]);
      setAnalysisInstruction('');
    }
  };


  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisError(null);

    try {
      const result = await generateMetaPrompt(formData);
      setOutput(result);
      setSubmissionCount(prev => prev + 1);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
      setOutput(null);
    } finally {
      setIsLoading(false);
    }
  };

  const startOver = useCallback(() => {
    setOutput(null);
    setError(null);
    setAnalysisError(null);
    setFormData(createInitialState());
    setSubmissionCount(0);
    setAnalysisInstruction('');
    setFilesToAnalyze([]);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }, []);
  
  const isAutoFillDisabled = isAnalyzing || (filesToAnalyze.length === 0 && !analysisInstruction.trim());

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            Meta-Prompt Generator
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl mx-auto">Rancang prompt, agen AI, dan spesifikasi aplikasi canggih dengan mendefinisikan kebutuhan Anda.</p>
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

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              {FORM_STEPS.map((step) => {
                if (step.showIf && formData[step.showIf.field] !== step.showIf.value) {
                  return null;
                }
                const isDetailsStep = ['document_details', 'agent_details', 'application_details'].includes(step.id);
                return (
                  <div key={step.id} className="mb-8 last:mb-0 animate-fade-in">
                    <h2 className="text-xl font-bold mb-6 text-indigo-400 border-b border-gray-700 pb-2">{step.title}</h2>
                    
                    {isDetailsStep && (
                      <div className="bg-gray-700/30 rounded-lg mb-6 border border-gray-600/50 p-4 space-y-4">
                          <h3 className="font-semibold text-lg text-gray-200">Isi Cepat dengan AI</h3>
                          <p className="text-sm text-gray-400 -mt-2">Anda bisa menggunakan dokumen, instruksi, atau keduanya untuk mengisi formulir.</p>
                          
                          <div className="space-y-4 animate-fade-in-fast">
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Unggah Dokumen (Opsional)</label>
                                {filesToAnalyze.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 mb-2">
                                      {filesToAnalyze.map((file, index) => (
                                        <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md text-sm">
                                          <span className="text-gray-300 truncate" title={file.name}>{file.name}</span>
                                          <button type="button" onClick={() => removeFile(index)} disabled={isAnalyzing} className="text-gray-400 hover:text-red-400 ml-2">
                                            <XCircleIcon className="h-5 w-5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                )}
                                {/* IMPROVEMENT: This is now a button that programmatically triggers the hidden input */}
                                <button
                                    type="button"
                                    onClick={handleUploadButtonClick}
                                    disabled={isAnalyzing}
                                    className={`flex items-center justify-center space-x-2 w-full px-4 py-2 rounded-md transition cursor-pointer border border-dashed border-gray-500 hover:border-indigo-500 hover:bg-gray-700/50 ${isAnalyzing ? 'opacity-50' : ''}`}
                                >
                                    <UploadIcon className="h-5 w-5 text-gray-400" />
                                    <span className="text-gray-300">Pilih File</span>
                                </button>
                                <input 
                                  ref={fileInputRef}
                                  type="file" 
                                  className="hidden" 
                                  onChange={handleFileChange} 
                                  disabled={isAnalyzing} 
                                  accept=".pdf,.docx,.pptx,.txt,.md,.xlsx" 
                                  multiple 
                                />
                            </div>

                            <div>
                                <label htmlFor="analysis-instruction" className="text-sm text-gray-400 mb-2 block">Tulis Ide / Instruksi Singkat (Opsional)</label>
                                <textarea
                                  id="analysis-instruction"
                                  value={analysisInstruction}
                                  onChange={(e) => setAnalysisInstruction(e.target.value)}
                                  placeholder="Contoh: Buat SOP untuk proses onboarding karyawan baru di departemen engineering."
                                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 h-20"
                                  disabled={isAnalyzing}
                                />
                            </div>

                             <button
                                type="button"
                                onClick={handleAutoFill}
                                disabled={isAutoFillDisabled}
                                className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                              >
                                {isAnalyzing ? (
                                    <> <LoaderIcon className="h-5 w-5" /> <span>Menganalisis...</span> </>
                                ) : (
                                    <> <SparklesIcon className="h-5 w-5" /> <span>Analisis & Isi Formulir</span> </>
                                )}
                            </button>
                          </div>

                          {analysisError && (
                              <div className={`mt-2 text-sm flex items-start space-x-2 p-2 rounded-md border ${analysisError.includes('gagal diproses') ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50' : 'text-red-400 bg-red-900/30 border-red-700/50'}`}>
                                  <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span>{analysisError}</span>
                              </div>
                          )}
                      </div>
                    )}

                    {step.fields.map(field => {
                       if (field.showIf && formData[field.showIf.field] !== field.showIf.value) {
                        return null;
                       }
                       return (
                          <FormField 
                            key={field.id}
                            field={field}
                            value={formData[field.id]}
                            onChange={handleFormChange}
                          />
                       )
                    })}
                  </div>
                )
              })}

              <div className="mt-8 pt-6 border-t border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                 <button
                    type="button"
                    onClick={startOver}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 w-full sm:w-auto"
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
                <Preview data={output} />
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