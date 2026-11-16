import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as mammoth from 'mammoth';
import { Article, ArticleStatus, Block, Section, UserRole } from '../../types';
import { SUBSECTIONS } from '../../constants';
import { Icons } from '../../components/Icon';
import { BlockEditor } from '../../components/BlockEditor';
import { generateArticleImage } from '../../services/geminiService';
import { useLanguage } from '../../contexts/LanguageContext';
import { ImageEditModal } from '../../components/ImageEditModal';

interface EditorProps {
  articles: Article[];
  currentUser: any;
  onSave: (article: Article) => void;
}

/**
 * Aggressive Image Compressor to keep Firestore docs under 1MB.
 */
export const compressImage = (file: File, quality: number = 0.4, maxDim: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            recompressBase64(dataUrl, quality, maxDim).then(resolve).catch(reject);
        };
        reader.onerror = (e) => reject(e);
    });
};

/**
 * Re-compresses a base64 string to a smaller version.
 */
export const recompressBase64 = (base64: string, quality: number = 0.4, maxDim: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Canvas Context Error"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (e) => reject(e);
    });
};

export const Editor: React.FC<EditorProps> = ({ articles, currentUser, onSave }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  
  // Local State
  const [formData, setFormData] = useState<Partial<Article>>({
    title: '',
    kicker: '',
    subtitle: '',
    section: Section.LAJME,
    subcategory: '',
    status: ArticleStatus.DRAFT,
    content: [],
    tags: [],
    publishDate: '',
    views: 0
  });
  const [tagInput, setTagInput] = useState('');
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiStyle, setGeminiStyle] = useState('Black and white artistic photography, high contrast');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Image Editing State
  const [editingImage, setEditingImage] = useState<{ src: string, target: 'hero' | string } | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    if (id && id !== 'new') {
      if (articles.length > 0) {
          const found = articles.find(a => a.id === id);
          if (found) {
              if (currentUser.role === UserRole.AUTHOR && found.authorId !== currentUser.id) {
                  alert("Nuk keni leje të editoni këtë artikull.");
                  navigate('/admin');
                  return;
              }
              if (currentUser.role === UserRole.EDITOR && found.section !== currentUser.assignedSection) {
                  alert("Nuk keni leje të editoni këtë seksion.");
                  navigate('/admin');
                  return;
              }
              setFormData({
                  ...found,
                  content: Array.isArray(found.content) ? found.content : []
              });
              setIsInitialized(true);
          }
      }
    } else {
        setFormData({
            id: Date.now().toString(),
            title: '',
            kicker: '',
            subtitle: '',
            authorId: currentUser.id,
            authorName: currentUser.name,
            section: currentUser.role === UserRole.EDITOR ? currentUser.assignedSection : Section.LAJME, 
            subcategory: '',
            status: ArticleStatus.DRAFT,
            content: [{ id: '1', type: 'paragraph', content: '' }],
            tags: [],
            views: 0,
            publishDate: new Date().toISOString()
        });
        setIsInitialized(true);
    }
  }, [id, articles, currentUser, navigate, isInitialized]);

  const validateArticleSize = (article: Article): boolean => {
      const jsonString = JSON.stringify(article);
      const sizeInBytes = new Blob([jsonString]).size;
      const LIMIT = 1048576; // 1MB
      const SAFE_LIMIT = 980000; 

      if (sizeInBytes > SAFE_LIMIT) {
          const mb = (sizeInBytes / 1024 / 1024).toFixed(2);
          alert(`Artikulli është shumë i madh (${mb} MB). Kjo ndodh kur ka shumë foto në përmbajtje ose fotot janë shumë të mëdha. Provoni të fshini ndonjë foto ose të përdorni foto më të vogla. Limiti është 1MB.`);
          return false;
      }
      return true;
  };

  const handleSave = async () => {
    if (!formData.title) return alert('Titulli është i detyrueshëm');
    
    setIsSaving(true);
    try {
        const articleToSave = { 
            ...formData,
            id: formData.id || Date.now().toString(),
            authorId: formData.authorId || currentUser.id,
            authorName: formData.authorName || currentUser.name,
            views: formData.views || 0,
            publishDate: formData.publishDate || new Date().toISOString()
        } as Article;

        if (!validateArticleSize(articleToSave)) {
            setIsSaving(false);
            return;
        }

        await onSave(articleToSave);
        navigate('/admin');
    } catch (error: any) {
        console.error("Save error:", error);
        alert("Gabim gjatë ruajtjes së artikullit. " + (error.message || "Provoni të zvogëloni fotot."));
    } finally {
        setIsSaving(false);
    }
  };

  const currentSubsections = formData.section ? SUBSECTIONS[formData.section] : [];

  const handleAddTag = () => {
      const val = tagInput.trim();
      if (val && !formData.tags?.includes(val)) {
          setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), val] }));
          setTagInput('');
      }
  };

  const handleRemoveTag = (tag: string) => {
      setFormData(prev => ({ ...prev, tags: prev.tags?.filter(t => t !== tag) }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          handleAddTag();
      }
  };

  const getInputValueDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const offset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    } catch (e) {
        return '';
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val) {
          setFormData({ ...formData, publishDate: new Date(val).toISOString() });
      }
  };

  const handleGenerateImage = async () => {
    if (!geminiPrompt) return alert('Shkruaj një përshkrim për foton');
    setIsGenerating(true);
    try {
        const base64 = await generateArticleImage({
            prompt: geminiPrompt,
            style: geminiStyle,
            aspectRatio: '16:9'
        });
        const compressed = await recompressBase64(base64, 0.4, 800);
        setGeneratedImage(compressed);
    } catch (e: any) {
        alert("Gabim gjatë gjenerimit: " + e.message);
    } finally {
        setIsGenerating(false);
    }
  };

  const applyImageToHero = () => {
    if (generatedImage) {
        setFormData(prev => ({ ...prev, heroImage: generatedImage }));
        setGeneratedImage(null);
        setGeminiPrompt('');
    }
  };

  const processImageFile = async (file: File) => {
      if (file.type.startsWith('image/')) {
          try {
              const compressedBase64 = await compressImage(file, 0.4, 800);
              setFormData(prev => ({ ...prev, heroImage: compressedBase64 }));
          } catch (e) {
              console.error("Error compressing image:", e);
              alert("Gabim gjatë ngarkimit të fotos.");
          }
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  
  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
          await processImageFile(files[0]);
      }
  };

  const handleHeroImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          await processImageFile(files[0]);
      }
  };

  const handleDocImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const reader = new FileReader();

      reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          try {
              // @ts-ignore
              const mammothLib = mammoth.default || mammoth;
              const result = await mammothLib.extractRawText({ arrayBuffer });
              const text = result.value;
              
              const lines = text.split(/\r?\n/).filter((line: string) => line.trim() !== '');
              const newBlocks: Block[] = lines.map((line: string, idx: number) => {
                const content = line.trim();
                const ts = Date.now() + idx;
                
                if (content.startsWith('t:')) return { id: `${ts}-t`, type: 'heading', content: content.substring(2).trim() };
                if (content.startsWith('mt:')) return { id: `${ts}-mt`, type: 'paragraph', content: content.substring(3).trim() };
                if (content.startsWith('i:')) return { id: `${ts}-i`, type: 'image', content: content.substring(2).trim() };
                if (content.startsWith('q:')) return { id: `${ts}-q`, type: 'quote', content: content.substring(2).trim() };
                
                return { id: `${ts}`, type: 'paragraph', content: content };
              });

              setFormData(prev => ({ ...prev, content: [...(prev.content || []), ...newBlocks] }));
              if (fileInputRef.current) fileInputRef.current.value = '';

          } catch (err) {
              console.error(err);
              alert("Gabim gjatë importimit të dokumentit Word.");
          }
      };
      reader.readAsArrayBuffer(file);
  };

  const onEditBlockImage = (blockId: string, src: string) => {
      setEditingImage({ src, target: blockId });
  };

  const handleImageEditSave = (newSrc: string) => {
      if (editingImage?.target === 'hero') {
          setFormData(prev => ({ ...prev, heroImage: newSrc }));
      } else if (editingImage?.target) {
          setFormData(prev => ({
              ...prev,
              content: prev.content?.map(b => b.id === editingImage.target ? { ...b, content: newSrc } : b)
          }));
      }
      setEditingImage(null);
  };

  if (!formData.id && id !== 'new') return <div className="p-12 text-center text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{t('editor.loading')}</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto bg-white shadow-sm border border-gray-200 min-h-[80vh]">
          {/* Header Inputs */}
          <div className="p-8 border-b border-gray-100 space-y-6">
            <div className="flex justify-end gap-2 items-center">
                <input type="file" accept=".docx" ref={fileInputRef} onChange={handleDocImport} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-gray-500 hover:text-black uppercase tracking-widest flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-sm">
                    <Icons.FileText size={14} /> {t('editor.importWord')}
                </button>
            </div>
            
            <div>
                 <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Mbititull <span className="text-gray-400 font-normal normal-case ml-1">(Opsionale)</span>
                 </label>
                 <input 
                    type="text"
                    value={formData.kicker || ''}
                    onChange={e => setFormData({...formData, kicker: e.target.value})}
                    className="w-full text-lg font-bold text-gray-500 border-none p-0 focus:ring-0 placeholder-gray-300 uppercase tracking-widest"
                    placeholder="Mbititull"
                 />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('editor.title')}</label>
                <div className="flex gap-2 items-start">
                    <textarea 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full text-4xl font-serif font-black text-black border-none p-0 focus:ring-0 placeholder-gray-300 resize-none leading-tight"
                        placeholder={t('editor.titlePlaceholder')}
                        rows={2}
                    />
                </div>
            </div>
            
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('editor.subtitle')}</label>
                <textarea 
                  value={formData.subtitle}
                  onChange={e => setFormData({...formData, subtitle: e.target.value})}
                  className="w-full text-xl text-gray-500 font-light font-sans border-none p-0 focus:ring-0 resize-none placeholder-gray-200"
                  placeholder={t('editor.subtitlePlaceholder')}
                  rows={2}
                />
            </div>
          </div>

          <div className="p-8">
            <BlockEditor 
                blocks={formData.content || []} 
                onChange={blocks => setFormData({...formData, content: blocks})} 
                onEditImage={onEditBlockImage}
            />
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 bg-white border-l border-gray-200 h-auto md:h-screen sticky top-0 overflow-y-auto p-6 space-y-8 shadow-xl z-20">
        <div className="flex flex-col gap-3">
            <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            >
                {isSaving ? <Icons.Clock size={16} className="animate-spin" /> : <Icons.Save size={16} />} 
                {isSaving ? "Duke Ruajtur..." : t('editor.save')}
            </button>
            <button onClick={() => navigate('/admin')} className="w-full py-2 text-gray-400 hover:text-black hover:bg-gray-50 text-xs font-bold uppercase tracking-widest">
                {t('editor.cancel')}
            </button>
        </div>

        {/* Status & Categorization */}
        <div className="space-y-4 pt-6 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('editor.publication')}</h4>
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">{t('editor.status')}</label>
                <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as ArticleStatus})}
                    className="w-full border border-gray-200 bg-gray-50 rounded-none p-2 text-sm focus:border-black focus:ring-0"
                >
                    <option value={ArticleStatus.DRAFT}>Draft</option>
                    <option value={ArticleStatus.REVIEW}>Review</option>
                    {currentUser.role === UserRole.ADMIN && (
                        <>
                            <option value={ArticleStatus.SCHEDULED}>Scheduled</option>
                            <option value={ArticleStatus.PUBLISHED}>Published</option>
                        </>
                    )}
                </select>
            </div>

            {currentUser.role === UserRole.ADMIN && (
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">{t('editor.publishDate')}</label>
                    <input 
                        type="datetime-local" 
                        value={getInputValueDate(formData.publishDate)}
                        onChange={handleDateChange}
                        className="w-full border border-gray-200 bg-gray-50 rounded-none p-2 text-sm focus:border-black focus:ring-0 text-gray-600"
                    />
                </div>
            )}

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">{t('editor.section')}</label>
                <select 
                    value={formData.section}
                    disabled={currentUser.role === UserRole.EDITOR}
                    onChange={e => {
                        setFormData({...formData, section: e.target.value as Section, subcategory: ''});
                    }}
                    className={`w-full border border-gray-200 rounded-none p-2 text-sm focus:border-black focus:ring-0 mb-2 ${currentUser.role === UserRole.EDITOR ? 'bg-gray-100 text-gray-500' : 'bg-gray-50'}`}
                >
                    {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            
            {currentSubsections && (
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">{t('editor.subcategory')}</label>
                    <select
                        value={formData.subcategory || ''}
                        onChange={e => setFormData({...formData, subcategory: e.target.value})}
                        className="w-full border border-gray-200 bg-gray-50 rounded-none p-2 text-sm focus:border-black focus:ring-0"
                    >
                        <option value="">{t('editor.selectSub')}</option>
                        {currentSubsections.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">{t('editor.tags')}</label>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder={t('editor.addTag')}
                        className="flex-1 border border-gray-200 bg-gray-50 p-2 text-sm focus:border-black focus:ring-0"
                    />
                    <button onClick={handleAddTag} className="bg-gray-200 hover:bg-black hover:text-white px-3 transition-colors">
                        <Icons.Plus size={16} />
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    {formData.tags?.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1">
                            #{tag}
                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-600">
                                <Icons.X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-gray-100">
             <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('editor.coverImage')}</h4>
             {formData.heroImage ? (
                 <div className="relative overflow-hidden aspect-video border border-gray-200 group">
                     <img src={formData.heroImage} className="w-full h-full object-cover grayscale" alt="Cover" />
                     {/* Edit button in top left */}
                     <button 
                        onClick={() => setEditingImage({ src: formData.heroImage!, target: 'hero' })} 
                        className="absolute top-2 left-2 bg-white/90 p-2 shadow-lg hover:bg-white transition-all text-black rounded"
                        title="Edito foton"
                    >
                        <Icons.Settings size={14} />
                    </button>
                    {/* Remove button in top right */}
                    <button 
                        onClick={() => setFormData({...formData, heroImage: undefined})} 
                        className="absolute top-2 right-2 bg-white/90 p-2 shadow-lg hover:bg-red-50 transition-all text-red-600 rounded"
                        title="Hiq foton"
                    >
                        <Icons.X size={14} />
                    </button>
                 </div>
             ) : (
                 <>
                    <input type="file" ref={heroImageInputRef} onChange={handleHeroImageSelect} accept="image/*" className="hidden" />
                     <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => heroImageInputRef.current?.click()} className={`border-2 border-dashed transition-colors p-6 text-center cursor-pointer ${isDragging ? 'border-black bg-gray-100' : 'border-gray-200 bg-gray-50'}`}>
                         <Icons.Image className="mx-auto text-gray-400 mb-2" />
                         <p className="text-xs text-gray-400 font-medium">{t('editor.dragDrop')}</p>
                     </div>
                 </>
             )}
        </div>

        <div className="bg-gray-50 p-4 border border-gray-200 space-y-3">
            <div className="flex items-center gap-2 text-black font-bold text-xs uppercase tracking-widest">
                <Icons.Image size={14} /> <span>{t('editor.aiGen')}</span>
            </div>
            <textarea placeholder={t('editor.aiPrompt')} className="w-full text-xs p-2 border border-gray-300 bg-white rounded-none resize-none focus:border-black focus:ring-0" rows={3} value={geminiPrompt} onChange={e => setGeminiPrompt(e.target.value)} />
            <button onClick={handleGenerateImage} disabled={isGenerating || !geminiPrompt} className={`w-full py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors ${isGenerating ? 'bg-gray-400' : 'bg-gray-800 hover:bg-black'}`}>
                {isGenerating ? '...' : t('editor.generate')}
            </button>
            {generatedImage && (
                <div className="mt-2 animate-in fade-in zoom-in">
                    <img src={generatedImage} alt="Generated" className="mb-2 w-full border border-gray-200 grayscale" />
                    <button onClick={applyImageToHero} className="w-full py-2 border border-black text-black text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white">{t('editor.use')}</button>
                </div>
            )}
        </div>
      </div>

      {editingImage && (
          <ImageEditModal 
            src={editingImage.src} 
            onSave={handleImageEditSave} 
            onClose={() => setEditingImage(null)} 
          />
      )}
    </div>
  );
};
