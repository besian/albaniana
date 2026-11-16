import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Article, Block } from '../types';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { translateArticleStream, generateSpeech } from '../services/geminiService';
import { useTheme } from '../contexts/ThemeContext';

interface ArticleViewProps {
  articles: Article[];
}

// Old Paper Noise Texture (SVG Data URI)
const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`;

// ArticleBody is now a regular functional component to accept dynamic fontScale cleanly
const ArticleBody = ({ content, isColumnView, isPaperMode, fontScale }: { content: Block[], isColumnView: boolean, isPaperMode: boolean, fontScale: number }) => {
    // Ink color for paper mode vs standard text color
    const textColorClass = isPaperMode 
        ? 'text-[#3e3830] dark:text-[#dcd6c8]' // Dark Brown Ink (Light) / Off-white (Dark)
        : 'text-gray-800 dark:text-gray-300'; // Standard

    const headingColorClass = isPaperMode
        ? 'text-[#2b261b] dark:text-[#edeadd]' 
        : 'text-black dark:text-white';

    const quoteBorderClass = isPaperMode
        ? 'border-[#3e3830] dark:border-[#dcd6c8] bg-black/5 dark:bg-white/5'
        : 'border-black dark:border-white bg-gray-50/50 dark:bg-white/5';

    return (
        <div className={`
            w-full transition-all duration-700
            ${isColumnView 
                ? 'columns-1 md:columns-2 lg:columns-3 gap-10 space-y-0 text-justify' 
                : 'max-w-3xl mx-auto space-y-8'}
        `}>
            {content.map((block) => {
                const shouldAvoidBreak = isColumnView && block.type !== 'paragraph';
                const breakStyle = shouldAvoidBreak ? { breakInside: 'avoid' as const, webkitColumnBreakInside: 'avoid' } : {};
                
                switch(block.type) {
                    case 'paragraph':
                        // Base size scaling
                        const pSize = 1.125 * fontScale; // 1.125rem base
                        return (
                            <div 
                                key={block.id} 
                                // !font-merriweather ensures it overrides any inherited or inline font families from pasted content
                                className={`!font-merriweather mb-6 ${textColorClass} ${shouldAvoidBreak ? 'break-inside-avoid' : ''}`}
                                style={{ 
                                    fontSize: `${pSize}rem`, 
                                    lineHeight: 1.8 
                                }}
                                dangerouslySetInnerHTML={{ __html: block.content }}
                            />
                        );
                    case 'heading':
                        const hSize = 1.875 * fontScale; // 1.875rem base
                        return (
                            <h2 
                                key={block.id} 
                                style={{ 
                                    ...breakStyle, 
                                    fontSize: `${hSize}rem`, 
                                    lineHeight: 1.3 
                                }}
                                className={`font-serif font-bold mt-12 mb-6 tracking-tight ${headingColorClass} ${isColumnView ? 'break-after-avoid' : ''}`}
                                dangerouslySetInnerHTML={{ __html: block.content }}
                            />
                        );
                    case 'quote':
                        const qSize = 1.5 * fontScale; // 1.5rem base
                        return (
                            <blockquote 
                                key={block.id} 
                                style={{ 
                                    ...breakStyle, 
                                    fontSize: `${qSize}rem`, 
                                    lineHeight: 1.4 
                                }}
                                className={`border-l-4 pl-6 my-10 italic font-serif py-4 pr-4 ${headingColorClass} ${quoteBorderClass}`}
                            >
                                <div dangerouslySetInnerHTML={{ __html: block.content }} />
                            </blockquote>
                        );
                    case 'image':
                        return (
                            <figure 
                                key={block.id} 
                                style={breakStyle}
                                className={`my-8 ${isColumnView ? 'w-full inline-block' : 'w-full md:w-3/4 mx-auto block'}`}
                            >
                                <img 
                                    src={block.content} 
                                    className={`w-full h-auto object-cover transition-all rounded-sm shadow-sm ${isPaperMode ? 'grayscale sepia-[.3] opacity-90 mix-blend-multiply dark:mix-blend-normal' : 'bg-gray-100 dark:bg-dark-elevated grayscale hover:grayscale-0'}`} 
                                    alt="Content" 
                                />
                                {block.metadata?.caption && (
                                    <figcaption className="text-xs text-gray-500 mt-2 text-center font-sans">
                                        {block.metadata.caption}
                                    </figcaption>
                                )}
                            </figure>
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
};

export const ArticleView: React.FC<ArticleViewProps> = ({ articles }) => {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const { theme } = useTheme(); 
  
  // View Modes
  const [isColumnView, setIsColumnView] = useState(false);
  const [isPaperMode, setIsPaperMode] = useState(false);
  const [fontScale, setFontScale] = useState(1.0);
  
  // Live Zoom Lens State
  const [isLensActive, setIsLensActive] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const articleContentRef = useRef<HTMLDivElement>(null);
  const [lensOffset, setLensOffset] = useState({ x: 0, y: 0 });

  // Tools State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Translation State
  const [displayArticle, setDisplayArticle] = useState<Article | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const originalArticle = articles.find(a => a.id === id);

  // --- Translation Effect ---
  useEffect(() => {
    const handleTranslation = async () => {
        if (!originalArticle) return;

        // If native language, display original immediately
        if (language === 'sq') {
            setDisplayArticle(originalArticle);
            return;
        }

        // Initialize display with original content and show translating status
        setIsTranslating(true);
        setDisplayArticle(originalArticle);

        try {
            // Use streaming translation to update the article block by block
            await translateArticleStream(originalArticle, language, (updatedArticle) => {
                setDisplayArticle(prev => ({...prev, ...updatedArticle}));
            });
        } catch (e) {
            console.error("Translation failed", e);
            setDisplayArticle(originalArticle);
        } finally {
            setIsTranslating(false);
        }
    };

    handleTranslation();
  }, [originalArticle, language]);

  // --- Live Zoom Lens Logic ---
  useEffect(() => {
      if (!isLensActive) return;

      const handleMouseMove = (e: MouseEvent) => {
          setMousePos({ x: e.clientX, y: e.clientY });
          if (articleContentRef.current) {
              const ZOOM_LEVEL = 1.5;
              const LENS_SIZE = 256; 
              
              const screenOffsetX = -(e.clientX * ZOOM_LEVEL) + (LENS_SIZE / 2);
              const screenOffsetY = -(e.clientY * ZOOM_LEVEL) + (LENS_SIZE / 2);

              setLensOffset({ x: screenOffsetX, y: screenOffsetY });
          }
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isLensActive]);


  // --- Audio Cleanup ---
  useEffect(() => {
    return () => {
        stopAudio();
    };
  }, [id]);

  const stopAudio = () => {
      if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch(e) {}
          audioSourceRef.current = null;
      }
      if (audioContextRef.current) {
          if (audioContextRef.current.state !== 'closed') {
              audioContextRef.current.close();
          }
          audioContextRef.current = null;
      }
      setIsSpeaking(false);
      setIsLoadingSpeech(false);
  };

  const handleSpeak = async () => {
    if (isSpeaking || isLoadingSpeech) {
        stopAudio();
        return;
    }

    if (!displayArticle) return;

    setIsLoadingSpeech(true);

    try {
        const stripHtml = (html: string) => {
            const tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || "";
        };

        let textToRead = `${displayArticle.title}. ${displayArticle.subtitle}. `;
        
        let wordCount = 0;
        for (const block of displayArticle.content) {
            if (block.type === 'paragraph' && wordCount < 300) {
                const cleanText = stripHtml(block.content);
                textToRead += cleanText + " ";
                wordCount += cleanText.split(/\s+/).length;
            }
        }

        const audioBuffer = await generateSpeech(textToRead);
        
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        audioContextRef.current = ctx;
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
            setIsSpeaking(false);
            setIsLoadingSpeech(false);
        };
        source.start(0);
        
        audioSourceRef.current = source;
        setIsSpeaking(true);

    } catch (e) {
        console.error("TTS Error:", e);
        alert("Audio generation failed. Please check API Key configuration.");
        setIsSpeaking(false);
    } finally {
        setIsLoadingSpeech(false);
    }
  };

  const handleShare = async () => {
      const url = window.location.href;
      if (navigator.share) {
          try {
              await navigator.share({
                  title: displayArticle?.title,
                  text: displayArticle?.subtitle,
                  url: url
              });
              return;
          } catch (e) {}
      }
      try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      } catch (err) {}
  };

  const changeFontSize = (delta: number) => {
      setFontScale(prev => {
          // Clamp between 0.7x and 2.5x
          const newScale = Math.min(Math.max(prev + delta, 0.7), 2.5);
          return parseFloat(newScale.toFixed(2));
      });
  };

  const localeMap: Record<string, string> = {
      sq: 'sq-AL',
      en: 'en-US',
      it: 'it-IT',
      de: 'de-DE',
      fr: 'fr-FR',
      el: 'el-GR',
      ru: 'ru-RU',
      es: 'es-ES',
      zh: 'zh-CN',
      sv: 'sv-SE',
      tr: 'tr-TR',
      no: 'no-NO',
      sr: 'sr-RS',
      hr: 'hr-HR'
  };

  if (!displayArticle) {
      if (!originalArticle) return <div className="p-12 text-center text-gray-500 dark:text-gray-400">{t('article.notFound')}</div>;
      return <div className="p-12 text-center text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  const authorDisplay = displayArticle.authorName || displayArticle.authorId || 'Redaksia';

  const pageClassName = isPaperMode 
     ? 'bg-[#f4ecd8] dark:bg-[#23201a]' 
     : 'bg-white dark:bg-dark-base';

  return (
    <div 
        className={`min-h-screen pb-24 transition-colors duration-500 ${pageClassName} ${isLensActive ? 'cursor-none' : ''}`}
        style={isPaperMode ? { backgroundImage: PAPER_TEXTURE } : {}}
    >
        
        {/* --- LIVE ZOOM LENS PORTAL --- */}
        {isLensActive && (
            <div 
                className="fixed pointer-events-none z-[100] w-64 h-64 rounded-full bg-white dark:bg-dark-surface shadow-[0_10px_50px_rgba(0,0,0,0.5)] border-4 border-gray-300 dark:border-gray-600 overflow-hidden flex items-center justify-center"
                style={{ 
                    left: mousePos.x, 
                    top: mousePos.y,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <div 
                    className={`absolute w-screen origin-top-left pointer-events-none select-none transition-none ${pageClassName}`}
                    style={{
                        transform: `translate(${lensOffset.x}px, ${lensOffset.y}px) scale(1.5)`,
                        width: '100vw', 
                        height: '100vh',
                        backgroundImage: isPaperMode ? PAPER_TEXTURE : 'none'
                    }}
                >
                     <div className={`transition-all duration-500 ${isColumnView ? 'py-16' : 'py-20 md:py-24'}`}>
                        <div className="container mx-auto px-4 max-w-4xl text-center">
                            {displayArticle.kicker && <div className="text-lg md:text-xl font-bold text-red-700 uppercase tracking-widest mb-4 font-sans">{displayArticle.kicker}</div>}
                            <h1 className={`text-4xl md:text-6xl font-[Arial] font-bold leading-tight mb-8 ${isPaperMode ? 'text-[#2b261b] dark:text-[#edeadd]' : 'text-alb-dark dark:text-white'}`}>{displayArticle.title}</h1>
                            {displayArticle.subtitle && <p className={`text-xl md:text-2xl font-bold font-[Arial] leading-relaxed mb-8 max-w-2xl mx-auto ${isPaperMode ? 'text-[#3e3830] dark:text-[#dcd6c8]' : 'text-alb-gray dark:text-gray-300'}`}>{displayArticle.subtitle}</p>}
                        </div>
                     </div>

                     <div className={`container mx-auto px-6 md:px-12 mt-12 mb-24 transition-all duration-700 ease-in-out ${isColumnView ? 'max-w-[100rem]' : 'max-w-4xl'}`}>
                        {displayArticle.heroImage && (
                            <div className={`mb-16 transition-all duration-700 ${isColumnView ? 'max-w-4xl mx-auto' : 'w-full'}`}>
                                <figure>
                                    <img src={displayArticle.heroImage} alt={displayArticle.title} className={`w-full h-auto max-h-[500px] object-cover transition-all duration-1000 shadow-sm ${isPaperMode ? 'grayscale sepia-[.3] opacity-90 mix-blend-multiply dark:mix-blend-normal rounded-sm' : 'grayscale hover:grayscale-0'}`} />
                                </figure>
                            </div>
                        )}
                        <ArticleBody content={displayArticle.content} isColumnView={isColumnView} isPaperMode={isPaperMode} fontScale={fontScale} />
                     </div>
                </div>

                {/* Glass Reflection Overlay */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent z-20 pointer-events-none mix-blend-overlay"></div>
                <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] z-30 pointer-events-none"></div>
            </div>
        )}

        {/* Floating Tools Sidebar */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:top-32 lg:bottom-auto lg:translate-x-0 z-50 print:hidden">
            <div className="flex lg:flex-col items-center gap-3 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 dark:border-dark-border p-2 rounded-full lg:rounded-2xl transition-all">
                
                {/* Lens Toggle */}
                <button
                    onClick={() => setIsLensActive(!isLensActive)}
                    className={`p-3 rounded-full transition-all ${isLensActive ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg ring-2 ring-offset-2 ring-black dark:ring-white' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                    title="Live Zoom Lens"
                >
                    <Icons.ZoomIn size={20} />
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-dark-border lg:w-6 lg:h-px"></div>

                {/* Font Size Controls */}
                <div className="flex lg:flex-col gap-1">
                    <button
                        onClick={() => changeFontSize(0.2)}
                        className="p-3 rounded-full text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors"
                        title="Increase Font Size"
                    >
                        <span className="font-serif font-black text-lg leading-none">A+</span>
                    </button>
                    <button
                        onClick={() => changeFontSize(-0.2)}
                        className="p-3 rounded-full text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors"
                        title="Decrease Font Size"
                    >
                        <span className="font-serif font-black text-xs leading-none">A-</span>
                    </button>
                </div>

                <div className="w-px h-6 bg-gray-200 dark:bg-dark-border lg:w-6 lg:h-px"></div>

                {/* Audio Toggle */}
                <button
                    onClick={handleSpeak}
                    className={`p-3 rounded-full transition-all ${isSpeaking ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                    title="Read Out Loud (Gemini AI)"
                >
                    {isLoadingSpeech ? <Icons.Clock size={20} className="animate-spin" /> : (isSpeaking ? <Icons.StopCircle size={20} /> : <Icons.Volume2 size={20} />)}
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-dark-border lg:w-6 lg:h-px"></div>
                
                {/* Share Button */}
                <button
                    onClick={handleShare}
                    className={`p-3 rounded-full transition-all relative ${isCopied ? 'bg-green-100 text-green-700' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                    title={t('article.share')}
                >
                    {isCopied ? <Icons.Check size={20} /> : <Icons.Share2 size={20} />}
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-dark-border lg:w-6 lg:h-px"></div>

                {/* Paper Mode Toggle */}
                <button
                    onClick={() => setIsPaperMode(!isPaperMode)}
                    className={`p-3 rounded-full transition-all ${isPaperMode ? 'bg-[#f4ecd8] text-amber-900 border border-amber-300/50 shadow-inner' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                    title={isPaperMode ? "Switch to Modern View" : "Switch to Paper View"}
                >
                    {isPaperMode ? <Icons.BookOpen size={20} /> : <Icons.Sun size={20} />}
                </button>

                {/* Column Toggle */}
                <button 
                    onClick={() => setIsColumnView(!isColumnView)}
                    className={`hidden md:block p-3 rounded-full transition-all ${isColumnView ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                    title={isColumnView ? "Normal View" : "Newspaper View"}
                >
                    {isColumnView ? <Icons.AlignLeft size={20} /> : <Icons.Columns size={20} />}
                </button>
            </div>
        </div>

        <article 
            ref={articleContentRef} 
            className={`relative transition-opacity duration-300 opacity-100`}
        >
            {/* Header / Meta */}
            <div className={`transition-all duration-500 border-b ${isPaperMode ? 'bg-transparent border-black/10 dark:border-white/10' : 'bg-gray-100 dark:bg-dark-surface border-gray-200 dark:border-dark-border'} ${isColumnView ? 'py-16' : 'py-20 md:py-24'}`}>
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <div className="flex justify-center mb-6 gap-2">
                        <Link 
                            to={`/?section=${displayArticle.section}`} 
                            className={`px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${isPaperMode ? 'bg-[#3e3830] text-[#f4ecd8] hover:bg-[#2b261b] dark:bg-[#dcd6c8] dark:text-[#23201a]' : 'text-white bg-black dark:bg-white dark:text-black hover:bg-gray-700'}`}
                        >
                            {t(`section.${displayArticle.section}`)}
                        </Link>
                        {displayArticle.subcategory && (
                            <span className={`border px-3 py-1 text-xs font-bold uppercase tracking-widest ${isPaperMode ? 'border-[#3e3830] text-[#3e3830] dark:border-[#dcd6c8] dark:text-[#dcd6c8]' : 'text-black dark:text-white border-black dark:border-white'}`}>
                                {displayArticle.subcategory}
                            </span>
                        )}
                    </div>
                    
                    {displayArticle.kicker && (
                        <div className="text-lg md:text-xl font-bold text-red-700 dark:text-red-500 uppercase tracking-widest mb-4 font-sans">
                            {displayArticle.kicker}
                        </div>
                    )}
                    
                    <h1 className={`text-4xl md:text-6xl font-[Arial] font-bold leading-tight mb-8 ${isPaperMode ? 'text-[#2b261b] dark:text-[#edeadd]' : 'text-alb-dark dark:text-white'}`}>
                        {displayArticle.title}
                    </h1>

                    {displayArticle.subtitle && (
                        <p className={`text-xl md:text-2xl font-bold font-[Arial] leading-relaxed mb-8 max-w-2xl mx-auto ${isPaperMode ? 'text-[#3e3830] dark:text-[#dcd6c8]' : 'text-alb-gray dark:text-gray-300'}`}>
                            {displayArticle.subtitle}
                        </p>
                    )}

                    <div className={`flex items-center justify-center gap-6 text-sm border-t border-b py-4 max-w-xl mx-auto ${isPaperMode ? 'text-[#3e3830] dark:text-[#dcd6c8] border-[#3e3830]/20 dark:border-[#dcd6c8]/20' : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
                        <div className={`font-bold uppercase tracking-wider ${isPaperMode ? 'text-[#2b261b] dark:text-white' : 'text-black dark:text-white'}`}>{authorDisplay}</div>
                        <div className={`w-1 h-1 rounded-full ${isPaperMode ? 'bg-[#3e3830] dark:bg-[#dcd6c8]' : 'bg-gray-500'}`}></div>
                        <div className="flex items-center gap-1 font-light">
                            <Icons.Clock size={14} /> 
                            {new Date(displayArticle.publishDate || Date.now()).toLocaleDateString(localeMap[language] || 'sq-AL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className={`container mx-auto mt-12 mb-24 transition-all duration-700 ease-in-out ${isColumnView ? 'max-w-[100rem] px-8 md:px-24 lg:px-48' : 'max-w-4xl px-6 md:px-12'}`}>
                
                {/* Hero Image */}
                {displayArticle.heroImage && (
                    <div className={`mb-16 transition-all duration-700 ${isColumnView ? 'max-w-4xl mx-auto' : 'w-full'}`}>
                        <figure>
                            <img 
                                src={displayArticle.heroImage} 
                                alt={displayArticle.title} 
                                className={`w-full h-auto max-h-[500px] object-cover transition-all duration-1000 shadow-sm ${isPaperMode ? 'grayscale sepia-[.3] opacity-90 mix-blend-multiply dark:mix-blend-normal rounded-sm' : 'grayscale hover:grayscale-0'}`} 
                            />
                            <figcaption className="text-xs text-gray-400 mt-3 text-right font-mono uppercase tracking-widest">
                                {t('article.illustration')}
                            </figcaption>
                        </figure>
                    </div>
                )}

                {/* Render Article Body (Reused for Lens) */}
                <ArticleBody content={displayArticle.content} isColumnView={isColumnView} isPaperMode={isPaperMode} fontScale={fontScale} />
                
                {/* Tags */}
                {displayArticle.tags && displayArticle.tags.length > 0 && (
                    <div className={`mt-24 pt-8 border-t ${isColumnView ? 'max-w-4xl mx-auto' : 'max-w-3xl mx-auto'} ${isPaperMode ? 'border-[#3e3830]/20 dark:border-[#dcd6c8]/20' : 'border-gray-200 dark:border-dark-border'}`}>
                        <div className="flex flex-wrap gap-2">
                            {displayArticle.tags.map(tag => (
                                <Link 
                                    to={`/?tag=${tag}`} 
                                    key={tag} 
                                    className={`px-4 py-2 border text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${isPaperMode ? 'border-[#3e3830]/30 text-[#3e3830] hover:bg-[#3e3830] hover:text-[#f4ecd8] dark:border-[#dcd6c8]/30 dark:text-[#dcd6c8] dark:hover:bg-[#dcd6c8] dark:hover:text-[#23201a]' : 'border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'}`}
                                >
                                    #{tag}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </article>
        
        {isTranslating && (
             <div className="fixed bottom-4 right-4 z-40">
                 <div className="bg-black text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-3 animate-pulse">
                     <Icons.Globe className="animate-spin" size={16} />
                     <span className="font-bold uppercase tracking-widest text-[10px]">Translating...</span>
                 </div>
             </div>
        )}
    </div>
  );
};