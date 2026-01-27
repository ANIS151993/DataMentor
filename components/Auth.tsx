
import React, { useState } from 'react';
import { Database, ShieldCheck, Mail, Lock, Loader2, Zap } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
    onAuthSuccess: (user: any) => void;
}

const Logo = () => (
    <div className="relative flex items-center justify-center w-20 h-20 bg-white/20 rounded-3xl mx-auto mb-6 backdrop-blur-md border border-white/30 shadow-2xl">
        <Database className="w-10 h-10 text-white" />
        <Zap className="absolute -top-1 -right-1 w-6 h-6 text-yellow-300 animate-pulse drop-shadow-md" />
    </div>
);

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            if (isLogin) {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (authError) throw authError;
                if (data.user) onAuthSuccess(data.user);
            } else {
                const { data, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (authError) throw authError;
                if (data.user) onAuthSuccess(data.user);
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full filter blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-[100px] animate-pulse delay-1000"></div>
            </div>

            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10">
                <div className="bg-indigo-600 p-10 text-white text-center">
                    <Logo />
                    <h1 className="text-3xl font-black italic tracking-tighter">DataMentor AI</h1>
                    <p className="text-indigo-100 text-sm mt-1 font-medium">Cloud-Powered Pandas Lab</p>
                </div>

                <div className="p-8">
                    <div className="flex gap-4 mb-8 bg-slate-100 p-1 rounded-xl">
                        <button 
                            onClick={() => { setIsLogin(true); setError(''); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                        >
                            LOGIN
                        </button>
                        <button 
                            onClick={() => { setIsLogin(false); setError(''); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                        >
                            SIGN UP
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                    type="email" 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                    type="password" 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-500 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-100">
                                <ShieldCheck className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:bg-slate-300 disabled:shadow-none mt-2"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isLogin ? 'SIGN IN' : 'CREATE ACCOUNT')}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-center gap-2 mb-2">
                            <ShieldCheck className="w-3 h-3" /> Supabase Managed Auth
                        </p>
                        <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">
                            © {new Date().getFullYear()} Md Anisur Rahman Chowdhury
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
