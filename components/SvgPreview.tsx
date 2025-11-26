/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { Download, CheckCircle2, Code, MousePointer2, Palette, X, Trash2, RotateCcw } from 'lucide-react';
import { GeneratedSvg } from '../types';

interface SvgPreviewProps {
  data: GeneratedSvg | null;
}

// Helper to convert color strings to hex for input[type=color]
const rgbToHex = (col: string): string => {
  if (!col || col === 'none' || col === 'transparent') return '#ffffff';
  if (col.startsWith('#')) return col;
  const rgb = col.match(/\d+/g);
  if (!rgb || rgb.length < 3) return '#000000';
  const r = parseInt(rgb[0]);
  const g = parseInt(rgb[1]);
  const b = parseInt(rgb[2]);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const SvgPreview: React.FC<SvgPreviewProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEl, setSelectedEl] = useState<Element | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Force re-render of panel values
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize SVG content when data changes
  useEffect(() => {
    if (data && containerRef.current) {
      containerRef.current.innerHTML = data.content;
      setIsEditing(false);
      setSelectedEl(null);
    }
  }, [data]);

  // Handle click selection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      if (!isEditing) return;
      
      const target = e.target as Element;
      // Find the nearest significant SVG element
      const element = target.closest('path, rect, circle, ellipse, line, polyline, polygon, text, g');
      
      // Ensure we clicked inside our SVG and didn't just click the root container
      // Also avoid selecting the root <svg> element itself
      if (element && container.contains(element) && element.tagName !== 'svg') {
        e.stopPropagation();
        e.preventDefault();
        
        // Update highlight
        container.querySelectorAll('.svg-selected').forEach(el => el.classList.remove('svg-selected'));
        element.classList.add('svg-selected');
        
        setSelectedEl(element);
        setUpdateTrigger(prev => prev + 1);
      } else {
        // Deselect if clicking empty space (but not if clicking sidebar/controls - this listener is on container)
        container.querySelectorAll('.svg-selected').forEach(el => el.classList.remove('svg-selected'));
        setSelectedEl(null);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [isEditing]);

  const getSvgContent = () => {
    if (!containerRef.current) return '';
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return '';
    
    // Clone to clean up class names for export
    const clone = svg.cloneNode(true) as SVGElement;
    clone.querySelectorAll('.svg-selected').forEach(el => el.classList.remove('svg-selected'));
    
    return new XMLSerializer().serializeToString(clone);
  };

  const handleDownload = () => {
    const content = getSvgContent();
    if (!content) return;
    
    const blob = new Blob([content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vectorcraft-${data?.id || 'edit'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    const content = getSvgContent();
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (data && containerRef.current) {
        containerRef.current.innerHTML = data.content;
        setSelectedEl(null);
        setUpdateTrigger(prev => prev + 1);
    }
  };

  // Attribute updaters
  const updateAttribute = (attr: string, value: string | null) => {
    if (!selectedEl) return;
    
    if (value === null || value === 'none') {
      selectedEl.setAttribute(attr, 'none');
      // Override style if present
      if ((selectedEl as HTMLElement).style?.getPropertyValue(attr)) {
         (selectedEl as HTMLElement).style.setProperty(attr, 'none');
      }
    } else {
      selectedEl.setAttribute(attr, value);
      if ((selectedEl as HTMLElement).style?.getPropertyValue(attr)) {
         (selectedEl as HTMLElement).style.setProperty(attr, value);
      }
    }
    setUpdateTrigger(prev => prev + 1);
  };

  const currentFill = selectedEl ? (getComputedStyle(selectedEl).fill || 'none') : '#000000';
  const currentStroke = selectedEl ? (getComputedStyle(selectedEl).stroke || 'none') : 'none';
  const currentStrokeWidth = selectedEl ? (getComputedStyle(selectedEl).strokeWidth || '1') : '1';
  const currentOpacity = selectedEl ? (getComputedStyle(selectedEl).opacity || '1') : '1';
  // Remove 'px' from stroke width for the slider
  const strokeWidthNum = parseFloat(currentStrokeWidth) || 0;

  if (!data) return null;

  return (
    <div className="w-full max-w-7xl mx-auto mt-12 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <style>{`
        .svg-selected {
          outline: 2px dashed #6366f1 !important;
          outline-offset: 2px;
          cursor: pointer;
          vector-effect: non-scaling-stroke;
        }
        ${isEditing ? `
        /* When editing, show hover effects on valid targets */
        .svg-container svg path:hover, 
        .svg-container svg rect:hover, 
        .svg-container svg circle:hover, 
        .svg-container svg ellipse:hover, 
        .svg-container svg line:hover, 
        .svg-container svg polyline:hover, 
        .svg-container svg polygon:hover, 
        .svg-container svg text:hover {
          opacity: 0.8;
          cursor: pointer;
        }
        ` : ''}
      `}</style>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Editor/Preview Area */}
        <div className="flex-1 bg-zinc-900/80 backdrop-blur border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/50">
            <div className="flex items-center gap-4">
               <button
                 onClick={() => {
                    setIsEditing(!isEditing);
                    setSelectedEl(null);
                    // Remove highlights on exit
                    if (containerRef.current) {
                        containerRef.current.querySelectorAll('.svg-selected').forEach(el => el.classList.remove('svg-selected'));
                    }
                 }}
                 className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                   isEditing 
                     ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                     : 'text-zinc-400 hover:text-white hover:bg-white/10'
                 }`}
               >
                 <MousePointer2 className="w-4 h-4" />
                 <span>{isEditing ? 'Editing Mode' : 'View Mode'}</span>
               </button>
               {isEditing && (
                 <span className="text-xs text-zinc-500 animate-pulse hidden sm:inline-block">
                   Select an element to edit
                 </span>
               )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Reset Changes"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/10 my-auto mx-1"></div>
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
          <div className="flex-1 p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-950/50 min-h-[500px] overflow-auto">
            {/* The SVG Container */}
            <div 
              ref={containerRef}
              className={`
                svg-container
                relative w-full max-w-[600px] h-auto transition-all duration-300 
                ${!isEditing ? 'hover:scale-[1.01] filter drop-shadow-2xl' : ''}
              `}
            />
          </div>
          
          <div className="px-4 py-2 bg-zinc-950 border-t border-white/5 flex justify-between text-xs text-zinc-600">
             <span>Generated by Gemini 3 Pro</span>
             <span>{isEditing ? 'Click elements to modify properties' : 'Preview Mode'}</span>
          </div>
        </div>

        {/* Editor Sidebar */}
        {isEditing && (
          <div className="w-full lg:w-80 flex-shrink-0 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-zinc-900/90 backdrop-blur border border-white/10 rounded-2xl p-5 sticky top-24">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                <Palette className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white">Properties</h3>
              </div>

              {selectedEl ? (
                <div className="space-y-6">
                  {/* Fill Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Fill</label>
                        <button onClick={() => updateAttribute('fill', 'none')} className="text-[10px] text-zinc-500 hover:text-white transition-colors">Set None</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/20 shadow-inner group">
                         {currentFill === 'none' && (
                             <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500 pointer-events-none">
                                <X className="w-4 h-4" />
                             </div>
                         )}
                         <input 
                           type="color" 
                           value={rgbToHex(currentFill)}
                           onChange={(e) => updateAttribute('fill', e.target.value)}
                           className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                         />
                      </div>
                      <div className="flex-1">
                        <input 
                           type="text" 
                           value={currentFill} 
                           disabled
                           className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-zinc-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stroke Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Stroke</label>
                        <button onClick={() => updateAttribute('stroke', 'none')} className="text-[10px] text-zinc-500 hover:text-white transition-colors">Set None</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/20 shadow-inner">
                         {currentStroke === 'none' && (
                             <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500 pointer-events-none">
                                <X className="w-4 h-4" />
                             </div>
                         )}
                         <input 
                           type="color" 
                           value={rgbToHex(currentStroke)}
                           onChange={(e) => updateAttribute('stroke', e.target.value)}
                           className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                         />
                      </div>
                      <div className="flex-1">
                         <input 
                           type="range"
                           min="0"
                           max="20"
                           step="0.5"
                           value={strokeWidthNum}
                           onChange={(e) => updateAttribute('stroke-width', e.target.value)}
                           className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                         />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">{strokeWidthNum}px</span>
                    </div>
                  </div>

                  {/* Opacity Control */}
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Opacity</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={currentOpacity}
                        onChange={(e) => updateAttribute('opacity', e.target.value)}
                        className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-xs text-zinc-400 w-8 text-right">{Math.round(parseFloat(currentOpacity) * 100)}%</span>
                    </div>
                  </div>

                  {/* Text Content (only if text element) */}
                  {(selectedEl.tagName === 'text' || selectedEl.tagName === 'tspan') && (
                    <div className="space-y-3 pt-2">
                       <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Text Content</label>
                       <input 
                          type="text" 
                          value={selectedEl.textContent || ''} 
                          onChange={(e) => {
                              selectedEl.textContent = e.target.value;
                              setUpdateTrigger(prev => prev + 1);
                          }}
                          className="w-full bg-zinc-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                       />
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="pt-6 mt-2 border-t border-white/5 space-y-2">
                     <button
                        onClick={() => {
                           selectedEl.remove();
                           setSelectedEl(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-colors"
                     >
                        <Trash2 className="w-4 h-4" />
                        Delete Element
                     </button>
                     <button
                         onClick={() => {
                             setSelectedEl(null);
                             containerRef.current?.querySelectorAll('.svg-selected').forEach(el => el.classList.remove('svg-selected'));
                         }}
                         className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                     >
                         Deselect
                     </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <MousePointer2 className="w-8 h-8 text-zinc-600" />
                  </div>
                  <h4 className="text-zinc-300 font-medium mb-1">No Element Selected</h4>
                  <p className="text-zinc-500 text-sm">Click any shape on the SVG canvas to edit its properties.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
