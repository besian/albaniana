import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Article, ArticleStatus, User } from '../types';
import { api } from '../services/api';
import { ArticleCard } from '../components/ArticleCard';
import { useLanguage } from '../contexts/LanguageContext';

interface UserProfileProps {
    articles: Article[];
}

export const UserProfile: React.FC<UserProfileProps> = ({ articles }) => {
    const { userId } = useParams();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    useEffect(() => {
        const loadUser = async () => {
            if (!userId) return;
            setLoading(true);
            const userData = await api.users.get(userId);
            setUser(userData);
            setLoading(false);
        };
        loadUser();
    }, [userId]);

    // Filter articles for this author that are published
    const authorArticles = useMemo(() => {
        if (!userId) return [];
        return articles.filter(a => 
            a.authorId === userId && 
            a.status === ArticleStatus.PUBLISHED
        );
    }, [articles, userId]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-xs dark:bg-dark-base">Loading Profile...</div>;
    }

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-xs dark:bg-dark-base">User not found</div>;
    }

    return (
        <div className="bg-white dark:bg-dark-base min-h-screen pb-24 transition-colors duration-300">
            {/* Header */}
            <div className="bg-alb-light dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border py-20">
                <div className="container mx-auto px-4 text-center max-w-2xl">
                    <div className="w-32 h-32 rounded-full border-4 border-white dark:border-dark-elevated shadow-sm overflow-hidden mx-auto mb-6 bg-gray-200 dark:bg-dark-elevated">
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-4xl font-serif font-black text-alb-dark dark:text-white mb-2">{user.name}</h1>
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm">
                            {user.role}
                        </span>
                        {user.assignedSection && (
                            <span className="text-gray-500 text-xs font-serif italic">
                                {t(`section.${user.assignedSection}`)}
                            </span>
                        )}
                    </div>
                    
                    {user.bio && (
                        <div className="text-gray-600 dark:text-gray-300 font-serif leading-relaxed text-lg mb-6">
                            {user.bio}
                        </div>
                    )}

                    {/* Divider Line */}
                    <div className="w-16 h-1 bg-black dark:bg-white mx-auto"></div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 mt-16 max-w-6xl">
                <div className="border-b border-black dark:border-white pb-4 mb-8">
                     <h2 className="text-xl font-bold uppercase tracking-widest text-alb-dark dark:text-white">
                         {t('home.tabArticles')} <span className="text-gray-400 text-sm ml-2">({authorArticles.length})</span>
                     </h2>
                </div>

                {authorArticles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {authorArticles.map(article => (
                            <ArticleCard key={article.id} article={article} variant="standard" />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-gray-50 dark:bg-dark-surface text-gray-400 text-sm italic">
                        Ky autor nuk ka publikuar ende asnjë artikull.
                    </div>
                )}
            </div>
        </div>
    );
};