
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
import { LogOut, Upload, FileText, Loader2, Sparkles, Database, CloudOff, AlertTriangle, RefreshCw, X, Key, Info, ExternalLink } from 'lucide-react';

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
    const [isLocalMode, setIsLocalMode] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isKeyChecking, setIsKeyChecking] = useState(true);
    const [needsKey, setNeedsKey] = useState(false);

    // Robust check for API Key presence
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
                // Instructions dictate we assume success to avoid race conditions
                setNeedsKey(false);
                setLoadError(null);
                if (activeProject) startEngineForProject(activeProject);
            } catch (e) {
                console.error("Key selection failed", e);
            }
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
                setIsLocalMode(result.isLocal);
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
                }
                setAutoProgressMsg('');
            } else {
                throw new Error(`Data source "${project.name}" not found.`);
            }
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.toLowerCase().includes("key") || msg.toLowerCase().includes("api")) {
                setNeedsKey(true);
                setLoadError("AI Authentication Failed");
            } else {
                setLoadError(err.message);
            }
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

    const handleDeleteProject = async (id: string) => {
        const p = projects.find(proj => proj.id === id);
        if (!p || !window.confirm(`Delete Lab "${p.name}"?`)) return;
        if (activeProject?.id === id) { setActiveProject(null); setSummary(null); }
        await storage.deleteProject(id, p.datasetId);
        await loadProjects();
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
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Handshaking with Gemini...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-inter">
            {!user ? ( <Auth onAuthSuccess={(u) => setUser({ email: u.email, id: u.id })} /> ) : (
                <>
                    <Sidebar projects={projects} activeProjectId={activeProject?.id || null} onSelectProject={handleSelectProject} onDeleteProject={handleDeleteProject} onNewProject={() => { setShowUpload(true); setLoadError(null); }} summary={summary} />
                    <main className="flex-1 relative">
                        {/* Connection Status Bar */}
                        <div className="absolute top-4 right-8 z-40 flex items-center gap-2">
                            {needsKey ? (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-full text-[10px] font-black shadow-lg">
                                    <CloudOff className="w-3 h-3" /> AI DISCONNECTED
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-[10px] font-black shadow-sm">
                                    <Sparkles className="w-3 h-3" /> AI ENGINE READY
                                </div>
                            )}
                        </div>

                        {/* Setup Assistant for Disconnected state */}
                        {needsKey && (
                            <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6">
                                <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                                    <div className="bg-indigo-600 p-10 text-white relative">
                                        <div className="absolute top-0 right-0 p-12 opacity-10">
                                            <Key className="w-48 h-48 rotate-12" />
                                        </div>
                                        <h2 className="text-4xl font-black mb-2 italic">Connection Required</h2>
                                        <p className="text-indigo-100 font-medium">To enable automated data engineering, we need a Gemini API Key.</p>
                                    </div>
                                    <div className="p-10 space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Option 1: AI Studio */}
                                            {/* @ts-ignore */}
                                            {window.aistudio ? (
                                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-start">
                                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                                                        <Sparkles className="w-5 h-5" />
                                                    </div>
                                                    <h3 className="font-bold text-slate-800 mb-2">Native Connector</h3>
                                                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">You are in a supported AI Studio environment. Connect your paid API key directly.</p>
                                                    <button onClick={handleOpenKeyDialog} className="mt-auto w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                                                        <Key className="w-3 h-3" /> CONNECT NOW
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-start opacity-50">
                                                    <div className="w-10 h-10 bg-slate-200 text-slate-400 rounded-xl flex items-center justify-center mb-4">
                                                        <Sparkles className="w-5 h-5" />
                                                    </div>
                                                    <h3 className="font-bold text-slate-400 mb-2">Native Connector</h3>
                                                    <p className="text-xs text-slate-400 mb-2">Not available in this environment.</p>
                                                </div>
                                            )}

                                            {/* Option 2: Environment Variables */}
                                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-start">
                                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                                                    <Database className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-bold text-slate-800 mb-2">Cloud Environment</h3>
                                                <p className="text-xs text-slate-500 mb-6 leading-relaxed">Using Vercel or Netlify? Set your <code className="bg-slate-200 px-1 rounded">API_KEY</code> variable in the dashboard.</p>
                                                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-auto w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                                                    <ExternalLink className="w-3 h-3" /> GET API KEY
                                                </a>
                                            </div>
                                        </div>
                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                                Note: To use Gemini 3.0 Pro, Google requires a **Paid API Key** from a billing-enabled GCP project. Free-tier keys may cause connection errors in production environments.
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

                        {loadError && !needsKey ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-10">
                                <AlertTriangle className="w-20 h-20 text-red-500 mb-6" />
                                <h2 className="text-3xl font-black text-slate-800 mb-4 uppercase">System Error</h2>
                                <p className="text-slate-500 max-w-md mb-8">{loadError}</p>
                                <button onClick={() => activeProject && startEngineForProject(activeProject)} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5" /> RESTART ENGINE
                                </button>
                            </div>
                        ) : activeProject ? (
                            <Notebook 
                                project={activeProject} 
                                isInitializing={!isEngineReady} 
                                isSuggesting={isSuggesting} 
                                summary={summary} 
                                onUpdateCell={(id, content) => { const cells = activeProject.cells.map(c => c.id === id ? { ...c, content } : c); setActiveProject({ ...activeProject, cells }); }} 
                                onRunCell={handleRunCell} 
                                onDeleteCell={(id) => { const cells = activeProject.cells.filter(c => c.id !== id); setActiveProject({ ...activeProject, cells }); }} 
                                onAddCell={(type) => { const newCell: NotebookCell = { id: `cell_${Date.now()}`, type, content: '', isExecuting: false }; setActiveProject({ ...activeProject, cells: [...activeProject.cells, newCell] }); }} 
                                onGetSuggestion={() => startEngineForProject(activeProject, true)} 
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
