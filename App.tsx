
import React, { useState, useEffect, useCallback } from 'react';
import { User, Project, NotebookCell } from './types';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Notebook from './components/Notebook';
import Dashboard from './components/Dashboard';
import { storage, DatasetRecoveryResult } from './services/storageService';
import { pyEngine } from './services/pyodideService';
import { aiMentor } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { LogOut, Upload, FileText, Loader2, Sparkles, Database, CloudOff, AlertTriangle, RefreshCw, X, Key, Info, ExternalLink, Settings } from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [isEngineReady, setIsEngineReady] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [dashboardData, setDashboardData] = useState<any[]>([]);
    const [autoProgressMsg, setAutoProgressMsg] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isKeyChecking, setIsKeyChecking] = useState(true);
    const [needsKey, setNeedsKey] = useState(false);
    const [showKeyAssistant, setShowKeyAssistant] = useState(false);

    const checkApiKeyStatus = useCallback(async () => {
        const envKey = process.env.API_KEY;
        if (envKey && envKey !== 'undefined' && envKey !== 'null' && envKey.length > 5) {
            setNeedsKey(false);
            return true;
        }
        // @ts-ignore
        if (window.aistudio) {
            try {
                // @ts-ignore
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setNeedsKey(!hasKey);
                return hasKey;
            } catch (e) {
                setNeedsKey(true);
                return false;
            }
        }
        setNeedsKey(true);
        return false;
    }, []);

    useEffect(() => {
        checkApiKeyStatus().then(() => setIsKeyChecking(false));
    }, [checkApiKeyStatus]);

    const handleOpenKeyDialog = async () => {
        // @ts-ignore
        if (window.aistudio) {
            try {
                // @ts-ignore
                await window.aistudio.openSelectKey();
                setNeedsKey(false);
                setShowKeyAssistant(false);
                if (activeProject) startEngineForProject(activeProject);
            } catch (e) {
                console.error("Key selection failed", e);
            }
        } else {
            setShowKeyAssistant(true);
        }
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setUser({ email: session.user.email!, id: session.user.id });
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (session?.user) setUser({ email: session.user.email!, id: session.user.id });
                else { setUser(null); setActiveProject(null); setProjects([]); }
            });
            return () => subscription.unsubscribe();
        };
        init();
    }, []);

    const loadProjects = useCallback(async () => {
        const all = await storage.getProjects();
        setProjects(all);
    }, []);

    useEffect(() => {
        if (user) loadProjects();
    }, [user, loadProjects]);

    const startEngineForProject = async (project: Project, isNew: boolean = false) => {
        setIsEngineReady(false);
        setSummary(null);
        setLoadError(null);
        setAutoProgressMsg('Activating Data Engineering Runtime...');
        
        try {
            await pyEngine.init();
            const datasetId = project.datasetId || project.id;
            const result: DatasetRecoveryResult | null = await storage.getDataset(datasetId, project.id, project.name);
            
            if (result) {
                setAutoProgressMsg(`Mounting dataset: ${result.name}...`);
                await pyEngine.loadFile(result.data, result.name || project.name);
                
                if (!isNew && project.cells) {
                    setAutoProgressMsg('Replaying lab cells...');
                    for (const cell of project.cells) {
                        if (cell.type === 'code' && cell.content.trim()) await pyEngine.runCode(cell.content);
                    }
                }
                
                const currentSummary = await pyEngine.getDatasetSummary();
                setSummary(currentSummary);
                setIsEngineReady(true);
                
                if (isNew) {
                    // Only run AI generation if we have a key
                    const hasKey = await checkApiKeyStatus();
                    if (hasKey) {
                        setIsSuggesting(true);
                        setAutoProgressMsg('AI is architecting cleaning plan...');
                        const plan = await aiMentor.generateFullPlan(currentSummary);
                        const newCells: NotebookCell[] = [{ id: `h_${Date.now()}`, type: 'markdown', content: `# ${plan.plan_title}\n\nAutomated Roadmap Initialized.`, metadata: { isAI: true } }];
                        plan.steps.forEach((step, idx) => {
                            newCells.push({ id: `m_${idx}_${Date.now()}`, type: 'markdown', content: `## ${step.step_name}\n${step.explanation}`, metadata: { isAI: true } });
                            newCells.push({ id: `c_${idx}_${Date.now()}`, type: 'code', content: step.code, metadata: { isAI: true } });
                        });
                        const updated = { ...project, cells: newCells };
                        setActiveProject(updated);
                        await storage.saveProject(updated);
                        setIsSuggesting(false);
                    } else {
                        // If no key, just provide a default code cell to get started
                        const defaultCell: NotebookCell = { id: `c_${Date.now()}`, type: 'code', content: '# Write your pandas code here\nprint(df.head())', isExecuting: false };
                        const updated = { ...project, cells: [defaultCell] };
                        setActiveProject(updated);
                        await storage.saveProject(updated);
                    }
                }
                setAutoProgressMsg('');
            } else {
                throw new Error(`Data source "${project.name}" not found.`);
            }
        } catch (err: any) {
            setLoadError(err.message);
            setIsEngineReady(true);
            setAutoProgressMsg('');
        }
    };

    const handleSelectProject = async (id: string) => {
        const p = projects.find(proj => proj.id === id);
        if (p) {
            setActiveProject(p);
            await startEngineForProject(p, !p.cells?.length);
        }
    };

    // Fix: Implement missing handleDeleteProject function
    const handleDeleteProject = async (id: string) => {
        const p = projects.find(proj => proj.id === id);
        try {
            await storage.deleteProject(id, p?.datasetId);
            await loadProjects();
            if (activeProject?.id === id) {
                setActiveProject(null);
                setSummary(null);
            }
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    const handleRunCell = async (cellId: string) => {
        if (!activeProject || !isEngineReady) return;
        const cellIndex = activeProject.cells.findIndex(c => c.id === cellId);
        if (cellIndex === -1) return;
        const cell = activeProject.cells[cellIndex];
        if (cell.type !== 'code') return;

        const updatedCells = [...activeProject.cells];
        updatedCells[cellIndex] = { ...cell, isExecuting: true, output: undefined, error: undefined };
        setActiveProject({ ...activeProject, cells: updatedCells });

        try {
            const { result, stdout, error } = await pyEngine.runCode(cell.content);
            const finalCells = [...activeProject.cells];
            const finalIdx = finalCells.findIndex(c => c.id === cellId);
            if (finalIdx !== -1) {
                finalCells[finalIdx] = { 
                    ...finalCells[finalIdx], 
                    isExecuting: false, 
                    output: stdout || (result !== undefined ? String(result) : undefined), 
                    error 
                };
                const updatedProject = { ...activeProject, cells: finalCells };
                setActiveProject(updatedProject);
                const currentSummary = await pyEngine.getDatasetSummary();
                setSummary(currentSummary);
                await storage.saveProject(updatedProject);
            }
        } catch (err: any) {
            const finalCells = [...activeProject.cells];
            const finalIdx = finalCells.findIndex(c => c.id === cellId);
            if (finalIdx !== -1) {
                finalCells[finalIdx] = { ...finalCells[finalIdx], isExecuting: false, error: err.message };
                const updatedProject = { ...activeProject, cells: finalCells };
                setActiveProject(updatedProject);
                await storage.saveProject(updatedProject);
            }
        }
    };

    const handleNewProject = async (file: File) => {
        if (isUploading) return;
        setIsUploading(true);
        setAutoProgressMsg('Importing dataset...');
        try {
            const datasetId = `data_${Date.now()}`;
            await storage.saveDataset(datasetId, file, file.name);
            const newProject: Project = { id: `proj_${Date.now()}`, name: file.name, datasetId, cells: [], createdAt: Date.now() };
            await storage.saveProject(newProject);
            await loadProjects();
            setShowUpload(false);
            setActiveProject(newProject);
            await startEngineForProject(newProject, true);
        } catch (err: any) { alert("Import failed: " + err.message); }
        finally { setIsUploading(false); setAutoProgressMsg(''); }
    };

    if (isKeyChecking) {
        return (
            <div className="flex h-screen bg-slate-900 items-center justify-center">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-inter">
            {!user ? ( <Auth onAuthSuccess={(u) => setUser({ email: u.email, id: u.id })} /> ) : (
                <>
                    <Sidebar 
                        projects={projects} 
                        activeProjectId={activeProject?.id || null} 
                        onSelectProject={handleSelectProject} 
                        onDeleteProject={handleDeleteProject} 
                        onNewProject={() => { setShowUpload(true); setLoadError(null); }} 
                        summary={summary} 
                        needsKey={needsKey}
                        onToggleKeyAssistant={() => setShowKeyAssistant(!showKeyAssistant)}
                    />
                    <main className="flex-1 relative">
                        {/* Key Assistant Modal Overlay */}
                        {(showKeyAssistant || (needsKey && isSuggesting)) && (
                            <div className="absolute inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
                                <div className="max-w-xl w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                                    <div className="bg-indigo-600 p-8 text-white flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-black mb-1">AI Features Disabled</h2>
                                            <p className="text-indigo-100 text-sm">To use automated planning, connect a Gemini API Key.</p>
                                        </div>
                                        <button onClick={() => { setShowKeyAssistant(false); setIsSuggesting(false); }} className="p-2 hover:bg-white/20 rounded-full"><X className="w-5 h-5"/></button>
                                    </div>
                                    <div className="p-8 space-y-6">
                                        <div className="grid grid-cols-1 gap-4">
                                            {/* @ts-ignore */}
                                            {window.aistudio && (
                                                <button onClick={handleOpenKeyDialog} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-indigo-500 transition-all flex items-center gap-4 group">
                                                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        <Key className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">Use Native AI Studio Key</div>
                                                        <div className="text-xs text-slate-500">Connect your paid key from Google directly.</div>
                                                    </div>
                                                </button>
                                            )}
                                            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                                    <Settings className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">Cloud Variable (Vercel/Netlify)</div>
                                                    <div className="text-xs text-slate-500">Set <code className="bg-slate-200 px-1 rounded font-mono">API_KEY</code> in your deployment dashboard.</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-amber-800 leading-relaxed">
                                                Note: Gemini 3.0 Pro requires a **Paid API Key**. Free-tier keys are limited and may fail in production.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {autoProgressMsg && (
                            <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                <div className="text-center p-12 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100">
                                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                                    <p className="text-slate-700 font-bold">{autoProgressMsg}</p>
                                </div>
                            </div>
                        )}

                        {showUpload && (
                            <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                                <div className="bg-white rounded-[2rem] p-10 max-w-lg w-full shadow-2xl relative">
                                    <button onClick={() => setShowUpload(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900"><X /></button>
                                    <h3 className="text-2xl font-black mb-6">Initialize New Lab</h3>
                                    <div className="border-4 border-dashed border-slate-100 rounded-[1.5rem] p-12 text-center hover:border-indigo-200 cursor-pointer" onClick={() => document.getElementById('fileInput')?.click()}>
                                        <input id="fileInput" type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleNewProject(e.target.files[0])} />
                                        <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="font-bold text-slate-600">Click to upload Dataset</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeProject ? (
                            <Notebook 
                                project={activeProject} 
                                isInitializing={!isEngineReady} 
                                isSuggesting={isSuggesting} 
                                summary={summary} 
                                needsKey={needsKey}
                                onUpdateCell={(id, content) => { const cells = activeProject.cells.map(c => c.id === id ? { ...c, content } : c); setActiveProject({ ...activeProject, cells }); }} 
                                onRunCell={handleRunCell} 
                                onDeleteCell={(id) => { const cells = activeProject.cells.filter(c => c.id !== id); setActiveProject({ ...activeProject, cells }); }} 
                                onAddCell={(type) => { const newCell: NotebookCell = { id: `cell_${Date.now()}`, type, content: '', isExecuting: false }; setActiveProject({ ...activeProject, cells: [...activeProject.cells, newCell] }); }} 
                                onGetSuggestion={() => needsKey ? setShowKeyAssistant(true) : startEngineForProject(activeProject, true)} 
                                onExport={async (format) => { try { const bytes = await pyEngine.exportData(format); const blob = new Blob([bytes], { type: format === 'csv' ? 'text/csv' : 'application/octet-stream' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `cleaned_${activeProject.name}.${format}`; a.click(); } catch (e: any) { alert("Export failed"); } }} 
                                onSave={() => storage.saveProject(activeProject)} 
                                onDeleteProject={handleDeleteProject} 
                                onOpenDashboard={async () => { setDashboardData([]); setShowDashboard(true); try { const fullData = await pyEngine.getFullData(); setDashboardData(fullData); } catch (err) { console.error("Dashboard failed"); } }} 
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center p-20 bg-white rounded-[3rem] shadow-xl border border-slate-100">
                                    <Database className="w-16 h-16 text-indigo-200 mx-auto mb-6" />
                                    <h3 className="text-2xl font-black text-slate-800 mb-2">Workspace Idle</h3>
                                    <p className="text-slate-400 mb-8">Select a project or upload a file to begin.</p>
                                    <button onClick={() => setShowUpload(true)} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100">NEW LAB ENVIRONMENT</button>
                                </div>
                            </div>
                        )}
                    </main>
                    {showDashboard && activeProject && <Dashboard filename={activeProject.name} data={dashboardData} onClose={() => setShowDashboard(false)} />}
                </>
            )}
        </div>
    );
};

export default App;
