
import React, { useState } from 'react';
import { Project, DatasetMetadata } from '../types';
import { FileText, Plus, Trash2, FolderOpen, Database, BarChart3, ChevronRight } from 'lucide-react';

interface SidebarProps {
    projects: Project[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
    onDeleteProject: (id: string) => void;
    onNewProject: () => void;
    summary: any;
}

const Sidebar: React.FC<SidebarProps> = ({ projects, activeProjectId, onSelectProject, onDeleteProject, onNewProject, summary }) => {
    const [view, setView] = useState<'files' | 'explorer'>('files');

    return (
        <aside className="w-72 flex flex-col border-r border-slate-200 h-screen bg-white">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <h1 className="font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    DataMentor
                </h1>
                <button 
                    onClick={onNewProject}
                    className="p-1.5 hover:bg-slate-200 rounded-md transition-colors text-slate-600"
                    title="New Project"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex border-b border-slate-200 text-xs font-semibold">
                <button 
                    onClick={() => setView('files')}
                    className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${view === 'files' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FolderOpen className="w-4 h-4" /> PROJECTS
                </button>
                <button 
                    onClick={() => setView('explorer')}
                    className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${view === 'explorer' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <BarChart3 className="w-4 h-4" /> EXPLORER
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {view === 'files' ? (
                    <div className="p-2 space-y-1">
                        {projects.length === 0 && (
                            <div className="text-center py-10 px-4">
                                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">No projects yet. Upload a dataset to begin.</p>
                            </div>
                        )}
                        {projects.map(p => (
                            <div 
                                key={p.id}
                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${activeProjectId === p.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}
                                onClick={() => onSelectProject(p.id)}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <FileText className={`w-4 h-4 ${activeProjectId === p.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className="text-sm font-medium truncate">{p.name}</span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4">
                        {!summary ? (
                            <div className="text-center py-10 px-4">
                                <Database className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 italic">Select a project to see data insights</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Dimensions</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
                                            <div className="text-xs text-slate-500">Rows</div>
                                            <div className="font-bold text-slate-800">{summary.shape[0]}</div>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
                                            <div className="text-xs text-slate-500">Cols</div>
                                            <div className="font-bold text-slate-800">{summary.shape[1]}</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Columns & Types</h3>
                                    <div className="space-y-2">
                                        {summary.columns.map((col: string) => (
                                            <div key={col} className="text-xs flex flex-col gap-0.5 border-b border-slate-100 pb-2 last:border-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold text-slate-700 truncate">{col}</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">{summary.dtypes[col]}</span>
                                                </div>
                                                {summary.missing[col] > 0 && (
                                                    <span className="text-orange-500 text-[10px]">⚠️ {summary.missing[col]} missing values</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 text-center font-medium">
                V1.0.0 - BROWSER POWERED
            </div>
        </aside>
    );
};

export default Sidebar;
