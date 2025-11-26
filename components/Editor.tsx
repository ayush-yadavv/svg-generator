
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Download, CheckCircle2, Code, MousePointer2, Palette, X, Trash2, RotateCcw, Sparkles, Send, Loader2, Move, Maximize, RotateCw, ArrowLeft, Save, Layers, ChevronLeft, ChevronRight, Square, Circle, Type, Slash, ChevronDown, ChevronUp } from 'lucide-react';
import { GeneratedSvg } from '../types';

interface EditorProps {
  data: GeneratedSvg;
  onRefine: (currentSvg: string, instruction: string) => void;
  isRefining: boolean;
  onBack: () => void;
  onSave: (content: string) => void;
}

interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotate: number;
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

export const Editor: React.FC<EditorProps> = ({ data, onRefine, isRefining, onBack, onSave }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(true); // Default to editing mode in Editor page
  const [selectedEl, setSelectedEl] = useState<SVGElement | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Used to force re-renders of property panel
  const [refinePrompt, setRefinePrompt] = useState('');
  
  // Layer Panel State
  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [layers, setLayers] = useState<SVGElement[]>([]);

  // Transformation State
  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, scale: 1, rotate: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number, initialX: number, initialY: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  
  const scanLayers = useCallback(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) {
        setLayers([]);
        return;
    }
    // Flattened list of interactive elements
    const elements = Array.from(svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, text, g')) as SVGElement[];
    setLayers(elements);
  }, []);

  // Initialize SVG content when data changes
  useEffect(() => {
    if (data && containerRef.current) {
      containerRef.current.innerHTML = data.content;
      setSelectedEl(null);
      setRefinePrompt('');
      setTransform({ x: 0, y: 0, scale: 1, rotate: 0 });
      scanLayers();
    }
  }, [data.id, data.content, scanLayers]); 

  // Parse transforms when element is selected
  useEffect(() => {
    if (selectedEl) {
        const transformStr = selectedEl.getAttribute('transform') || '';
        
        const translateMatch = transformStr.match(/translate\(([-\d.]+)[, ]+([-\d.]+)\)/);
        const rotateMatch = transformStr.match(/rotate\(([-\d.]+)/);
        const scaleMatch = transformStr.match(/scale\(([-\d.]+)\)/);

        setTransform({
            x: translateMatch ? parseFloat(translateMatch[1]) : 0,
            y: translateMatch ? parseFloat(translateMatch[2]) : 0,
            rotate: rotateMatch ? parseFloat(rotateMatch[1]) : 0,
            scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
        });
    }
  }, [selectedEl]);

  const applyTransform = useCallback((newState: TransformState) => {
      if (!selectedEl) return;
      
      let cx = 0, cy = 0;
      try {
          const bbox = selectedEl.getBBox();
          cx = bbox.x + bbox.width / 2;
          cy = bbox.y + bbox.height / 2;
      } catch (e) {
          // Fallback
      }

      const t = `translate(${newState.x}, ${newState.y}) rotate(${newState.rotate}, ${cx}, ${cy}) scale(${newState.scale})`;
      
      selectedEl.setAttribute('transform', t);
      setTransform(newState);
      setUpdateTrigger(prev => prev + 1);
  }, [selectedEl]);

  // Global Mouse Handlers for Dragging
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
        if (!isDragging || !selectedEl || !dragStartRef.current || !containerRef.current) return;

        e.preventDefault();
        
        const svg = containerRef.current.querySelector('svg');
        if (!svg) return;

        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        
        const inverseCtm = ctm.inverse();
        
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const loc = pt.matrixTransform(inverseCtm);
        
        const startPt = svg.createSVGPoint();
        startPt.x = dragStartRef.current.x;
        startPt.y = dragStartRef.current.y;
        const startLoc = startPt.matrixTransform(inverseCtm);

        const dx = loc.x - startLoc.x;
        const dy = loc.y - startLoc.y;

        const newX = dragStartRef.current.initialX + dx;
        const newY = dragStartRef.current.initialY + dy;

        applyTransform({
            ...transform,
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10
        });
    };

    const handleWindowMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
    };

    if (isDragging) {
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, selectedEl, transform, applyTransform]);

  const selectElement = useCallback((element: SVGElement | null) => {
    if (!containerRef.current) return;
    
    // Clear previous selection
    containerRef.current.querySelectorAll('.svg-selected').forEach(el => el.classList.remove('svg-selected'));

    if (element) {
        element.classList.add('svg-selected');
        setSelectedEl(element);
        setUpdateTrigger(prev => prev + 1);
    } else {
        setSelectedEl(null);
    }
  }, []);

  // Handle click selection on canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!isEditing) return;
      
      const target = e.target as SVGElement;
      const element = target.closest('path, rect, circle, ellipse, line, polyline, polygon, text, g') as SVGElement;
      
      if (element && container.contains(element) && element.tagName !== 'svg') {
         if (element === selectedEl) {
             e.preventDefault();
             setIsDragging(true);
             dragStartRef.current = {
                 x: e.clientX,
                 y: e.clientY,
                 initialX: transform.x,
                 initialY: transform.y
             };
         } else {
             selectElement(element);
         }
      } else {
        if (target.closest('.svg-container')) {
             selectElement(null);
        }
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    return () => container.removeEventListener('mousedown', handleMouseDown);
  }, [isEditing, selectedEl, transform, selectElement]);

  const getSvgContent = () => {
    if (!containerRef.current) return '';
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return '';
    
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
    link.download = `vectorcraft-edit-${data.id.slice(0, 6)}.svg`;
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

  const handleManualSave = () => {
      const content = getSvgContent();
      if(content) {
          onSave(content);
      }
  }

  const handleRefineSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!refinePrompt.trim() || isRefining) return;
      
      const currentContent = getSvgContent();
      if (currentContent) {
          onRefine(currentContent, refinePrompt);
      }
  };

  const updateAttribute = (attr: string, value: string | null) => {
    if (!selectedEl) return;
    
    if (value === null || value === 'none') {
      selectedEl.setAttribute(attr, 'none');
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
    setLayers(prev => [...prev]); 
  };

  const handleBackWithSave = () => {
      const content = getSvgContent();
      if(content) onSave(content);
      onBack();
  }

  const handleDeleteElement = () => {
    if(selectedEl) {
        selectedEl.remove();
        setSelectedEl(null);
        scanLayers();
    }
  }

  const getLayerIcon = (tagName: string) => {
      switch(tagName) {
          case 'rect': return <Square className="w-3 h-3" />;
          case 'circle': 
          case 'ellipse': return <Circle className="w-3 h-3" />;
          case 'text':
          case 'tspan': return <Type className="w-3 h-3" />;
          case 'line':
          case 'polyline': return <Slash className="w-3 h-3" />;
          default: return <Move className="w-3 h-3" />;
      }
  }

  const currentFill = selectedEl ? (getComputedStyle(selectedEl).fill || 'none') : '#000000';
  const currentStroke = selectedEl ? (getComputedStyle(selectedEl).stroke || 'none') : 'none';
  const currentStrokeWidth = selectedEl ? (getComputedStyle(selectedEl).strokeWidth || '1') : '1';
  const currentOpacity = selectedEl ? (getComputedStyle(selectedEl).opacity || '1') : '1';
  const strokeWidthNum = parseFloat(currentStrokeWidth) || 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <style>{`
        .svg-selected {
          outline: 2px dashed #6366f1 !important;
          outline-offset: 2px;
          cursor: grab;
          vector-effect: non-scaling-stroke;
        }
        .svg-selected:active {
            cursor: grabbing;
        }
        ${isEditing ? `
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

      {/* Navbar for Editor */}
      <div className="flex items-center justify-between mb-6">
          <button onClick={handleBackWithSave} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
          </button>
          <div className="flex items-center gap-3">
               <button 
                  onClick={handleManualSave}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
               >
                   <Save className="w-4 h-4" />
                   Save Changes
               </button>
          </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[85vh] h-auto">
        
        {/* Left Sidebar: Layers */}
        <div 
          className={`
            flex-shrink-0 border border-white/10 rounded-2xl bg-zinc-900/90 backdrop-blur flex flex-col overflow-hidden
            transition-all duration-300 ease-in-out
            ${isLayersOpen 
              ? 'lg:w-64 w-full h-64 lg:h-full' // Desktop: w-64, Mobile: h-64
              : 'lg:w-12 w-full h-14 lg:h-full' // Desktop: w-12, Mobile: h-14 (Header only)
            }
          `}
        >
             <div className="p-3 border-b border-white/10 flex items-center justify-between bg-zinc-900/50 h-14 flex-shrink-0">
                 {/* Only show title if open OR if we are on mobile (where width is full) */}
                 <div className={`flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-opacity duration-200 ${!isLayersOpen ? 'lg:opacity-0 lg:w-0 overflow-hidden' : 'opacity-100'}`}>
                     <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                     <span className="whitespace-nowrap">Layers</span>
                 </div>
                 <button 
                    onClick={() => setIsLayersOpen(!isLayersOpen)}
                    className="p-1 hover:bg-white/10 rounded text-zinc-400"
                 >
                     {/* Desktop Icons */}
                     <span className="hidden lg:block">
                        {isLayersOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                     </span>
                     {/* Mobile Icons */}
                     <span className="block lg:hidden">
                        {isLayersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                     </span>
                 </button>
             </div>
             
             {/* Layer List */}
             <div className={`flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar ${!isLayersOpen ? 'hidden lg:block' : 'block'}`}>
                 {layers.length === 0 ? (
                     <div className={`text-xs text-zinc-500 text-center py-4 ${!isLayersOpen ? 'lg:hidden' : ''}`}>No elements found</div>
                 ) : (
                     layers.map((el, idx) => {
                         const isSelected = el === selectedEl;
                         const fill = getComputedStyle(el).fill;
                         const safeFill = (!fill || fill === 'none') ? 'transparent' : fill;

                         return (
                             <button
                                 key={idx}
                                 onClick={() => selectElement(el)}
                                 className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors group ${isSelected ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/5 text-zinc-400'}`}
                                 title={el.tagName}
                             >
                                 <div className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 border border-white/5 flex-shrink-0">
                                     {getLayerIcon(el.tagName)}
                                 </div>
                                 <span className={`flex-1 text-left truncate font-mono transition-opacity ${!isLayersOpen ? 'lg:hidden' : ''}`}>
                                     {el.id ? `#${el.id}` : el.tagName}
                                 </span>
                                 <div 
                                    className={`w-3 h-3 rounded-full border border-white/20 shadow-sm flex-shrink-0 ${!isLayersOpen ? 'lg:hidden' : ''}`}
                                    style={{ backgroundColor: safeFill }}
                                 />
                             </button>
                         );
                     })
                 )}
             </div>
        </div>

        {/* Main Editor/Preview Area */}
        <div className="flex-1 bg-zinc-900/80 backdrop-blur border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative min-h-[500px] lg:min-h-0">
          {/* Overlay Loader for Refinement */}
          {isRefining && (
             <div className="absolute inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center">
                 <div className="text-center">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-3" />
                    <p className="text-white font-medium">Refining your artwork...</p>
                 </div>
             </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/50">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-500/10 text-indigo-300">
                 <MousePointer2 className="w-4 h-4" />
                 <span className="hidden sm:inline">Editor Active</span>
               </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                     // Reset to initial prop data
                     if (containerRef.current) {
                        containerRef.current.innerHTML = data.content;
                        setSelectedEl(null);
                        setUpdateTrigger(p => p+1);
                        scanLayers();
                     }
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Reset to Original"
                disabled={isRefining}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/10 my-auto mx-1"></div>
              <button
                onClick={handleCopyCode}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Copy SVG Code"
                disabled={isRefining}
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Code className="w-5 h-5" />}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-900 bg-white rounded-lg hover:bg-zinc-200 transition-colors"
                disabled={isRefining}
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-950/50 overflow-auto">
            <div 
              ref={containerRef}
              className="svg-container relative w-full max-w-[600px] h-auto"
            />
          </div>
          
          {/* Refinement Bar */}
          <div className="bg-zinc-950 border-t border-white/10 p-4">
              <form onSubmit={handleRefineSubmit} className="flex gap-2 relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                     <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <input 
                    type="text" 
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder="Describe changes to refine... (e.g. 'Make the circle blue', 'Add a star')"
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none placeholder:text-zinc-500"
                    disabled={isRefining}
                  />
                  <button 
                    type="submit"
                    disabled={!refinePrompt.trim() || isRefining}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Refine
                  </button>
              </form>
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <div className="w-full lg:w-72 flex-shrink-0 animate-in slide-in-from-right-4 duration-500 lg:h-full">
            <div className="bg-zinc-900/90 backdrop-blur border border-white/10 rounded-2xl p-5 lg:h-full lg:overflow-y-auto">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                <Palette className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white">Properties</h3>
              </div>

              {selectedEl ? (
                <div className="space-y-6">
                  
                  {/* Transform Section */}
                  <div className="space-y-4 pb-6 border-b border-white/5">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          <Move className="w-3 h-3" /> Transform
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500">X</label>
                              <input 
                                  type="number" 
                                  value={transform.x}
                                  onChange={(e) => applyTransform({...transform, x: Number(e.target.value)})}
                                  className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500">Y</label>
                              <input 
                                  type="number" 
                                  value={transform.y}
                                  onChange={(e) => applyTransform({...transform, y: Number(e.target.value)})}
                                  className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                              />
                          </div>
                      </div>

                      <div className="space-y-2">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <Maximize className="w-3 h-3" /> Scale
                             </div>
                             <span className="text-[10px] text-zinc-400">{transform.scale}x</span>
                          </div>
                          <input 
                              type="range"
                              min="0.1"
                              max="3"
                              step="0.1"
                              value={transform.scale}
                              onChange={(e) => applyTransform({...transform, scale: Number(e.target.value)})}
                              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                      </div>

                      <div className="space-y-2">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <RotateCw className="w-3 h-3" /> Rotate
                             </div>
                             <span className="text-[10px] text-zinc-400">{transform.rotate}°</span>
                          </div>
                          <input 
                              type="range"
                              min="0"
                              max="360"
                              value={transform.rotate}
                              onChange={(e) => applyTransform({...transform, rotate: Number(e.target.value)})}
                              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                      </div>
                  </div>

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
                              scanLayers();
                          }}
                          className="w-full bg-zinc-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                       />
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="pt-6 mt-2 border-t border-white/5 space-y-2">
                     <button
                        onClick={handleDeleteElement}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-colors"
                     >
                        <Trash2 className="w-4 h-4" />
                        Delete Element
                     </button>
                     <button
                         onClick={() => {
                             selectElement(null);
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
                  <p className="text-zinc-500 text-sm">Select an element from the canvas or layers panel to edit.</p>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
