import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icon';

interface ImageEditModalProps {
  src: string;
  onSave: (newSrc: string) => void;
  onClose: () => void;
}

type AspectRatio = 'original' | '1:1' | '16:9' | '4:3';

export const ImageEditModal: React.FC<ImageEditModalProps> = ({ src, onSave, onClose }) => {
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    sepia: 0,
    zoom: 100,
  });

  const [aspect, setAspect] = useState<AspectRatio>('original');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      imageRef.current = img;
      render();
    };
  }, [src]);

  useEffect(() => {
    if (imageRef.current) render();
  }, [filters, aspect, offset]);

  const render = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine target canvas size based on aspect ratio
    let targetWidth = 800; // Fixed preview base width
    let targetHeight = 0;

    if (aspect === 'original') {
        targetHeight = (img.height / img.width) * targetWidth;
    } else if (aspect === '1:1') {
        targetHeight = targetWidth;
    } else if (aspect === '16:9') {
        targetHeight = targetWidth * (9/16);
    } else if (aspect === '4:3') {
        targetHeight = targetWidth * (3/4);
    }

    // Set canvas dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply Filter string
    ctx.filter = `
      brightness(${filters.brightness}%) 
      contrast(${filters.contrast}%) 
      saturate(${filters.saturation}%) 
      grayscale(${filters.grayscale}%)
      sepia(${filters.sepia}%)
    `;

    // Calculate image draw dimensions based on zoom
    const zoomScale = filters.zoom / 100;
    
    // Fill strategy: maintain aspect and fill the canvas
    const imgRatio = img.width / img.height;
    const canvasRatio = canvas.width / canvas.height;
    
    let drawWidth, drawHeight;
    if (imgRatio > canvasRatio) {
        drawHeight = canvas.height * zoomScale;
        drawWidth = drawHeight * imgRatio;
    } else {
        drawWidth = canvas.width * zoomScale;
        drawHeight = drawWidth / imgRatio;
    }

    // Centered position + user offset
    const x = (canvas.width - drawWidth) / 2 + offset.x;
    const y = (canvas.height - drawHeight) / 2 + offset.y;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    // Draw a light frame to indicate canvas bounds if it's not original
    if (aspect !== 'original') {
        ctx.filter = 'none';
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
      });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleSave = () => {
    if (canvasRef.current) {
        // Fixed typo: toToDataURL -> toDataURL
        onSave(canvasRef.current.toDataURL('image/jpeg', 0.85));
    }
  };

  const reset = () => {
      setFilters({
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: 0,
        sepia: 0,
        zoom: 100
      });
      setAspect('original');
      setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-dark-surface w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl overflow-hidden rounded-sm border border-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-elevated">
            <div className="flex items-center gap-3">
                <div className="bg-black dark:bg-white p-1.5">
                    <Icons.Image size={16} className="text-white dark:text-black" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-black dark:text-white">
                    Studio e Editimit të Fotos
                </h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors group">
                <Icons.X size={20} className="dark:text-white group-hover:rotate-90 transition-transform" />
            </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            {/* Preview Area - Fixed centering and constraints */}
            <div className="flex-1 bg-black/40 p-4 md:p-12 flex items-center justify-center overflow-hidden relative group/preview">
                <div 
                    className={`relative shadow-2xl transition-transform max-w-full max-h-full flex items-center justify-center ${isDragging ? 'cursor-grabbing scale-[0.99]' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <canvas 
                        ref={canvasRef} 
                        className="max-w-full max-h-[70vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white/5"
                    />
                </div>
                
                {/* Overlay Hint */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest pointer-events-none opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center gap-2 border border-white/10">
                    <Icons.Minimize2 size={12} /> Kliko dhe tërhiq për të lëvizur foton
                </div>
            </div>

            {/* Controls Sidebar - Narrowed and better organized */}
            <div className="w-full lg:w-80 bg-white dark:bg-dark-surface border-l border-gray-100 dark:border-dark-border flex flex-col overflow-hidden shrink-0">
                
                <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                    
                    {/* SECTION: Aspect Ratio & Zoom */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                           <Icons.Columns size={12} /> Madhësia & Prerja
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-2">
                            {(['original', '1:1', '16:9', '4:3'] as AspectRatio[]).map(r => (
                                <button 
                                    key={r}
                                    onClick={() => { setAspect(r); setOffset({x:0, y:0}); }}
                                    className={`py-2 px-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${aspect === r ? 'bg-black text-white border-black dark:bg-white dark:text-black' : 'bg-white text-black border-gray-200 dark:bg-transparent dark:text-white dark:border-dark-border hover:bg-gray-50'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Zmadhimi</label>
                                <span className="text-[10px] font-mono font-bold dark:text-white">{filters.zoom}%</span>
                            </div>
                            <input 
                                type="range" min="100" max="300" step="1"
                                value={filters.zoom}
                                onChange={(e) => setFilters({...filters, zoom: parseInt(e.target.value)})}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                            />
                        </div>
                    </div>

                    {/* SECTION: Adjustments */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                           <Icons.Sun size={12} /> Rregullimet
                        </h4>

                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ndriçimi</label>
                                    <span className="text-[10px] font-mono font-bold dark:text-white">{filters.brightness}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="200" 
                                    value={filters.brightness}
                                    onChange={(e) => setFilters({...filters, brightness: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-gray-200 appearance-none accent-black dark:accent-white"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Kontrasti</label>
                                    <span className="text-[10px] font-mono font-bold dark:text-white">{filters.contrast}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="200" 
                                    value={filters.contrast}
                                    onChange={(e) => setFilters({...filters, contrast: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-gray-200 appearance-none accent-black dark:accent-white"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saturimi</label>
                                    <span className="text-[10px] font-mono font-bold dark:text-white">{filters.saturation}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="200" 
                                    value={filters.saturation}
                                    onChange={(e) => setFilters({...filters, saturation: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-gray-200 appearance-none accent-black dark:accent-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION: Special Effects */}
                    <div className="space-y-4 pb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                           <Icons.Palette size={12} /> Efektet
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setFilters({...filters, grayscale: filters.grayscale === 100 ? 0 : 100})}
                                className={`py-3 text-[10px] font-bold uppercase tracking-widest border transition-colors ${filters.grayscale === 100 ? 'bg-black text-white border-black' : 'bg-white border-gray-200 dark:bg-white/5 dark:text-white dark:border-white/10 hover:bg-gray-50'}`}
                            >
                                Bardhë e zi
                            </button>
                            <button 
                                onClick={() => setFilters({...filters, sepia: filters.sepia === 100 ? 0 : 100})}
                                className={`py-3 text-[10px] font-bold uppercase tracking-widest border transition-colors ${filters.sepia === 100 ? 'bg-amber-900 text-amber-50 border-amber-900' : 'bg-white border-gray-200 dark:bg-white/5 dark:text-white dark:border-white/10 hover:bg-gray-50'}`}
                            >
                                Sepia
                            </button>
                        </div>
                    </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-6 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-dark-border space-y-3">
                    <button 
                        onClick={reset}
                        className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <Icons.Eraser size={12} /> Rivendos
                    </button>
                    <button 
                        onClick={handleSave}
                        className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xl active:scale-[0.98]"
                    >
                        <Icons.Check size={16} /> Ruaj
                    </button>
                </div>
            </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
      `}</style>
    </div>
  );
};
