
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Download, CheckCircle2, Code, PenTool } from 'lucide-react';
import { GeneratedSvg } from '../types';

interface SvgPreviewProps {
  data: GeneratedSvg | null;
  onEdit: () => void;
}

export const SvgPreview: React.FC<SvgPreviewProps> = ({ data, onEdit }) => {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const handleDownload = () => {
    const blob = new Blob([data.content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vectorcraft-${data.id.slice(0, 6)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="bg-zinc-900/80 backdrop-blur border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/50">
            <h3 className="text-sm font-medium text-zinc-400">Preview</h3>
            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Copy SVG Code"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Code className="w-5 h-5" />}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-900 bg-white rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-950/50 min-h-[400px]">
            <div 
              className="relative w-full max-w-[500px] h-auto transition-transform hover:scale-[1.01] duration-300 filter drop-shadow-2xl"
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t border-white/10 bg-zinc-900/50">
              <button 
                 onClick={onEdit}
                 className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
              >
                 <PenTool className="w-5 h-5" />
                 Edit & Refine SVG
              </button>
              <p className="text-center text-xs text-zinc-500 mt-3">
                 Click to open the advanced editor where you can tweak colors, shapes, and use AI to refine the design.
              </p>
          </div>
      </div>
    </div>
  );
};
