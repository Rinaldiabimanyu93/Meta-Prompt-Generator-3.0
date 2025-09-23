import React, { useState, useCallback } from 'react';
import { FORM_STEPS } from './constants';
import { type FormData, type ParsedOutput } from './types';
import { generateMetaPrompt } from './services/geminiService';
import FormField from './components/FormField';
import Preview from './components/Preview';
import { LoaderIcon, AlertTriangleIcon, SparklesIcon } from './components/icons';

// New component for the right panel placeholder
const Placeholder = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800/30 p-8">
    <div className="text-center">
      <SparklesIcon className="mx-auto h-12 w-12 text-gray-500" />
      <h3 className="mt-4 text-lg font-medium text-gray-400">Hasil akan muncul di sini</h3>
      <p className="mt-1 text-sm text-gray-500">Isi formulir di sebelah kiri dan hasilkan prompt Anda.</p>
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


const App: React.FC = () => {
  const [formData, setFormData] = useState<FormData>(createInitialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ParsedOutput | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);

  const handleFormChange = useCallback((id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

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

  const startOver = () => {
    setOutput(null);
    setError(null);
    setFormData(createInitialState());
    setSubmissionCount(0);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            Meta-Prompt Generator
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl mx-auto">Buat prompt AI canggih dengan mendefinisikan kebutuhan Anda, dan biarkan AI memilih teknik prompting terbaik untuk Anda.</p>
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
              {FORM_STEPS.map((step) => (
                <div key={step.id} className="mb-8 last:mb-0">
                  <h2 className="text-xl font-bold mb-6 text-indigo-400 border-b border-gray-700 pb-2">{step.title}</h2>
                  {step.fields.map(field => (
                    <FormField 
                      key={field.id}
                      field={field}
                      value={formData[field.id]}
                      onChange={handleFormChange}
                    />
                  ))}
                </div>
              ))}

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
                  disabled={isLoading}
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