
import React, { useState, useEffect } from 'react';
import { Project, DatasetMetadata } from '../types';
import { storage, CloudFile } from '../services/storageService';
import { FileText, Plus, Trash2, FolderOpen, Database, BarChart3, Cloud, HardDrive, Loader2, RefreshCw } from 'lucide-react';

interface SidebarProps {
    projects: Project[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
    onDeleteProject: (id: string) => void;
    onNewProject: () => void;
    summary: any;
}

const Sidebar: React.FC<SidebarProps> = ({ projects, activeProjectId, onSelectProject, onDeleteProject, onNewProject, summary }) => {
    const [view, setView] = useState<'files' | 'explorer' | 'cloud'>('files');
    const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshCloudFiles = async () => {
        setIsRefreshing(true);
        try {
            const files = await storage.listAllUserFiles();
            setCloudFiles(files);
        } catch (e) {
            console.error(e);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (view === 'cloud') {
            refreshCloudFiles();
        }
    }, [view]);

    const handleDeleteCloudFile = async (path: string) => {
        if (!window.confirm("Permanently delete this raw data file from Supabase? This cannot be undone.")) return;
        try {
            await storage.deleteStorageFile(path);
            refreshCloudFiles();
        } catch (e) {
            alert("Failed to delete file from cloud.");
        }
    };

    return (
        <aside className="w-80 flex flex-col border-r border-slate-200 h-screen bg-white">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <h1 className="font-black text-slate-800 flex items-center gap-2 italic text-lg tracking-tight">
                    <Database className="w-6 h-6 text-indigo-600" />
                    DataMentor
                </h1>
                <button 
                    onClick={onNewProject}
                    className="p-2 hover:bg-slate-200 rounded-xl transition-all text-indigo-600 bg-indigo-50"
                    title="New Lab Environment"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex border-b border-slate-200 text-[10px] font-black tracking-widest uppercase">
                <button 
                    onClick={() => setView('files')}
                    className={`flex-1 py-4 border-b-2 transition-all ${view === 'files' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Labs
                </button>
                <button 
                    onClick={() => setView('cloud')}
                    className={`flex-1 py-4 border-b-2 transition-all ${view === 'cloud' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Cloud
                </button>
                <button 
                    onClick={() => setView('explorer')}
                    className={`flex-1 py-4 border-b-2 transition-all ${view === 'explorer' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Insights
                </button>
            </div>

            <div className="flex-1 overflow-y-auto notebook-scrollbar">
                {view === 'files' ? (
                    <div className="p-3 space-y-2">
                        {projects.length === 0 && (
                            <div className="text-center py-16 px-6">
                                <HardDrive className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-sm text-slate-400 font-medium">No active lab environments. Create one to begin engineering.</p>
                            </div>
                        )}
                        {projects.map(p => (
                            <div 
                                key={p.id}
                                className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${activeProjectId === p.id ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl' : 'hover:bg-slate-50 text-slate-600 border-transparent'}`}
                                onClick={() => onSelectProject(p.id)}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <div className={`p-2 rounded-xl ${activeProjectId === p.id ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'}`}>
                                        <FileText className={`w-4 h-4 ${activeProjectId === p.id ? 'text-white' : 'text-slate-500'}`} />
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className="text-sm font-bold truncate leading-tight">{p.name}</span>
                                        <span className={`text-[10px] font-medium opacity-60 ${activeProjectId === p.id ? 'text-white' : 'text-slate-400'}`}>
                                            {new Date(p.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                                    className={`p-2 rounded-xl transition-all ${activeProjectId === p.id ? 'text-white/60 hover:text-white hover:bg-white/10' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : view === 'cloud' ? (
                    <div className="p-3 space-y-4">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Master Cloud Files</h3>
                            <button onClick={refreshCloudFiles} disabled={isRefreshing} className="p-1 hover:bg-slate-100 rounded text-indigo-500">
                                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        {isRefreshing && cloudFiles.length === 0 ? (
                            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
                        ) : cloudFiles.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic text-xs">No files found in Supabase Storage.</div>
                        ) : (
                            cloudFiles.map(file => (
                                <div key={file.path} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3 truncate">
                                            <Cloud className="w-4 h-4 text-indigo-400 shrink-0" />
                                            <div className="flex flex-col truncate">
                                                <span className="text-xs font-bold text-slate-700 truncate leading-tight">{file.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{(file.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteCloudFile(file.path)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Raw File from Cloud"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="p-5">
                        {!summary ? (
                            <div className="text-center py-16 px-6">
                                <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-sm text-slate-400 italic">Mount a lab environment to stream real-time telemetry here.</p>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Lab Dimensions</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                                            <div className="text-[10px] text-slate-400 font-black uppercase mb-1">Rows</div>
                                            <div className="text-xl font-black text-slate-800">{summary.shape[0].toLocaleString()}</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                                            <div className="text-[10px] text-slate-400 font-black uppercase mb-1">Cols</div>
                                            <div className="text-xl font-black text-slate-800">{summary.shape[1]}</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Schema Map</h3>
                                    <div className="space-y-3">
                                        {summary.columns.map((col: string) => (
                                            <div key={col} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 transition-all group">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-slate-700 truncate">{col}</span>
                                                    <span className="text-[9px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-500 font-black uppercase">{summary.dtypes[col]}</span>
                                                </div>
                                                {summary.missing[col] > 0 && (
                                                    <div className="flex items-center gap-1.5 text-amber-600 text-[10px] font-bold">
                                                        <div className="w-1 h-1 rounded-full bg-amber-500" />
                                                        {summary.missing[col]} NULLS DETECTED
                                                    </div>
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

            <div className="p-5 bg-slate-50 border-t border-slate-200 text-[9px] text-slate-400 text-center font-black uppercase tracking-widest flex items-center justify-center gap-2">
                <Database className="w-3 h-3" /> Core: 2.5 Pro Engine
            </div>
        </aside>
    );
};

export default Sidebar;
