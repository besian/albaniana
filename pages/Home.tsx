import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Article, ArticleStatus, Section, User } from '../types';
import { ArticleCard } from '../components/ArticleCard';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../services/api';

interface HomeProps {
  articles: Article[];
}

export const Home: React.FC<HomeProps> = ({ articles }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentSection = searchParams.get('section') as Section | null;
  const currentTag = searchParams.get('tag'); // Subcategory URL param
  const searchQuery = searchParams.get('search');
  const { t } = useLanguage();

  // Search Tabs State
  const [activeTab, setActiveTab] = useState<'articles' | 'users'>('articles');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  useEffect(() => {
      // If we are searching and switched to user tab, fetch users
      if (searchQuery && activeTab === 'users') {
          setIsSearchingUsers(true);
          api.users.search(searchQuery).then(users => {
              setUserResults(users);
              setIsSearchingUsers(false);
          });
      }
  }, [searchQuery, activeTab]);

  const publishedArticles = useMemo(() => {
    // Current Time
    const now = new Date();

    let filtered = articles.filter(a => {
        // Condition 1: Explicitly Published
        const isPublished = a.status === ArticleStatus.PUBLISHED;
        
        // Condition 2: Scheduled, and the date has passed
        const isScheduledPassed = a.status === ArticleStatus.SCHEDULED && a.publishDate && new Date(a.publishDate) <= now;
        
        return isPublished || isScheduledPassed;
    });

    // Filter by Section
    if (currentSection) {
        filtered = filtered.filter(a => a.section === currentSection);
    }

    // Filter by Subcategory/Tag
    if (currentTag) {
        filtered = filtered.filter(a => 
            a.subcategory === currentTag || 
            (a.tags && a.tags.includes(currentTag))
        );
    }

    // Filter by Search Query
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(a => 
            a.title.toLowerCase().includes(query) || 
            a.subtitle.toLowerCase().includes(query) ||
            a.content.some(block => block.content.toLowerCase().includes(query))
        );
    }

    return filtered.sort((a, b) => new Date(b.publishDate!).getTime() - new Date(a.publishDate!).getTime());
  }, [articles, currentSection, currentTag, searchQuery]);

  const heroArticle = publishedArticles[0];
  const sideArticles = publishedArticles.slice(1, 4);
  const opinionArticles = publishedArticles.filter(a => a.section === Section.SHOQERI).slice(0, 3);
  const remainingArticles = publishedArticles.slice(4);

  return (
    <div className="bg-white dark:bg-dark-base min-h-screen pb-24 transition-colors duration-300">
      <div className="container mx-auto px-4 pt-8">
        
        {/* Search Header with Tabs */}
        {searchQuery && (
             <div className="border-b border-black dark:border-white pb-0 mb-12">
                <h1 className="text-4xl font-serif font-bold text-alb-dark dark:text-white tracking-tight mb-6">Kërko: "{searchQuery}"</h1>
                
                <div className="flex gap-8">
                    <button 
                        onClick={() => setActiveTab('articles')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'articles' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t('home.tabArticles')} ({publishedArticles.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'users' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t('home.tabUsers')}
                    </button>
                </div>
            </div>
        )}

        {/* Section/Subcategory Headers */}
        {currentSection && !searchQuery && (
            <div className="border-b border-black dark:border-white pb-6 mb-12">
                <div className="flex items-baseline gap-4">
                    <h1 className="text-6xl font-serif font-black text-alb-dark dark:text-white tracking-tight">{t(`section.${currentSection}`)}</h1>
                    {currentTag && (
                        <span className="text-3xl font-serif font-light text-gray-400">/ {currentTag}</span>
                    )}
                </div>
            </div>
        )}

        {/* --- USERS TAB CONTENT --- */}
        {searchQuery && activeTab === 'users' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                {isSearchingUsers ? (
                    <div className="col-span-3 text-center py-12 text-gray-400">Loading users...</div>
                ) : userResults.length > 0 ? (
                    userResults.map(user => (
                        <Link to={`/profile/${user.id}`} key={user.id} className="border border-gray-200 dark:border-dark-border p-6 flex items-center gap-4 hover:shadow-md transition-shadow group cursor-pointer bg-white dark:bg-dark-surface">
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-transparent group-hover:border-gray-300">
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h3 className="font-serif font-bold text-lg dark:text-white group-hover:underline decoration-1 underline-offset-2">{user.name}</h3>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">{user.role}</span>
                                    {user.assignedSection && (
                                        <span className="text-xs text-gray-400 italic">{t(`section.${user.assignedSection}`)}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="col-span-3 text-center py-12 text-gray-400">{t('home.noUsers')}</div>
                )}
            </div>
        )}

        {/* --- ARTICLES TAB CONTENT --- */}
        {(!searchQuery || activeTab === 'articles') && (
            <>
                {/* Hero Section - Hide if searching to show list results instead, or keep if you prefer */}
                {!currentSection && !currentTag && !searchQuery && heroArticle && (
                    <div className="mb-16">
                        <ArticleCard article={heroArticle} variant="hero" />
                    </div>
                )}

                {/* Main Grid: Changed breakpoints to 'lg' so tablet stacks vertically */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 border-t border-gray-100 dark:border-dark-border pt-12">
                    
                    {/* Left Column: Latest News (Stacks on tablet) */}
                    <div className="lg:col-span-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                            {/* Show Hero as standard card if in section/tag view or search */}
                            {(currentSection || currentTag || searchQuery) && heroArticle && (
                                <div className="col-span-full mb-8">
                                    <ArticleCard article={heroArticle} variant="hero" />
                                </div>
                            )}
                            
                            {sideArticles.map(article => (
                                <ArticleCard key={article.id} article={article} variant="standard" />
                            ))}
                        </div>

                        {/* Feed */}
                        <div className="col-span-full mt-16 pt-8 border-t border-black dark:border-white">
                            <h3 className="text-xl font-bold uppercase tracking-widest mb-8 text-alb-dark dark:text-white flex items-center gap-2">
                                <span className="w-3 h-3 bg-black dark:bg-white"></span> {t('home.latest')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {remainingArticles.map(article => (
                                    <ArticleCard key={article.id} article={article} variant="compact" />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Opinion (Now Shoqëri) & Most Read (Stacks below on tablet) */}
                    <div className="lg:col-span-4 space-y-12 lg:border-l border-gray-100 dark:border-dark-border pl-0 lg:pl-12 pt-8 lg:pt-0 border-t lg:border-t-0">
                        
                        {/* Opinion Block */}
                        <div className="">
                            <div className="flex items-center justify-between border-b border-black dark:border-white pb-2 mb-6">
                                <Link to={`/?section=${Section.SHOQERI}`} className="text-lg font-bold text-alb-dark dark:text-white uppercase tracking-widest hover:text-red-700 transition-colors">
                                    {t('home.opinion')}
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {opinionArticles.length > 0 ? opinionArticles.map(art => (
                                    <ArticleCard key={art.id} article={art} variant="opinion" />
                                )) : (
                                    <p className="text-gray-400 italic text-sm p-2">{t('home.noOpinion')}</p>
                                )}
                            </div>
                        </div>

                        {/* Newsletter */}
                        <div className="bg-alb-light dark:bg-dark-surface p-8 text-center">
                            <Icons.Send size={32} className="mx-auto mb-4 text-alb-gray dark:text-gray-400" />
                            <h4 className="font-serif font-bold text-xl text-alb-dark dark:text-white mb-2">{t('home.newsletterTitle')}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-light">{t('home.newsletterDesc')}</p>
                            <div className="flex flex-col gap-3">
                                <input type="email" placeholder={t('home.emailPlaceholder')} className="w-full border border-gray-300 dark:border-dark-border p-2 text-sm bg-white dark:bg-dark-elevated dark:text-white focus:border-black dark:focus:border-white outline-none" />
                                <button className="w-full bg-black dark:bg-white text-white dark:text-black px-3 py-2 text-sm font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">{t('home.subscribe')}</button>
                            </div>
                        </div>

                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};