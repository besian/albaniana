import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Block } from '../types';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { compressImage, recompressBase64 } from '../pages/admin/Editor';
import { generateArticleImage } from '../services/geminiService';

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onEditImage?: (blockId: string, src: string) => void;
}

const EditableBlock = React.memo(({ 
  html, 
  tagName, 
  className, 
  onChange, 
  placeholder 
}: { 
  html: string, 
  tagName: string, 
  className: string, 
  onChange: (val: string) => void,
  placeholder: string
}) => {
  const contentEditableRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== html) {
        contentEditableRef.current.innerHTML = html;
    }
  }, []);

  useEffect(() => {
    if (contentEditableRef.current && html !== contentEditableRef.current.innerHTML) {
      const isActive = contentEditableRef.current.contains(document.activeElement);
      if (!isActive) {
          contentEditableRef.current.innerHTML = html;
      }
    }
  }, [html]);

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const Tag = tagName as React.ElementType;

  return (
    <Tag
      ref={contentEditableRef}
      className={`${className} empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 outline-none`}
      contentEditable
      onInput={handleInput}
      suppressContentEditableWarning={true}
      data-placeholder={placeholder}
    />
  );
});

const FloatingToolbar = ({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) => {
    const [toolbarVisible, setToolbarVisible] = useState(false);
    const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                setToolbarVisible(false);
                return;
            }
            const range = selection.getRangeAt(0);
            if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
                setToolbarVisible(false);
                return;
            }
            let parent = range.commonAncestorContainer as HTMLElement;
            if (parent.nodeType === 3) parent = parent.parentElement as HTMLElement;
            if (!parent.closest('[contenteditable="true"]')) {
                setToolbarVisible(false);
                return;
            }
            const rect = range.getBoundingClientRect();
            setToolbarPosition({
                top: rect.top - 50,
                left: rect.left + (rect.width / 2) - 150
            });
            setToolbarVisible(true);
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [containerRef]);

    const format = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
    };

    const removeSpacing = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let ancestor = selection.getRangeAt(0).commonAncestorContainer;
        if (ancestor.nodeType === 3 && ancestor.parentElement) ancestor = ancestor.parentElement;
        const el = ancestor as HTMLElement;
        const clean = (e: HTMLElement) => {
             e.style.lineHeight = '';
             e.style.margin = '';
             e.style.padding = '';
        };
        let current = el;
        while(current && current.getAttribute('contenteditable') !== 'true') {
            clean(current);
            current = current.parentElement as HTMLElement;
        }
        const children = el.querySelectorAll('*');
        children.forEach((child) => clean(child as HTMLElement));
    };

    const changeCase = (type: 'upper' | 'lower' | 'smallcaps') => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        if (type === 'smallcaps') {
            const span = document.createElement('span');
            span.style.fontVariant = 'small-caps';
            const range = selection.getRangeAt(0);
            span.appendChild(range.extractContents());
            range.insertNode(span);
            return;
        }
        const range = selection.getRangeAt(0);
        const text = range.toString();
        const newNode = document.createTextNode(type === 'upper' ? text.toUpperCase() : text.toLowerCase());
        range.deleteContents();
        range.insertNode(newNode);
    };

    if (!toolbarVisible) return null;

    return (
        <div 
            ref={toolbarRef}
            style={{ top: toolbarPosition.top, left: Math.max(10, toolbarPosition.left) }}
            className="fixed z-50 bg-black/50 backdrop-blur-md text-white rounded shadow-xl flex items-center p-1 gap-0.5 animate-in fade-in zoom-in-95 duration-100 max-w-[90vw] overflow-x-auto"
            onMouseDown={(e) => e.preventDefault()}
        >
             <button onClick={() => format('bold')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Bold size={14} /></button>
             <button onClick={() => format('italic')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Italic size={14} /></button>
             <button onClick={() => format('underline')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Underline size={14} /></button>
             <button onClick={() => format('strikeThrough')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Strikethrough size={14} /></button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <button onClick={() => format('justifyLeft')} className="p-1.5 hover:bg-white/20 rounded"><Icons.AlignLeft size={14} /></button>
             <button onClick={() => format('justifyCenter')} className="p-1.5 hover:bg-white/20 rounded"><Icons.AlignCenter size={14} /></button>
             <button onClick={() => format('justifyRight')} className="p-1.5 hover:bg-white/20 rounded"><Icons.AlignRight size={14} /></button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <button onClick={() => format('insertUnorderedList')} className="p-1.5 hover:bg-white/20 rounded"><Icons.List size={14} /></button>
             <button onClick={() => format('insertOrderedList')} className="p-1.5 hover:bg-white/20 rounded"><Icons.ListOrdered size={14} /></button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <button onClick={() => format('subscript')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Subscript size={14} /></button>
             <button onClick={() => format('superscript')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Superscript size={14} /></button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <button onClick={() => changeCase('lower')} className="p-1.5 hover:bg-white/20 rounded text-[10px] font-bold">aa</button>
             <button onClick={() => changeCase('upper')} className="p-1.5 hover:bg-white/20 rounded text-[10px] font-bold">AA</button>
             <button onClick={() => changeCase('smallcaps')} className="p-1.5 hover:bg-white/20 rounded text-[10px] font-bold uppercase" style={{fontVariant: 'small-caps'}}>Aa</button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <div className="relative group p-1.5 hover:bg-white/20 rounded cursor-pointer">
                <Icons.Palette size={14} />
                <input 
                    type="color" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                    onChange={(e) => format('foreColor', e.target.value)}
                />
             </div>
             <button onClick={() => format('hiliteColor', 'transparent')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Highlighter size={14} /></button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <button onClick={removeSpacing} className="p-1.5 hover:bg-white/20 rounded"><Icons.Minimize2 size={14} /></button>
             <button onClick={() => format('removeFormat')} className="p-1.5 hover:bg-white/20 rounded"><Icons.Eraser size={14} /></button>
             <div className="w-px h-4 bg-white/20 mx-1"></div>
             <button onClick={() => format('fontName', 'Source Serif 4')} className="p-1.5 hover:bg-white/20 rounded font-serif text-[10px]">Serif</button>
             <button onClick={() => format('fontName', 'Inter')} className="p-1.5 hover:bg-white/20 rounded font-sans text-[10px]">Sans</button>
          </div>
    );
};

export const BlockEditor: React.FC<BlockEditorProps> = ({ blocks, onChange, onEditImage }) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const blockImageInputRef = useRef<HTMLInputElement>(null);
  const [activeImageBlockId, setActiveImageBlockId] = useState<string | null>(null);
  
  // AI Block Gen State
  const [isGeneratingBlock, setIsGeneratingBlock] = useState<string | null>(null);
  const [aiBlockPrompt, setAiBlockPrompt] = useState('');
  const [aiBlockStyle, setAiBlockStyle] = useState('Photorealistic news style');

  const addBlock = (type: Block['type'], initialContent: string = '') => {
    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      content: initialContent
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, content: string) => {
    onChange(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    if (direction === 'up' && index > 0) {
        [newBlocks[index], newBlocks[index-1]] = [newBlocks[index-1], newBlocks[index]];
    } else if (direction === 'down' && index < newBlocks.length - 1) {
        [newBlocks[index], newBlocks[index+1]] = [newBlocks[index+1], newBlocks[index]];
    }
    onChange(newBlocks);
  };

  const handleBlockImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && activeImageBlockId) {
          try {
              const base64 = await compressImage(files[0], 0.35, 700);
              updateBlock(activeImageBlockId, base64);
          } catch (err) {
              console.error(err);
              alert("Gabim gjatë ngarkimit të fotos.");
          }
      }
      setActiveImageBlockId(null);
  };

  const handleGenerateBlockImage = async (blockId: string) => {
      if (!aiBlockPrompt) return alert("Ju lutem shkruani një përshkrim për foton.");
      setIsGeneratingBlock(blockId);
      try {
          const rawBase64 = await generateArticleImage({
              prompt: aiBlockPrompt,
              style: aiBlockStyle,
              aspectRatio: '16:9'
          });
          const compressed = await recompressBase64(rawBase64, 0.35, 700);
          updateBlock(blockId, compressed);
          setAiBlockPrompt('');
      } catch (err: any) {
          alert("Gabim gjatë gjenerimit: " + err.message);
      } finally {
          setIsGeneratingBlock(null);
      }
  };

  return (
    <div className="space-y-6 relative" ref={containerRef}>
      <FloatingToolbar containerRef={containerRef} />
      
      <input 
        type="file" 
        accept="image/*" 
        ref={blockImageInputRef} 
        onChange={handleBlockImageUpload} 
        className="hidden" 
      />

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <div key={block.id} className="group relative border border-gray-100 hover:border-gray-300 rounded-md p-2 bg-white transition-all">
            <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-white shadow-sm border rounded p-1 z-10">
              <button onClick={() => moveBlock(index, 'up')} className="p-1 hover:bg-gray-100 text-gray-500"><Icons.ChevronDown className="rotate-180" size={14} /></button>
              <button onClick={() => moveBlock(index, 'down')} className="p-1 hover:bg-gray-100 text-gray-500"><Icons.ChevronDown size={14} /></button>
              <button onClick={() => removeBlock(block.id)} className="p-1 hover:bg-red-50 text-red-500"><Icons.X size={14} /></button>
            </div>

            {block.type === 'heading' && (
              <EditableBlock
                tagName="h2"
                className="w-full text-2xl font-serif font-bold text-gray-800 border-none focus:ring-0"
                placeholder={t('block.ph.heading')}
                html={block.content}
                onChange={(val) => updateBlock(block.id, val)}
              />
            )}

            {block.type === 'paragraph' && (
              <EditableBlock
                tagName="div"
                className="w-full min-h-[100px] text-gray-700 font-merriweather leading-relaxed border-none focus:ring-0 resize-none"
                placeholder={t('block.ph.paragraph')}
                html={block.content}
                onChange={(val) => updateBlock(block.id, val)}
              />
            )}

            {block.type === 'quote' && (
              <div className="flex gap-4">
                  <div className="w-1 bg-black shrink-0"></div>
                  <EditableBlock
                      tagName="blockquote"
                      className="w-full min-h-[80px] text-xl font-serif italic text-gray-600 border-none focus:ring-0 bg-transparent"
                      placeholder={t('block.ph.quote')}
                      html={block.content}
                      onChange={(val) => updateBlock(block.id, val)}
                  />
              </div>
            )}

            {block.type === 'image' && (
              <div className="space-y-2">
                  {block.content ? (
                       <div className="relative bg-gray-50 p-2 rounded">
                          <img src={block.content} alt="Block content" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                  onClick={() => onEditImage && onEditImage(block.id, block.content)}
                                  className="absolute top-2 left-2 bg-white/90 p-2 shadow-lg hover:bg-white text-black rounded pointer-events-auto"
                                  title="Edito"
                               >
                                  <Icons.Settings size={14} />
                               </button>
                               <button 
                                  onClick={() => updateBlock(block.id, '')}
                                  className="absolute top-2 right-2 bg-red-600/90 text-white p-2 shadow-lg hover:bg-red-700 rounded pointer-events-auto"
                                  title="Hiq"
                              >
                                  <Icons.X size={14} />
                              </button>
                          </div>
                       </div>
                  ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded p-8 text-center bg-gray-50 flex flex-col items-center gap-4">
                          {isGeneratingBlock === block.id ? (
                               <div className="flex flex-col items-center gap-3">
                                   <Icons.Clock size={40} className="text-black animate-spin" />
                                   <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Duke gjeneruar me AI...</p>
                               </div>
                          ) : (
                               <>
                                <Icons.Image size={32} className="text-gray-400" />
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{t('block.ph.image')}</p>
                                <div className="flex flex-col w-full max-w-sm gap-4">
                                    <div className="bg-white p-4 border border-gray-200 shadow-sm space-y-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                            <Icons.Sun size={12} /> Gjenero me Inteligjencë Artificiale
                                        </div>
                                        <textarea 
                                            value={aiBlockPrompt}
                                            onChange={(e) => setAiBlockPrompt(e.target.value)}
                                            placeholder="Përshkruani foton që dëshironi..."
                                            className="w-full p-2 border border-gray-200 text-xs focus:ring-0 focus:border-black resize-none"
                                            rows={2}
                                        />
                                        <button 
                                            onClick={() => handleGenerateBlockImage(block.id)}
                                            className="w-full bg-black text-white text-[10px] font-bold uppercase tracking-widest py-2 hover:bg-gray-800 transition-colors"
                                        >
                                            Gjenero Foto
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                        <span className="text-[10px] text-gray-400 font-bold">OSE</span>
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            setActiveImageBlockId(block.id);
                                            blockImageInputRef.current?.click();
                                        }}
                                        className="bg-white border border-gray-300 text-black text-[10px] font-bold uppercase tracking-widest py-2 hover:bg-gray-50 transition-colors"
                                    >
                                        Ngarko nga Kompjuteri
                                    </button>
                                    
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-200 rounded p-2 text-[10px]"
                                        placeholder="Ose vendos URL të fotos këtu..."
                                        onBlur={(e) => updateBlock(block.id, e.target.value)}
                                    />
                                </div>
                               </>
                          )}
                      </div>
                  )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        <button onClick={() => addBlock('paragraph')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-black text-gray-700 hover:text-black text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
            <Icons.FileText size={16} /> {t('block.paragraph')}
        </button>
        <button onClick={() => addBlock('heading')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-black text-gray-700 hover:text-black text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
            <span className="font-serif font-black text-lg leading-none">T</span> {t('block.heading')}
        </button>
        <button onClick={() => addBlock('image')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-black text-gray-700 hover:text-black text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
            <Icons.Image size={16} /> {t('block.image')}
        </button>
        <button onClick={() => addBlock('quote')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-black text-gray-700 hover:text-black text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
            <span className="font-serif italic text-lg leading-none">"</span> {t('block.quote')}
        </button>
      </div>
    </div>
  );
};
