import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserRole, User } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginProps {
    onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        try {
            const user = await api.auth.login(email, password);
            onLogin(user);
            // Redirect anyone with dashboard access (Not PUBLIC) to admin panel
            navigate(user.role !== UserRole.PUBLIC ? '/admin' : '/');
        } catch (err) {
            setError('Kredenciale të pasakta.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            const user = await api.auth.loginWithGoogle();
            onLogin(user);
            navigate(user.role !== UserRole.PUBLIC ? '/admin' : '/');
        } catch (err: any) {
            console.error("Google login error:", err);
            
            // Handle specific Firebase Config errors to help the developer
            if (err.code === 'auth/popup-closed-by-user') {
                setError("Hyrja u anulua nga përdoruesi.");
            } else if (err.code === 'auth/cancelled-popup-request') {
                // Ignore, duplicate request
            } else if (err.code === 'auth/operation-not-allowed') {
                setError("Google Sign-In nuk është aktivizuar në Firebase Console.");
            } else if (err.code === 'auth/unauthorized-domain') {
                // Show the EXACT domain that needs to be added
                setError(`Domain-i "${window.location.hostname}" nuk është i autorizuar. Shtojeni tek Firebase Console > Auth > Settings.`);
            } else {
                 setError(`Gabim: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-alb-light dark:bg-dark-base flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm uppercase tracking-widest">{t('auth.loginTitle')}</p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-dark-surface py-8 px-4 shadow-sm border border-gray-200 dark:border-dark-border sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded">
                                {error}
                            </div>
                        )}
                        <div>
                            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                {t('auth.email')}
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="text" // changed from email to allow username login for demo
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-elevated dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-black dark:focus:border-white sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                {t('auth.password')}
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-elevated dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-black dark:focus:border-white sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold uppercase tracking-widest text-white bg-black dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none transition-colors disabled:bg-gray-400"
                            >
                                {isLoading ? t('auth.loggingIn') : t('auth.loginBtn')}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-dark-border" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-dark-surface text-gray-500 text-xs uppercase tracking-widest">
                                    {t('auth.orContinue')}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 gap-3 flex flex-col">
                             <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-dark-border shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-elevated hover:bg-gray-50 dark:hover:bg-white/10 focus:outline-none transition-colors"
                            >
                                <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                                    <path d="M12.0003 20.45c-4.6667 0-8.45-3.7833-8.45-8.45 0-4.6667 3.7833-8.45 8.45-8.45 2.15 0 4.1.75 5.6167 2.0167l-2.2 2.2c-.85-.6333-1.95-1.0667-3.4167-1.0667-2.9 0-5.25 2.35-5.25 5.25s2.35 5.25 5.25 5.25c2.6167 0 4.8667-1.4667 5.6667-3.8833H12.0003V10.3h8.8667c.1.5167.15 1.05.15 1.6333 0 4.9667-3.3333 8.5167-8.5167 8.5167z" fill="#4285F4"/>
                                </svg>
                                {t('auth.google')}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('auth.noAccount')}{' '}
                            <Link to="/register" className="font-bold text-black dark:text-white hover:underline">
                                {t('auth.registerLink')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};