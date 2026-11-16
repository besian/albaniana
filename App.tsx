import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { ArticleView } from './pages/ArticleView';
import { UserProfile } from './pages/UserProfile';
import { Dashboard } from './pages/admin/Dashboard';
import { Editor } from './pages/admin/Editor';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AccountSettings } from './pages/AccountSettings';
import { Article, User, UserRole } from './types';
import { api } from './services/api';
import { Icons } from './components/Icon';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';

const AppContent: React.FC = () => {
  // State
  const [articles, setArticles] = useState<Article[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const { t } = useLanguage();

  // Initial Data Fetch & Auth Observation
  useEffect(() => {
    const unsubscribe = api.auth.observeAuth(async (currentUser) => {
      try {
        setUser(currentUser);
        // Fetch articles based on the current user's permissions
        // If currentUser is null, api.articles.list will only fetch PUBLISHED articles.
        const data = await api.articles.list(currentUser);
        setArticles(data);
      } catch (error) {
        console.error("Backend connection failed:", error);
      } finally {
        setIsAppLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (user: User) => {
    // Optimistic set (real source of truth is observeAuth)
    setUser(user);
    setIsAppLoading(true);
    // Re-fetch articles with new permissions
    try {
        const data = await api.articles.list(user);
        setArticles(data);
    } finally {
        setIsAppLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    // Re-fetch articles (downgrade to public only)
    const data = await api.articles.list(null);
    setArticles(data);
  };

  const handleUpdateUser = (updatedUser: User) => {
      setUser(updatedUser);
  };

  const saveArticle = async (article: Article) => {
    try {
        const savedArticle = await api.articles.save(article);
        
        // Update local state to reflect server state
        setArticles(prev => {
            const exists = prev.find(a => a.id === savedArticle.id);
            if (exists) {
                return prev.map(a => a.id === savedArticle.id ? savedArticle : a);
            }
            return [savedArticle, ...prev];
        });
    } catch (error) {
        alert("Failed to save article to backend.");
        console.error(error);
    }
  };

  const deleteArticle = async (id: string) => {
      console.log("App: Executing delete for article", id);
      
      if (!id) return;

      // 1. Snapshot for rollback
      const previousArticles = [...articles];

      // 2. Optimistic Update (Remove immediately from UI)
      setArticles(prev => prev.filter(a => a.id !== id));

      try {
          // 3. Backend Call
          await api.articles.delete(id);
          console.log(`App: Successfully deleted ${id} from backend.`);
      } catch (error: any) {
          console.error("App: DELETE FAILED - ", error);
          
          // 4. Rollback UI
          setArticles(previousArticles);
          
          // 5. User Feedback
          if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
             alert(`NUK KENI LEJE! Sigurohuni që rregullat në Firebase lejojnë rolin '${user?.role}' të fshijë.`);
          } else {
             alert(`GABIM SERVERI: ${error.message}`);
          }
      }
  };

  if (isAppLoading) {
    return (
        <div className="min-h-screen bg-white dark:bg-dark-base flex flex-col items-center justify-center">
            <h1 className="text-4xl font-serif font-black tracking-tighter mb-4 animate-pulse">
                <span className="text-red-700">albaniana</span>
            </h1>
            <div className="w-48 h-1 bg-gray-100 dark:bg-dark-elevated overflow-hidden">
                <div className="h-full bg-black dark:bg-white animate-[shimmer_1s_infinite]"></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-4">Duke u lidhur...</p>
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-dark-base font-sans text-slate-900 dark:text-dark-text flex flex-col transition-colors duration-300">
        <Navbar 
          onLogout={handleLogout} 
          currentUser={user} 
          articles={articles}
        />

        <Routes>
          <Route path="/" element={<Home articles={articles} />} />
          <Route path="/article/:id" element={<ArticleView articles={articles} />} />
          <Route path="/profile/:userId" element={<UserProfile articles={articles} />} />
          
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          
          <Route path="/account" element={
              user ? <AccountSettings currentUser={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />
          } />

          {/* Admin Routes */}
          <Route path="/admin" element={
            user ? <Dashboard articles={articles} currentUser={user} onSave={saveArticle} onDelete={deleteArticle} /> : <Navigate to="/login" />
          } />
          
          <Route path="/admin/edit/:id" element={
            user ? <Editor articles={articles} currentUser={user} onSave={saveArticle} /> : <Navigate to="/login" />
          } />
        </Routes>
        
        <footer className="bg-black dark:bg-dark-surface text-white py-16 mt-auto border-t border-gray-900 dark:border-dark-border">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
                <div>
                    <h3 className="font-serif font-black text-3xl mb-6">albaniana</h3>
                    <p className="text-sm text-gray-400 font-light leading-relaxed mb-6">{t('footer.about')}</p>
                    <div className="flex gap-4">
                        <a href="#" className="w-8 h-8 bg-gray-800 hover:bg-white hover:text-black rounded-full flex items-center justify-center transition-colors">
                            <span className="font-bold text-xs">Fb</span>
                        </a>
                        <a href="#" className="w-8 h-8 bg-gray-800 hover:bg-white hover:text-black rounded-full flex items-center justify-center transition-colors">
                             <span className="font-bold text-xs">X</span>
                        </a>
                        <a href="#" className="w-8 h-8 bg-gray-800 hover:bg-white hover:text-black rounded-full flex items-center justify-center transition-colors">
                             <span className="font-bold text-xs">Ig</span>
                        </a>
                    </div>
                </div>
                <div>
                    <h4 className="font-bold text-xs uppercase tracking-widest mb-6 border-b border-gray-800 pb-2 text-gray-500">{t('footer.sections')}</h4>
                    <ul className="text-sm space-y-3 text-gray-300 font-light">
                        <li><Link to="/?section=Lajme" className="hover:text-white hover:underline decoration-1 underline-offset-4">Lajme</Link></li>
                        <li><Link to="/?section=Kulturë" className="hover:text-white hover:underline decoration-1 underline-offset-4">Kulturë</Link></li>
                        <li><Link to="/?section=Shoqëri" className="hover:text-white hover:underline decoration-1 underline-offset-4">Shoqëri</Link></li>
                        <li><Link to="/?section=Rubrika" className="hover:text-white hover:underline decoration-1 underline-offset-4">Rubrika</Link></li>
                        <li><Link to="/?section=Krijimtari" className="hover:text-white hover:underline decoration-1 underline-offset-4">Krijimtari</Link></li>
                        <li><Link to="/?section=Shkentek" className="hover:text-white hover:underline decoration-1 underline-offset-4">Shkentek</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-xs uppercase tracking-widest mb-6 border-b border-gray-800 pb-2 text-gray-500">{t('footer.aboutUs')}</h4>
                    <ul className="text-sm space-y-3 text-gray-300 font-light">
                        <li><Link to="/about" className="hover:text-white">Redaksia</Link></li>
                        <li><Link to="/contact" className="hover:text-white">{t('footer.contact')}</Link></li>
                        <li><Link to="/privacy" className="hover:text-white">{t('footer.privacy')}</Link></li>
                        <li><Link to="/terms" className="hover:text-white">Kushtet e Përdorimit</Link></li>
                        <li><Link to="/ads" className="hover:text-white">Reklamoni me ne</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-xs uppercase tracking-widest mb-6 border-b border-gray-800 pb-2 text-gray-500">Buletini</h4>
                     <p className="text-xs text-gray-500 mb-4">Regjistrohuni për të marrë lajmet më të fundit.</p>
                     <div className="flex flex-col gap-2">
                         <input type="email" placeholder="Email juaj" className="bg-gray-900 border border-gray-800 text-white text-xs p-3 focus:border-gray-500 outline-none" />
                         <button className="bg-white text-black text-xs font-bold uppercase tracking-widest py-3 hover:bg-gray-200 transition-colors">Regjistrohu</button>
                     </div>
                </div>
            </div>
            <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-900 dark:border-dark-border text-center text-xs text-gray-600">
                &copy; {new Date().getFullYear()} Albaniana. {t('footer.rights')} Made with ❤️ in Tirana.
            </div>
        </footer>
      </div>
    </Router>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <LanguageProvider>
        <AppContent />
    </LanguageProvider>
  </ThemeProvider>
);

export default App;