import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as mammoth from 'mammoth';
import { Article, ArticleStatus, UserRole, Section, Block } from '../../types';
import { Icons } from '../../components/Icon';
import { useLanguage } from '../../contexts/LanguageContext';
import { SUBSECTIONS } from '../../constants';

interface DashboardProps {
  articles: Article[];
  currentUser: any;
  onSave: (article: Article) => void;
  onDelete: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ articles, currentUser, onSave, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  
  // Modal & Notification State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<string>('ALL');
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('ALL');
  
  // Import State
  const [isImporting, setIsImporting] = useState(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Effect for Welcome Message Pop-up
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 4000); 
    return () => clearTimeout(timer);
  }, []);

  // PERMISSION LOGIC
  const visibleArticles = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === UserRole.ADMIN) {
        return articles;
    }
    
    if (currentUser.role === UserRole.EDITOR) {
        if (!currentUser.assignedSection) return [];
        return articles.filter(a => a.section?.toLowerCase() === currentUser.assignedSection.toLowerCase());
    }
    
    if (currentUser.role === UserRole.AUTHOR) {
        return articles.filter(a => a.authorId === currentUser.id);
    }

    return [];
  }, [articles, currentUser]);

  // STATISTICS CALCULATION
  const sectionCounts = useMemo(() => {
      const counts: Record<string, number> = { ALL: visibleArticles.length };
      Object.values(Section).forEach(sec => counts[sec] = 0);

      visibleArticles.forEach(a => {
          if (counts[a.section] !== undefined) {
              counts[a.section]++;
          }
      });
      return counts;
  }, [visibleArticles]);

  const subCategoryCounts = useMemo(() => {
      if (activeTab === 'ALL') return {};
      const counts: Record<string, number> = {};
      const knownSubs = SUBSECTIONS[activeTab as Section] || [];
      knownSubs.forEach(sub => counts[sub] = 0);
      visibleArticles.filter(a => a.section === activeTab).forEach(a => {
          if (a.subcategory) counts[a.subcategory] = (counts[a.subcategory] || 0) + 1;
      });
      return counts;
  }, [visibleArticles, activeTab]);

  const uniqueAuthors = useMemo(() => {
      const authorMap = new Map<string, string>();
      visibleArticles.forEach(a => {
          if (a.authorId && a.authorName) authorMap.set(a.authorId, a.authorName);
      });
      return Array.from(authorMap.entries()).map(([id, name]) => ({ id, name }));
  }, [visibleArticles]);

  // COMBINED FILTERING
  const filteredDashboardArticles = useMemo(() => {
    let data = visibleArticles;
    if (activeTab !== 'ALL') {
        data = data.filter(a => a.section === activeTab);
        if (activeSubTab !== 'ALL') data = data.filter(a => a.subcategory === activeSubTab);
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        data = data.filter(a => 
            a.title.toLowerCase().includes(query) || 
            (a.authorName && a.authorName.toLowerCase().includes(query))
        );
    }
    if (selectedAuthorId !== 'ALL') data = data.filter(a => a.authorId === selectedAuthorId);
    return data;
  }, [visibleArticles, activeTab, activeSubTab, searchQuery, selectedAuthorId]);

  const getStatusColor = (status: ArticleStatus) => {
    switch(status) {
        case ArticleStatus.PUBLISHED: return 'bg-black text-white';
        case ArticleStatus.DRAFT: return 'bg-gray-200 text-gray-600';
        case ArticleStatus.REVIEW: return 'bg-gray-800 text-white';
        case ArticleStatus.SCHEDULED: return 'bg-blue-600 text-white';
        default: return 'bg-gray-100 text-gray-500';
    }
  };

  const togglePublishStatus = (article: Article) => {
      if (currentUser.role !== UserRole.ADMIN) {
          alert("Vetëm Administratori mund të publikojë artikuj.");
          return;
      }
      const isPublished = article.status === ArticleStatus.PUBLISHED;
      const updatedArticle = {
          ...article,
          status: isPublished ? ArticleStatus.DRAFT : ArticleStatus.PUBLISHED,
          publishDate: (!isPublished && !article.publishDate) ? new Date().toISOString() : article.publishDate
      };
      onSave(updatedArticle);
  };

  const confirmDelete = () => {
      if (articleToDelete) onDelete(articleToDelete);
      else if (selectedIds.size > 0) {
          selectedIds.forEach(id => onDelete(id));
          setSelectedIds(new Set());
      }
      setShowDeleteModal(false);
      setArticleToDelete(null);
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const handleDocImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsImporting(true);
      // @ts-ignore
      const mammothLib = mammoth.default || mammoth;
      const filePromises = Array.from(files).map(async (file: File, fileIndex) => {
          return new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = async (event) => {
                  try {
                      const arrayBuffer = event.target?.result as ArrayBuffer;
                      const result = await mammothLib.extractRawText({ arrayBuffer });
                      const text = result.value;
                      const lines = text.split(/\r?\n/).filter((line: string) => line.trim() !== '');
                      let extractedTitle = lines.find((l: string) => l.startsWith('t:'))?.substring(2).trim() || file.name.replace(/\.[^/.]+$/, "");
                      const newBlocks: Block[] = lines.map((line: string, idx: number) => {
                        const content = line.trim();
                        const ts = Date.now() + idx + (fileIndex * 1000);
                        if (content.startsWith('t:')) return { id: `${ts}-t`, type: 'heading', content: content.substring(2).trim() };
                        if (content.startsWith('mt:')) return { id: `${ts}-mt`, type: 'paragraph', content: content.substring(3).trim() };
                        if (content.startsWith('i:')) return { id: `${ts}-i`, type: 'image', content: content.substring(2).trim() };
                        if (content.startsWith('q:')) return { id: `${ts}-q`, type: 'quote', content: content.substring(2).trim() };
                        return { id: `${ts}`, type: 'paragraph', content };
                      });
                      onSave({
                          id: (Date.now() + fileIndex + Math.floor(Math.random() * 10000)).toString(),
                          title: extractedTitle,
                          subtitle: '',
                          authorId: currentUser.id,
                          authorName: currentUser.name, 
                          section: currentUser.role === UserRole.EDITOR ? currentUser.assignedSection : Section.LAJME,
                          status: ArticleStatus.DRAFT,
                          content: newBlocks,
                          tags: [],
                          views: 0
                      });
                      resolve();
                  } catch (err) { reject(err); }
              };
              reader.readAsArrayBuffer(file);
          });
      });
      try { await Promise.allSettled(filePromises); } catch (e) { console.error(e); } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const localeMap: Record<string, string> = { sq: 'sq-AL', en: 'en-US', it: 'it-IT', de: 'de-DE', fr: 'fr-FR' };

  return (
    <div className="container mx-auto px-6 bg-alb-light min-h-screen relative">
      
      {/* --- WELCOME POPUP --- */}
      {showWelcome && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-right fade-in duration-500">
           <div className="bg-black text-white px-6 py-4 shadow-2xl border-l-4 border-red-700 flex items-center gap-4">
               <div className="bg-white/10 p-2 rounded-full">
                  <Icons.User size={20} className="text-white" />
               </div>
               <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Përshëndetje</p>
                  <h4 className="font-serif font-bold text-lg">{currentUser.name}</h4>
               </div>
               <button onClick={() => setShowWelcome(false)} className="ml-4 text-gray-400 hover:text-white transition-colors">
                  <Icons.X size={16} />
               </button>
           </div>
        </div>
      )}

      {/* --- STICKY HEADER & TABS WRAPPER: top-0 because main Navbar is hidden --- */}
      <div className="sticky top-0 z-40 bg-alb-light pt-8 pb-4 -mx-6 px-6 border-b border-gray-100 shadow-sm">
        
        {/* --- COMPACT ONE-LINE HEADER --- */}
        <div className="flex items-center gap-6">
            {/* PANELI Title */}
            <h1 className="text-3xl font-serif font-black text-alb-dark leading-none tracking-tight uppercase">
                {t('admin.dashboard')}
            </h1>

            {/* Actions & Search */}
            <div className="flex items-center gap-3 flex-1 justify-end">
                {/* 1. Artikulli i Ri */}
                <Link 
                    to="/admin/edit/new" 
                    className="bg-black text-white px-5 py-3 rounded-none font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-gray-800 transition-all shadow-sm active:scale-95"
                >
                    <Icons.Plus size={14} /> {t('admin.newArticle')}
                </Link>

                {/* 2. Importo Grupe */}
                <input type="file" accept=".docx" multiple ref={fileInputRef} onChange={handleDocImport} className="hidden" />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="bg-white text-black border border-gray-300 px-5 py-3 rounded-none font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm active:scale-95"
                >
                    {isImporting ? <Icons.Clock size={14} className="animate-spin" /> : <Icons.FileText size={14} />}
                    {isImporting ? "Duke importuar..." : "Importo Grupe"}
                </button>

                {/* Bulk Delete */}
                {selectedIds.size > 0 && isAdmin && (
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="bg-red-600 text-white px-5 py-3 rounded-none font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-red-700 transition-all shadow-sm animate-in zoom-in-95"
                    >
                        <Icons.Trash2 size={14} /> Fshij ({selectedIds.size})
                    </button>
                )}

                {/* 3. Search Bar */}
                <div className="relative w-72">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Kërko artikuj..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 text-xs font-medium focus:border-black focus:ring-0 outline-none rounded-none bg-white shadow-inner placeholder-gray-400"
                    />
                    <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                </div>
            </div>
        </div>

        {/* --- STICKY TABS (Të Gjitha line) --- */}
        <div className="mt-8">
            <div className="flex overflow-x-auto gap-8 no-scrollbar">
                    <button
                        onClick={() => { setActiveTab('ALL'); setActiveSubTab('ALL'); }}
                        className={`pb-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-[2px] ${activeTab === 'ALL' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'}`}
                    >
                        Të Gjitha <span className="ml-1 opacity-40 font-normal">({sectionCounts['ALL']})</span>
                    </button>
                    {Object.values(Section).map(section => (
                        <button
                            key={section}
                            onClick={() => { setActiveTab(section); setActiveSubTab('ALL'); }}
                            className={`pb-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-[2px] ${activeTab === section ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'}`}
                        >
                            {t(`section.${section}`)} <span className="ml-1 opacity-40 font-normal">({sectionCounts[section]})</span>
                        </button>
                    ))}
            </div>
            
            {/* Subcategory Pills */}
            {activeTab !== 'ALL' && (
                <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in duration-300">
                    <button
                        onClick={() => setActiveSubTab('ALL')}
                        className={`px-4 py-1.5 rounded-none text-[9px] font-bold uppercase tracking-widest transition-colors ${activeSubTab === 'ALL' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-black hover:border-black'}`}
                    >
                        Të Gjitha
                    </button>
                    {Object.entries(subCategoryCounts).map(([sub, count]) => (
                        <button
                            key={sub}
                            onClick={() => setActiveSubTab(sub)}
                            className={`px-4 py-1.5 rounded-none text-[9px] font-bold uppercase tracking-widest transition-colors ${activeSubTab === sub ? 'bg-black text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-400 hover:border-black hover:text-black'}`}
                        >
                            {sub} <span className="ml-1 opacity-50 font-normal">({count})</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* --- SCROLLABLE ARTICLE LIST --- */}
      <div className="py-8">
          <div className="bg-white shadow-sm border border-gray-200 overflow-x-auto min-h-[500px]">
            <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200">
                    <tr>
                        {isAdmin && (
                            <th className="px-6 py-6 w-10">
                                <input type="checkbox" onChange={(e) => {
                                    if (e.target.checked) setSelectedIds(new Set(filteredDashboardArticles.map(a => a.id)));
                                    else setSelectedIds(new Set());
                                }} checked={filteredDashboardArticles.length > 0 && selectedIds.size === filteredDashboardArticles.length} className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black cursor-pointer" />
                            </th>
                        )}
                        <th className="px-6 py-6">{t('admin.table.title')}</th>
                        <th className="px-6 py-6 hidden md:table-cell">{t('admin.table.section')}</th>
                        <th className="px-6 py-6 hidden lg:table-cell">{t('admin.table.author')}</th>
                        <th className="px-6 py-6">{t('admin.table.status')}</th>
                        <th className="px-6 py-6 text-right pr-10">{t('admin.table.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredDashboardArticles.length > 0 ? (
                        filteredDashboardArticles.map(article => (
                            <tr key={article.id} className={`hover:bg-gray-50/80 transition-colors ${selectedIds.has(article.id) ? 'bg-gray-50' : ''}`}>
                                {isAdmin && (
                                    <td className="px-6 py-5">
                                        <input type="checkbox" checked={selectedIds.has(article.id)} onChange={() => {
                                            const newS = new Set(selectedIds);
                                            if (newS.has(article.id)) newS.delete(article.id); else newS.add(article.id);
                                            setSelectedIds(newS);
                                        }} className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black cursor-pointer" />
                                    </td>
                                )}
                                <td className="px-6 py-5">
                                    <div className="font-bold text-gray-900 line-clamp-1 text-lg font-serif">
                                        <Link to={`/admin/edit/${article.id}`} className="hover:underline decoration-1 underline-offset-4">{article.title || t('admin.untitled')}</Link>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-medium">
                                        {article.publishDate ? new Date(article.publishDate).toLocaleDateString(localeMap[language], {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : t('admin.noDate')}
                                    </div>
                                </td>
                                <td className="px-6 py-5 hidden md:table-cell">
                                    <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-gray-600 border border-gray-200 px-2 py-1 bg-gray-50">{article.section}</span>
                                    {article.subcategory && <span className="block text-[10px] text-gray-400 mt-1.5 font-medium tracking-wide italic">{article.subcategory}</span>}
                                </td>
                                <td className="px-6 py-5 text-sm text-gray-600 font-medium hidden lg:table-cell">
                                    <span className="text-xs">{article.authorName || article.authorId}</span>
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${getStatusColor(article.status)}`}>{article.status}</span>
                                </td>
                                <td className="px-6 py-5 text-right pr-6">
                                    <div className="flex items-center justify-end gap-3">
                                        {isAdmin && (
                                            <button onClick={() => togglePublishStatus(article)} className={`p-2 rounded-full transition-colors ${article.status === ArticleStatus.PUBLISHED ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-300 hover:text-green-600 hover:bg-green-50'}`} title={article.status === ArticleStatus.PUBLISHED ? "Hiq nga publikimi" : "Publiko"}>
                                                {article.status === ArticleStatus.PUBLISHED ? <Icons.EyeOff size={18} /> : <Icons.Globe size={18} />}
                                            </button>
                                        )}
                                        <Link to={`/admin/edit/${article.id}`} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors" title="Edito"><Icons.Settings size={18} /></Link>
                                        <Link to={`/article/${article.id}`} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors" title="Shiko"><Icons.Eye size={18} /></Link>
                                        {isAdmin && (
                                            <button onClick={() => {setArticleToDelete(article.id); setShowDeleteModal(true);}} className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors" title="Fshij"><Icons.Trash2 size={18} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="p-24 text-center text-gray-400 font-light italic">
                                <div className="flex flex-col items-center gap-4">
                                    <Icons.Database size={48} className="opacity-10" />
                                    <p className="text-lg">Nuk u gjet asnjë artikull për këtë kriter.</p>
                                    <button onClick={() => {setSearchQuery(''); setActiveTab('ALL');}} className="text-xs font-bold uppercase tracking-widest text-black underline underline-offset-4">Pastro filtrat</button>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </div>

      {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
              <div className="relative bg-white w-full max-w-sm shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
                   <div className="bg-red-600 h-1 w-full"></div>
                   <div className="p-8 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full text-red-600"><Icons.Trash2 size={32} /></div>
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-black mb-3">{articleToDelete ? "Fshij Artikullin?" : `Fshij ${selectedIds.size} Artikuj?`}</h3>
                        <p className="text-gray-500 mb-8 text-sm leading-relaxed">Ky veprim është <span className="font-bold text-red-600 uppercase">përfundimtar</span> dhe do të fshijë përmbajtjen përgjithmonë nga databaza.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-colors">Anulo</button>
                            <button onClick={confirmDelete} className="flex-1 py-4 bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors shadow-lg shadow-red-200 active:scale-95">Po, Fshije</button>
                        </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};