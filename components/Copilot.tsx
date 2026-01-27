
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, Check, X, Loader2, Bot } from 'lucide-react';
import { ChatMessage, aiMentor } from '../services/geminiService';

interface CopilotProps {
    code: string;
    error: string;
    summary: any;
    onApplyFix: (newCode: string) => void;
    onClose: () => void;
}

const Copilot: React.FC<CopilotProps> = ({ code, error, summary, onApplyFix, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initial AI analysis
        const autoAnalyze = async () => {
            setIsTyping(true);
            try {
                const response = await aiMentor.solveError(code, error, summary, []);
                setMessages([response]);
            } catch (err) {
                setMessages([{ role: 'model', text: 'Sorry, I had trouble analyzing this error. Please check your API key or connection.' }]);
            } finally {
                setIsTyping(false);
            }
        };
        autoAnalyze();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        const userMsg: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await aiMentor.solveError(code, error, summary, [...messages, userMsg]);
            setMessages(prev => [...prev, response]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'model', text: 'I encountered an error while thinking. Please try again.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="mt-4 bg-white border border-indigo-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-bold">AI Debugging Copilot</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-indigo-50/20">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white border border-indigo-100 text-slate-700 rounded-tl-none'
                        }`}>
                            <div className="flex items-center gap-2 mb-1">
                                {msg.role === 'model' ? <Bot className="w-3 h-3 text-indigo-500" /> : null}
                                <span className="text-[10px] font-bold opacity-60 uppercase">
                                    {msg.role === 'model' ? 'Copilot' : 'You'}
                                </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            
                            {msg.suggestedCode && (
                                <div className="mt-3 space-y-2">
                                    <div className="p-3 bg-slate-900 rounded-lg overflow-x-auto">
                                        <code className="text-indigo-300 text-xs font-mono">{msg.suggestedCode}</code>
                                    </div>
                                    <button 
                                        onClick={() => onApplyFix(msg.suggestedCode!)}
                                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-3.5 h-3.5" /> APPLY FIX TO CELL
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-indigo-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-indigo-100 bg-white shrink-0">
                <div className="relative">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask Copilot a question..."
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                    />
                    <button 
                        onClick={handleSend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Copilot;
