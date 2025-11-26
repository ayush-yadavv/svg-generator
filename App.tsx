
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { InputSection } from './components/InputSection';
import { SvgPreview } from './components/SvgPreview';
import { Editor } from './components/Editor';
import { generateSvgFromPrompt, refineSvg } from './services/geminiService';
import { GeneratedSvg, GenerationStatus, ApiError } from './types';
import { AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [currentSvg, setCurrentSvg] = useState<GeneratedSvg | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [view, setView] = useState<'home' | 'editor'>('home');

  const handleGenerate = async (prompt: string) => {
    setStatus(GenerationStatus.LOADING);
    setError(null);
    setCurrentSvg(null);

    try {
      const svgContent = await generateSvgFromPrompt(prompt);
      
      const newSvg: GeneratedSvg = {
        id: crypto.randomUUID(),
        content: svgContent,
        prompt: prompt,
        timestamp: Date.now()
      };
      
      setCurrentSvg(newSvg);
      setStatus(GenerationStatus.SUCCESS);
      setView('home'); // Ensure we are on home to see the result
    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      setError({
        message: "Generation Failed",
        details: err.message || "An unexpected error occurred while contacting Gemini."
      });
    }
  };

  const handleRefine = async (currentContent: string, instruction: string) => {
    if (!currentSvg) return;
    
    setIsRefining(true);
    setError(null);

    try {
      const refinedContent = await refineSvg(currentContent, instruction);
      
      const newSvg: GeneratedSvg = {
        id: crypto.randomUUID(),
        content: refinedContent,
        prompt: instruction,
        timestamp: Date.now()
      };

      setCurrentSvg(newSvg);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      setError({
        message: "Refinement Failed",
        details: err.message || "Could not refine the SVG."
      });
    } finally {
      setIsRefining(false);
    }
  };

  // Handle saving manual edits from the Editor
  const handleSave = (content: string) => {
      if (currentSvg) {
          setCurrentSvg({
              ...currentSvg,
              content: content
          });
      }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 pt-8">      
      <main className="pb-20">
        
        {/* HOMEPAGE VIEW */}
        {view === 'home' && (
          <>
            <InputSection onGenerate={handleGenerate} status={status} />
            
            {status === GenerationStatus.ERROR && error && !currentSvg && (
              <div className="max-w-2xl mx-auto mt-8 px-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-200">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-400">{error.message}</h4>
                    <p className="text-sm text-red-300/70 mt-1">{error.details}</p>
                  </div>
                </div>
              </div>
            )}

            {status === GenerationStatus.SUCCESS && currentSvg && (
              <SvgPreview 
                data={currentSvg} 
                onEdit={() => setView('editor')}
              />
            )}
            
            {status === GenerationStatus.IDLE && (
              <div className="max-w-2xl mx-auto mt-16 text-center px-4 opacity-50 pointer-events-none select-none">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-zinc-900/50 border border-white/5 mb-4">
                    <svg className="w-12 h-12 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
                <p className="text-zinc-600 text-sm">Generated artwork will appear here</p>
              </div>
            )}
          </>
        )}

        {/* EDITOR VIEW */}
        {view === 'editor' && currentSvg && (
          <>
            {/* Show refine errors if any */}
            {error && (
               <div className="max-w-4xl mx-auto mt-4 mb-4 px-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-200 flex items-center gap-2">
                     <AlertCircle className="w-4 h-4" />
                     <span>{error.message}: {error.details}</span>
                  </div>
               </div>
            )}
            
            <Editor 
               data={currentSvg}
               onRefine={handleRefine}
               isRefining={isRefining}
               onBack={() => setView('home')}
               onSave={handleSave}
            />
          </>
        )}

      </main>
    </div>
  );
};

export default App;
