
import React, { useState } from 'react';
import { NotebookCell, Project } from '../types';
import Cell from './Cell';
import { Plus, Download, Save, Loader2, Sparkles, BrainCircuit, LayoutDashboard, Trash2, CloudUpload, Zap, AlertCircle, Database } from 'lucide-react';

interface NotebookProps {
    project: Project;
    isInitializing: boolean;
    isSuggesting: boolean;
    summary: any;
    needsKey: boolean;
    onUpdateCell: (id: string, content: string) => void;
    onRunCell: (id: string) => void;
    onDeleteCell: (id: string) => void;
    onAddCell: (type: 'code' | 'markdown') => void;
    onGetSuggestion: () => void;
    onExport: (format: 'csv' | 'xlsx') => void;
    onSave: () => void;
    onDeleteProject: (id: string) => void;
    onOpenDashboard: () => void;
}

const Notebook: React.FC<NotebookProps> = ({ 
    project, isInitializing, isSuggesting, summary, needsKey, onUpdateCell, onRunCell, onDeleteCell, onAddCell, onGetSuggestion, onExport, onSave, onDeleteProject, onOpenDashboard
}) => {
    const [exportMenu, setExportMenu] = useState(false);

    if (isInitializing) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-6">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                <div className="text-center">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Initializing Engine...</h2>
                    <p className="text-slate-500 font-medium">Provisioning Python Sandbox for local processing.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/20">
            {/* Engineering Header */}
            <div className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-sm z-30">
                <div className="flex items-center gap-5">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tighter">
                        {project.name}
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-slate-200">Local Sandbox</span>
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={onOpenDashboard}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold text-xs transition-all shadow-sm group"
                    >
                        <LayoutDashboard className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                        ANALYTICS
                    </button>

                    <div className="w-px h-8 bg-slate-200 mx-1" />

                    <button 
                        onClick={onGetSuggestion}
                        disabled={isSuggesting}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xl disabled:bg-slate-300 ${needsKey ? 'bg-slate-100 text-slate-500 border border-slate-200 shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                    >
                        {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : (needsKey ? <AlertCircle className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />)}
                        {isSuggesting ? 'Thinking...' : (needsKey ? 'ENABLE AI PLANNER' : 'CONSTRUCT PLAN')}
                    </button>

                    <div className="w-px h-8 bg-slate-200 mx-1" />

                    <button 
                        onClick={onSave}
                        className="p-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                        title="Save Lab Status"
                    >
                        <Save className="w-6 h-6" />
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setExportMenu(!exportMenu)}
                            className="p-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            title="Export Results"
                        >
                            <Download className="w-6 h-6" />
                        </button>
                        {exportMenu && (
                            <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden py-2">
                                <button 
                                    onClick={() => { onExport('csv'); setExportMenu(false); }}
                                    className="w-full text-left px-5 py-3 text-sm font-bold hover:bg-indigo-50 text-slate-700"
                                >
                                    Export CSV
                                </button>
                                <button 
                                    onClick={() => { onExport('xlsx'); setExportMenu(false); }}
                                    className="w-full text-left px-5 py-3 text-sm font-bold hover:bg-indigo-50 text-slate-700"
                                >
                                    Export Excel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notebook Workspace */}
            <div className="flex-1 overflow-y-auto p-10 scroll-smooth notebook-scrollbar bg-slate-50/50">
                <div className="max-w-4xl mx-auto space-y-10 pb-52">
                    {project.cells.length === 0 && (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-20 text-center animate-in fade-in zoom-in-95 duration-700">
                            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <Database className="w-12 h-12 text-indigo-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter">Laboratory Active</h3>
                            <p className="text-slate-500 mb-10 max-w-sm mx-auto font-medium text-lg leading-relaxed">
                                Write your first pandas code or insert a documentation block to begin engineering.
                            </p>
                            <button onClick={() => onAddCell('code')} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100">CREATE FIRST CELL</button>
                        </div>
                    )}
                    
                    {project.cells.map(cell => (
                        <Cell 
                            key={cell.id} 
                            cell={cell} 
                            summary={summary}
                            onRun={onRunCell} 
                            onDelete={onDeleteCell}
                            onUpdate={onUpdateCell}
                            onExport={onExport}
                        />
                    ))}

                    <div className="flex items-center justify-center gap-6 py-12 border-t border-slate-100 group">
                        <button 
                            onClick={() => onAddCell('code')}
                            className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> INSERT CODE
                        </button>
                        <button 
                            onClick={() => onAddCell('markdown')}
                            className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> INSERT DOCS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Notebook;
