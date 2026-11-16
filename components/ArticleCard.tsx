import React from 'react';
import { Link } from 'react-router-dom';
import { Article, Section } from '../types';
import { Icons } from './Icon';

interface ArticleCardProps {
  article: Article;
  variant?: 'hero' | 'standard' | 'compact' | 'opinion';
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, variant = 'standard' }) => {
  
  // Use Author Name or fallback to ID (or handle missing)
  const authorDisplay = article.authorName || article.authorId || 'Redaksia';

  if (variant === 'hero') {
    return (
      <Link to={`/article/${article.id}`} className="group block grid grid-cols-1 md:grid-cols-2 gap-0 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border min-h-[450px]">
        <div className="p-8 md:p-12 flex flex-col justify-center md:order-1 order-2">
            <span className="text-xs font-bold uppercase tracking-widest mb-4 text-alb-gray dark:text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-black dark:bg-white rounded-full"></span> {article.section} 
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-alb-dark dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors leading-tight mb-6">
                {article.title}
            </h2>
            <p className="text-lg text-alb-gray dark:text-gray-400 font-serif leading-relaxed mb-6 line-clamp-3 font-light">
                {article.subtitle}
            </p>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mt-auto">
                <Icons.Clock size={12} />
                <span>{new Date(article.publishDate || Date.now()).toLocaleDateString('sq-AL')}</span>
                <span className="mx-1">•</span>
                <span>{authorDisplay}</span>
            </div>
        </div>
        <div className="md:order-2 order-1 h-64 md:h-full relative overflow-hidden bg-gray-100 dark:bg-dark-elevated">
            {article.heroImage && (
                <img 
                    src={article.heroImage} 
                    alt={article.title} 
                    className="w-full h-full object-cover grayscale-0 group-hover:grayscale transition-all duration-700"
                />
            )}
        </div>
      </Link>
    );
  }

  if (variant === 'opinion') {
    return (
        <Link to={`/article/${article.id}`} className="group block p-6 bg-alb-light dark:bg-dark-surface border-l-4 border-gray-300 dark:border-dark-border hover:border-black dark:hover:border-white transition-colors">
             <div className="flex items-center gap-2 mb-3">
                 <span className="text-gray-400 text-[10px] font-bold px-1 uppercase tracking-wider">Opinion</span>
             </div>
             <div className="font-serif text-2xl text-alb-dark dark:text-white mb-4 leading-snug group-hover:underline decoration-1 underline-offset-4">
                {article.title}
             </div>
             <div className="flex items-center gap-3 mt-4 border-t border-gray-200 dark:border-dark-border pt-3">
                 <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden grayscale">
                    <img src={`https://ui-avatars.com/api/?name=${authorDisplay}&background=random`} alt="Author" />
                 </div>
                 <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{authorDisplay}</div>
             </div>
        </Link>
    )
  }

  // Standard & Compact
  return (
    <Link to={`/article/${article.id}`} className={`group block h-full flex flex-col ${variant === 'compact' ? 'py-3 border-b border-gray-100 dark:border-dark-border' : 'bg-white dark:bg-transparent mb-6'}`}>
      {variant !== 'compact' && article.heroImage && (
        <div className="aspect-video w-full overflow-hidden mb-4 relative bg-gray-100 dark:bg-dark-elevated">
            <img 
                src={article.heroImage} 
                alt={article.title} 
                className="w-full h-full object-cover grayscale-0 group-hover:grayscale transition-all duration-500"
            />
        </div>
      )}
      <div className={`flex flex-col flex-grow ${variant === 'compact' ? '' : ''}`}>
        <span className="text-xs font-bold uppercase tracking-wider mb-2 text-alb-gray dark:text-gray-400">
            {article.section}
        </span>
        <h3 className={`${variant === 'compact' ? 'text-lg' : 'text-2xl'} font-serif font-bold text-alb-dark dark:text-white group-hover:underline decoration-black dark:decoration-white decoration-1 underline-offset-4 leading-tight mb-3`}>
            {article.title}
        </h3>
        {variant !== 'compact' && (
             <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 font-serif font-light leading-relaxed">{article.subtitle}</p>
        )}
       
        {variant !== 'compact' && (
            <div className="mt-auto pt-2 text-xs text-gray-400 dark:text-gray-500">
             {new Date(article.publishDate || Date.now()).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' })}
            </div>
        )}
      </div>
    </Link>
  );
};