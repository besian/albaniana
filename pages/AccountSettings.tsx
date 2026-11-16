import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Icons } from '../components/Icon';
import { api } from '../services/api';

interface AccountSettingsProps {
    currentUser: User;
    onUpdateUser: (user: User) => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ currentUser, onUpdateUser }) => {
    // State
    const [name, setName] = useState(currentUser.name);
    const [bio, setBio] = useState(currentUser.bio || ''); 
    const [notifications, setNotifications] = useState({ news: true, comments: false });
    const [language, setLanguage] = useState('sq');
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleSave = async () => {
        setIsLoading(true);
        setSuccessMsg('');
        
        try {
            // Update profile
            const updatedUser = { ...currentUser, name, bio };
            await api.auth.updateProfile(updatedUser);
            onUpdateUser(updatedUser);
            
            setSuccessMsg('Ndryshimet u ruajtën me sukses.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            alert("Gabim gjatë ruajtjes.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-alb-light dark:bg-dark-base min-h-screen py-12 transition-colors duration-300">
            <div className="container mx-auto px-4 max-w-2xl">
                
                <div className="mb-8">
                    <h1 className="text-3xl font-serif font-black text-alb-dark dark:text-white">Llogaria Ime</h1>
                    <p className="text-gray-500 mt-2">Menaxho të dhënat personale dhe preferencat.</p>
                </div>

                <div className="bg-white dark:bg-dark-surface shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
                    
                    {/* Header Banner */}
                    <div className="h-32 bg-gray-900 dark:bg-dark-elevated relative">
                        <div className="absolute -bottom-12 left-8">
                            <div className="w-24 h-24 rounded-full border-4 border-white dark:border-dark-surface overflow-hidden bg-gray-200">
                                <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-16 px-8 pb-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{currentUser.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm">
                                        {currentUser.role}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-8">
                            
                            {/* Personal Info */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-dark-border pb-2">Të dhënat Personale</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emri i plotë</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-dark-border dark:bg-dark-elevated dark:text-white p-2 text-sm focus:border-black dark:focus:border-white focus:ring-0 outline-none rounded-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                        <input 
                                            type="email" 
                                            value={currentUser.id.includes('@') ? currentUser.id : 'user@albaniana.com'} 
                                            disabled
                                            className="w-full border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-base p-2 text-sm text-gray-500 rounded-none cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Email nuk mund të ndryshohet.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Përshkrim i shkurtër (Bio)</label>
                                        <textarea 
                                            rows={3}
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-dark-border dark:bg-dark-elevated dark:text-white p-2 text-sm focus:border-black dark:focus:border-white focus:ring-0 outline-none rounded-none resize-none"
                                            placeholder="Shkruani diçka rreth jush..."
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Preferences */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-dark-border pb-2">Preferencat</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gjuha e Ndërfaqes</p>
                                            <p className="text-xs text-gray-500">Zgjidhni gjuhën e preferuar.</p>
                                        </div>
                                        <div className="flex border border-gray-300 dark:border-dark-border rounded-sm overflow-hidden">
                                            <button 
                                                onClick={() => setLanguage('sq')}
                                                className={`px-3 py-1 text-xs font-bold ${language === 'sq' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark-elevated dark:text-gray-400 dark:hover:bg-black/20'}`}
                                            >
                                                SQ
                                            </button>
                                            <button 
                                                onClick={() => setLanguage('en')}
                                                className={`px-3 py-1 text-xs font-bold ${language === 'en' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark-elevated dark:text-gray-400 dark:hover:bg-black/20'}`}
                                            >
                                                EN
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Njoftime për Lajme</p>
                                            <p className="text-xs text-gray-500">Merr email për lajmet e fundit.</p>
                                        </div>
                                        <button 
                                            onClick={() => setNotifications({...notifications, news: !notifications.news})}
                                            className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${notifications.news ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${notifications.news ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <div className="pt-6 border-t border-gray-100 dark:border-dark-border flex items-center justify-between">
                                {successMsg && (
                                    <div className="text-green-600 text-sm font-bold flex items-center gap-2">
                                        <Icons.Check size={16} /> {successMsg}
                                    </div>
                                )}
                                <div className="flex gap-4 ml-auto">
                                    <button className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-widest text-xs hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors">
                                        Anulo
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        disabled={isLoading}
                                        className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-xs hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                                    >
                                        {isLoading && <Icons.Clock size={14} className="animate-spin" />}
                                        Ruaj Ndryshimet
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};