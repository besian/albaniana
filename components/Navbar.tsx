import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icons } from './Icon';
import { Section, UserRole, Article, ArticleStatus, User } from '../types';
import { SUBSECTIONS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../translations';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface NavbarProps {
  currentUser: any;
  onLogout: () => void;
  articles: Article[];
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onLogout, articles }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlSection = searchParams.get('section') as Section | null;
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Determine if we are on the Dashboard page
  const isDashboard = location.pathname === '/admin';
  const isLoginPage = location.pathname === '/login';

  // If we are on the Dashboard, we hide the navbar as requested
  if (isDashboard) {
    return null;
  }

  // State
  const [hoveredSection, setHoveredSection] = useState<Section | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTab, setSearchTab] = useState<'articles' | 'users'>('articles');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // Determine which subsections to show: Hovered -> URL Selected -> Default (Lajme)
  const activeDisplaySection = hoveredSection || urlSection || Section.LAJME;

  // Live Search Filtering (Articles)
  const filteredArticles = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    
    // Filter published articles that match the query
    return articles.filter(a => {
        const isPublished = a.status === ArticleStatus.PUBLISHED;
        if (!isPublished) return false;

        return (
            a.title.toLowerCase().includes(query) ||
            a.subtitle.toLowerCase().includes(query) ||
            a.authorName?.toLowerCase().includes(query) ||
            a.tags?.some(tag => tag.toLowerCase().includes(query))
        );
    }).slice(0, 8); // Limit to 8 results for the view
  }, [searchQuery, articles]);

  // Live Search (Users)
  useEffect(() => {
      const fetchUsers = async () => {
          if (!searchQuery || searchTab !== 'users') {
              setUserSearchResults([]);
              return;
          }
          setIsSearchingUsers(true);
          try {
              const users = await api.users.search(searchQuery);
              setUserSearchResults(users);
          } catch (e) {
              console.error(e);
          } finally {
              setIsSearchingUsers(false);
          }
      };

      // Debounce slightly to avoid too many DB calls
      const timeoutId = setTimeout(fetchUsers, 300);
      return () => clearTimeout(timeoutId);
  }, [searchQuery, searchTab]);


  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autofocus search input when overlay opens
  useEffect(() => {
      if (isSearchOpen && searchInputRef.current) {
          searchInputRef.current.focus();
          document.body.style.overflow = 'hidden'; // Lock scroll
      } else {
          document.body.style.overflow = ''; // Unlock scroll
      }
      return () => { document.body.style.overflow = ''; };
  }, [isSearchOpen]);

  // Keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              closeSearch();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeSearch = () => {
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchTab('articles');
  };

  const handleLogout = () => {
      setIsUserDropdownOpen(false);
      onLogout();
  };
  
  const handleLanguageChange = (lang: Language) => {
      setLanguage(lang);
      setIsLangDropdownOpen(false);
  };

  const languages: {code: Language, label: string}[] = [
      { code: 'sq', label: '🇦🇱 SHQIP' },
      { code: 'en', label: '🇬🇧 ENGLISH' },
      { code: 'it', label: '🇮🇹 ITALIANO' },
      { code: 'de', label: '🇩🇪 DEUTSCH' },
      { code: 'fr', label: '🇫🇷 FRANÇAIS' },
      { code: 'el', label: '🇬🇷 ΕΛΛΗΝΙΚΑ' },
      { code: 'ru', label: '🇷🇺 РУССКИЙ' },
      { code: 'es', label: '🇪🇸 ESPAÑOL' },
      { code: 'zh', label: '🇨🇳 中文' },
      { code: 'sv', label: '🇸🇪 SVENSKA' },
      { code: 'tr', label: '🇹🇷 TÜRKÇE' },
      { code: 'no', label: '🇳🇴 NORSK' },
      { code: 'sr', label: '🇷🇸 СРПСКИ' },
      { code: 'hr', label: '🇭🇷 HRVATSKI' },
  ];

  return (
    <>
    <div 
        className="sticky top-0 z-50 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-md shadow-sm flex flex-col transition-colors duration-300" 
        onMouseLeave={() => setHoveredSection(null)}
    >
      
      {/* --- ROW 1: Logo & Actions --- */}
      <div className="border-b border-gray-100 dark:border-dark-border">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between relative">
            {/* Left: Mobile Menu Trigger */}
            <div className="flex items-center gap-4 z-10">
                <button 
                    className="lg:hidden text-black dark:text-white p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-elevated rounded"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <Icons.Menu size={24} />
                </button>
            </div>

            {/* Center: Logo */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
                <Link to="/" className="flex flex-col items-center group">
                    <span className="text-5xl md:text-6xl font-['Merriweather'] font-black tracking-tighter block text-center text-red-700 leading-none">
                        albaniana
                    </span>
                    <span className="text-[0.4rem] md:text-[0.55rem] font-sans font-bold tracking-wider text-black dark:text-gray-300 mt-0.5 whitespace-nowrap">
                        Shqipëri të qofsha falë!
                    </span>
                </Link>
            </div>

            {/* Right: Search, Lang, Theme & User */}
            <div className="flex items-center space-x-3 md:space-x-5 text-gray-900 dark:text-white z-10">
                
                {/* Theme Toggle */}
                <button 
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-elevated text-black dark:text-white transition-colors"
                >
                    {theme === 'light' ? <Icons.Sun size={18} /> : <Icons.Volume2 size={18} className="rotate-45" />} 
                </button>

                {/* Language Selector - Now Visible on Tablet (md:block) */}
                <div className="relative hidden md:block" ref={langDropdownRef}>
                    <button 
                        onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                        className="flex items-center gap-1 text-xs font-bold text-black dark:text-white hover:text-red-700 transition-colors uppercase"
                    >
                        {languages.find(l => l.code === language)?.label.split(' ')[0] || '🌐'} <span className="ml-1 hidden xl:inline">{language}</span> <Icons.ChevronDown size={10} />
                    </button>
                    {isLangDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-40 max-h-80 overflow-y-auto bg-white dark:bg-dark-elevated border border-gray-100 dark:border-dark-border shadow-xl rounded-sm z-[100] animate-in fade-in zoom-in-95 duration-100">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`block w-full text-left px-4 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/10 ${language === lang.code ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search Icon Trigger */}
                {!isLoginPage && (
                    <button 
                        onClick={() => setIsSearchOpen(true)}
                        className="hidden lg:flex text-black dark:text-white hover:text-red-700 transition-colors"
                        title={t('nav.search')}
                    >
                        <Icons.Search size={20} />
                    </button>
                )}
                
                {currentUser ? (
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-elevated p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-gray-200 dark:hover:border-dark-border"
                        >
                            {currentUser.avatar ? (
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-dark-border">
                                    <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-elevated flex items-center justify-center text-gray-500 dark:text-gray-300">
                                    <Icons.User size={16} />
                                </div>
                            )}
                            <Icons.ChevronDown size={14} className={`text-black dark:text-white transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isUserDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-elevated border border-gray-100 dark:border-dark-border shadow-xl rounded-sm z-[100] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <div className="p-4 border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-white/5">
                                    <p className="text-sm font-bold text-black dark:text-white">{currentUser.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">{currentUser.role}</p>
                                </div>
                                <div className="py-2">
                                    {currentUser.role !== UserRole.PUBLIC && (
                                        <Link 
                                            to="/admin" 
                                            onClick={() => setIsUserDropdownOpen(false)}
                                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                                        >
                                            <Icons.LayoutDashboard size={16} /> {t('nav.adminPanel')}
                                        </Link>
                                    )}
                                    <Link 
                                        to="/account" 
                                        onClick={() => setIsUserDropdownOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <Icons.Settings size={16} /> {t('nav.settings')}
                                    </Link>
                                    <div className="h-px bg-gray-100 dark:bg-dark-border my-1 mx-4"></div>
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                                    >
                                        <Icons.LogOut size={16} /> {t('nav.logout')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <Link to="/login" className="flex items-center gap-2 text-sm font-bold text-black dark:text-white hover:text-red-700 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-elevated">
                        <Icons.User size={20} />
                    </Link>
                )}
            </div>
          </div>
      </div>

      {/* --- Hide Categories & Subcategories on Login Page --- */}
      {!isLoginPage && (
        <>
            {/* --- ROW 2: Main Navigation (Desktop) --- */}
            <div className="hidden lg:block border-b border-black dark:border-dark-border bg-transparent">
                <div className="container mx-auto px-4">
                    <nav className="flex justify-center">
                        <ul className="flex items-center space-x-8">
                            {Object.values(Section).map((section) => (
                                <li key={section} className="h-full">
                                    <Link 
                                        to={`/?section=${section}`} 
                                        onMouseEnter={() => setHoveredSection(section)}
                                        className={`
                                            block py-3 text-sm font-bold uppercase tracking-widest border-b-4 transition-all
                                            ${(urlSection === section) ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-gray-200 dark:hover:border-gray-700'}
                                        `}
                                    >
                                        {t(`section.${section}`)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </div>

            {/* --- ROW 3: Sub Navigation / Persistent Mega Menu (Desktop) --- */}
            <div className="hidden lg:block bg-black/5 dark:bg-white/5 border-b border-gray-200 dark:border-dark-border min-h-[40px]">
                <div className="container mx-auto px-4">
                    <div className="flex justify-center items-center py-2 animate-in fade-in duration-300">
                        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            {SUBSECTIONS[activeDisplaySection]?.map(sub => (
                                <li key={sub}>
                                    <Link 
                                        to={`/?section=${activeDisplaySection}&tag=${sub}`} 
                                        className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:underline decoration-1 underline-offset-4 transition-colors"
                                    >
                                        {sub}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </>
      )}

      {/* --- Mobile Menu Overlay --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="absolute top-0 left-0 h-full w-[80%] max-w-sm bg-white dark:bg-dark-surface shadow-2xl overflow-y-auto">
                <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-dark-border">
                     <span className="text-xl font-serif font-black dark:text-white">{t('nav.menu')}</span>
                     <button onClick={() => setIsMobileMenuOpen(false)} className="dark:text-white"><Icons.X size={24} /></button>
                </div>
                
                <div className="p-6 pb-20">
                    <div className="mb-6 pb-6 border-b border-gray-100 dark:border-dark-border">
                         <div className="relative">
                            <input 
                                type="text" 
                                placeholder={t('nav.search')}
                                className="w-full pl-2 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded text-sm bg-gray-50 dark:bg-dark-elevated dark:text-white" 
                            />
                            <Icons.Search size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        
                        {/* Mobile Language Selector (Visible only if not on md/tablet where main dropdown exists) */}
                        <div className="flex flex-wrap gap-4 mt-4 text-sm font-bold md:hidden">
                            {languages.map(lang => (
                                <button 
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={language === lang.code ? 'text-black dark:text-white' : 'text-gray-400'}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ul className="space-y-6">
                        {Object.values(Section).map((section) => (
                            <li key={section}>
                                <Link 
                                    to={`/?section=${section}`} 
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block font-bold text-lg mb-2 text-alb-dark dark:text-white uppercase tracking-widest hover:text-red-700"
                                >
                                    {t(`section.${section}`)}
                                </Link>
                                <ul className="pl-4 border-l-2 border-gray-100 dark:border-dark-border space-y-3">
                                    {SUBSECTIONS[section]?.map(sub => (
                                        <li key={sub}>
                                            <Link 
                                                to={`/?section=${section}&tag=${sub}`} 
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="text-gray-500 dark:text-gray-400 text-sm block hover:text-black dark:hover:text-white"
                                            >
                                                {sub}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                    
                    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-dark-border">
                        {!currentUser ? (
                             <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center bg-black dark:bg-white text-white dark:text-black py-3 rounded-none font-bold uppercase tracking-widest text-sm">{t('nav.login')}</Link>
                        ) : (
                            <div className="space-y-3">
                                {currentUser.role !== UserRole.PUBLIC && (
                                    <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center border border-black dark:border-white text-black dark:text-white py-3 font-bold uppercase tracking-widest text-sm">{t('nav.adminPanel')}</Link>
                                )}
                                <Link to="/account" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 py-3 font-bold uppercase tracking-widest text-sm">{t('nav.settings')}</Link>
                                <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="block w-full text-center bg-gray-100 dark:bg-dark-elevated text-black dark:text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-red-50 hover:text-red-600">{t('nav.logout')}</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>

    {/* --- FULL PAGE LIVE SEARCH OVERLAY --- */}
    {isSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-white/95 dark:bg-dark-base/95 backdrop-blur-sm animate-in fade-in duration-200 flex flex-col">
            
            {/* Close Button */}
            <div className="absolute top-6 right-6 z-10">
                <button 
                    onClick={closeSearch} 
                    className="p-3 bg-gray-100 dark:bg-dark-elevated rounded-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                >
                    <Icons.X size={24} className="text-black dark:text-white" />
                </button>
            </div>

            {/* Content Container */}
            <div className="container mx-auto px-6 pt-32 pb-12 flex flex-col h-full max-w-4xl">
                
                {/* Search Input */}
                <div className="relative mb-6">
                    <input 
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchTab === 'articles' ? "Kërko artikuj..." : "Kërko autorë, përdorues..."}
                        className="w-full text-4xl md:text-6xl font-serif font-bold text-black dark:text-white border-b-2 border-gray-200 dark:border-dark-border focus:border-black dark:focus:border-white outline-none bg-transparent py-4 placeholder-gray-300"
                    />
                    <Icons.Search className={`absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 transition-opacity ${searchQuery ? 'opacity-0' : 'opacity-100'}`} size={40} />
                </div>

                {/* Search Tabs */}
                <div className="flex gap-8 mb-10 border-b border-gray-100 dark:border-dark-border">
                    <button 
                        onClick={() => setSearchTab('articles')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${searchTab === 'articles' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Artikuj {searchQuery && filteredArticles.length > 0 && `(${filteredArticles.length})`}
                    </button>
                    <button 
                        onClick={() => setSearchTab('users')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${searchTab === 'users' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Përdorues {searchQuery && userSearchResults.length > 0 && `(${userSearchResults.length})`}
                    </button>
                </div>

                {/* Results Grid */}
                <div className="flex-1 overflow-y-auto pr-2">
                    {searchQuery ? (
                        <>
                            {searchTab === 'articles' ? (
                                // --- ARTICLES RESULTS ---
                                filteredArticles.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {filteredArticles.map(article => (
                                            <Link 
                                                key={article.id} 
                                                to={`/article/${article.id}`} 
                                                onClick={closeSearch}
                                                className="group flex gap-4 items-start"
                                            >
                                                {article.heroImage && (
                                                    <div className="w-24 h-24 shrink-0 bg-gray-100 dark:bg-dark-elevated overflow-hidden">
                                                        <img src={article.heroImage} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-700 block mb-1">
                                                        {article.section}
                                                    </span>
                                                    <h4 className="font-serif font-bold text-lg leading-tight group-hover:underline decoration-1 underline-offset-4 text-black dark:text-gray-200">
                                                        {article.title}
                                                    </h4>
                                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2 font-serif">
                                                        {article.subtitle}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <Icons.FileText size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-serif text-xl">Nuk u gjet asnjë artikull për "{searchQuery}"</p>
                                    </div>
                                )
                            ) : (
                                // --- USERS RESULTS ---
                                isSearchingUsers ? (
                                    <div className="text-center py-12 text-gray-400 font-bold uppercase tracking-widest text-xs">Duke kërkuar...</div>
                                ) : userSearchResults.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {userSearchResults.map(user => (
                                            <Link 
                                                key={user.id} 
                                                to={`/profile/${user.id}`}
                                                onClick={closeSearch}
                                                className="flex items-center gap-4 p-4 border border-gray-100 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all group"
                                            >
                                                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                                </div>
                                                <div>
                                                    <h4 className="font-serif font-bold text-lg group-hover:underline decoration-1 underline-offset-4 text-black dark:text-white">{user.name}</h4>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">{user.role}</span>
                                                        {user.assignedSection && (
                                                            <span className="text-[10px] text-gray-400 italic">{t(`section.${user.assignedSection}`)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <Icons.User size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-serif text-xl">Nuk u gjet asnjë përdorues për "{searchQuery}"</p>
                                    </div>
                                )
                            )}
                        </>
                    ) : (
                        // Empty State / Suggestions
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 opacity-50">
                             <div>
                                 <h4 className="font-bold text-xs uppercase tracking-widest mb-4 text-black dark:text-white">Seksionet</h4>
                                 <ul className="space-y-2 text-sm">
                                     {Object.values(Section).map(s => (
                                         <li key={s}><Link to={`/?section=${s}`} onClick={closeSearch} className="hover:text-black dark:hover:text-white text-gray-500">{t(`section.${s}`)}</Link></li>
                                     ))}
                                 </ul>
                             </div>
                             <div>
                                 <h4 className="font-bold text-xs uppercase tracking-widest mb-4 text-black dark:text-white">Të njohura</h4>
                                 <ul className="space-y-2 text-sm font-serif">
                                     <li><button onClick={() => setSearchQuery('Tirana')} className="hover:text-black dark:hover:text-white text-gray-500 text-left">Tirana</button></li>
                                     <li><button onClick={() => setSearchQuery('Politikë')} className="hover:text-black dark:hover:text-white text-gray-500 text-left">Politikë</button></li>
                                     <li><button onClick={() => setSearchQuery('Art')} className="hover:text-black dark:hover:text-white text-gray-500 text-left">Art</button></li>
                                     <li><button onClick={() => setSearchQuery('Ekonomi')} className="hover:text-black dark:hover:text-white text-gray-500 text-left">Ekonomi</button></li>
                                 </ul>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )}
    </>
  );
};