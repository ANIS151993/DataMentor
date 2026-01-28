
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
import { LogOut, Upload, FileText, Loader2, Sparkles, Database, CloudOff, AlertTriangle, RefreshCw, X, Key } from 'lucide-react';

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
    const [isFixingMissingFile, setIsFixingMissingFile] = useState(false);
    const [isKeyChecking, setIsKeyChecking] = useState(true);
    const [needsKey, setNeedsKey] = useState(false);

    // AI Key Check logic to handle missing process.env.API_KEY in browser
    useEffect(() => {
        const checkApiKey = async () => {
            if (process.env.API_KEY) {
                setNeedsKey(false);
                setIsKeyChecking(false);
                return;
            }

            // @ts-ignore
            if (window.aistudio) {
                // @ts-ignore
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setNeedsKey(!hasKey);
            } else {
                setNeedsKey(!process.env.API_KEY);
            }
            setIsKeyChecking(false);
        };
        checkApiKey();
    }, []);

    const handleOpenKeyDialog = async () => {
        // @ts-ignore
        if (window.aistudio) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            setNeedsKey(false);
            setLoadError(null); // Clear errors after potentially fixing the key
            if (activeProject) startEngineForProject(activeProject);
        } else {
            alert("This environment requires an API_KEY environment variable or the AI Studio key selector.");
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
                if (result.recoveredDatasetId && result.recoveredDatasetId !== project.datasetId) {
                    setAutoProgressMsg('Self-healing project pathing...');
                    const healedProject = { ...project, datasetId: result.recoveredDatasetId };
                    await storage.saveProject(healedProject);
                    setActiveProject(healedProject);
                    await loadProjects();
                }

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
                throw new Error(`The lab data source "${project.name}" is missing or unreachable.`);
            }
        } catch (err: any) {
            console.error("Startup Failure:", err);
            // Detect if the error is due to missing API Key
            if (err.message.includes("API Key") || err.message.includes("key") || err.message.includes("found")) {
                setNeedsKey(true);
            }
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

    const handleDeleteProject = async (id: string) => {
        const p = projects.find(proj => proj.id === id);
        if (!p || !window.confirm(`PERMANENTLY ERASE LAB "${p.name}"?`)) return;

        if (activeProject?.id === id) { 
            setActiveProject(null); 
            setSummary(null); 
            setIsEngineReady(false); 
        }
        setProjects(prev => prev.filter(proj => proj.id !== id));

        try {
            setAutoProgressMsg('Decommissioning data assets...');
            await storage.deleteProject(id, p.datasetId);
            await loadProjects();
        } catch (err: any) { 
            alert("Deletion Error: " + err.message); 
            await loadProjects();
        }
        finally { setAutoProgressMsg(''); }
    };

    const handleNewProject = async (file: File) => {
        if (isUploading) return;
        setIsUploading(true);

        if (isFixingMissingFile && activeProject) {
            const newDatasetId = `data_${Date.now()}`;
            setAutoProgressMsg(`Recovering project using ${file.name}...`);
            try {
                await storage.saveDataset(newDatasetId, file, file.name);
                const updated = { ...activeProject, datasetId: newDatasetId, name: file.name };
                await storage.saveProject(updated);
                await loadProjects();
                setActiveProject(updated);
                setIsFixingMissingFile(false);
                setShowUpload(false);
                await startEngineForProject(updated, false);
            } catch (err: any) {
                alert("Recovery failed: " + err.message);
            } finally {
                setIsUploading(false);
            }
            return;
        }

        const projectId = `proj_${Date.now()}`;
        const datasetId = `data_${Date.now()}`;
        try {
            setAutoProgressMsg('Synchronizing binary to cloud repository...');
            await storage.saveDataset(datasetId, file, file.name);
            const newProject: Project = { id: projectId, name: file.name, datasetId, cells: [], createdAt: Date.now() };
            await storage.saveProject(newProject);
            await loadProjects();
            setShowUpload(false);
            setActiveProject(newProject);
            await startEngineForProject(newProject, true);
        } catch (err: any) { alert("Import failed: " + err.message); }
        finally { setIsUploading(false); }
    };

    const handleSaveCleanedToCloud = async () => {
        if (!activeProject || !summary) return;
        if (!window.confirm("Overwrite existing cloud master?")) return;
        
        setAutoProgressMsg('Syncing cleaned master...');
        try {
            const format = activeProject.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
            const blob = await pyEngine.getDfBlob(format);
            const fileName = `cleaned_${activeProject.name}`;
            
            await storage.saveDataset(activeProject.datasetId, blob, fileName);
            const updated = { ...activeProject, name: fileName };
            setActiveProject(updated);
            await storage.saveProject(updated);
            await loadProjects();
            
            alert("Transformed version stored in Cloud.");
        } catch (err: any) {
            alert("Cloud sync failure: " + err.message);
        } finally {
            setAutoProgressMsg('');
        }
    };

    const handleRunCell = async (cellId: string) => {
        if (!activeProject) return;
        const cellIndex = activeProject.cells.findIndex(c => c.id === cellId);
        const cells = [...activeProject.cells];
        const cell = { ...cells[cellIndex], isExecuting: true, error: undefined, output: undefined };
        cells[cellIndex] = cell;
        setActiveProject({ ...activeProject, cells });

        const { stdout, error } = await pyEngine.runCode(cell.content);
        let finalOutput = stdout;
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const pj = JSON.parse(jsonMatch[0]);
                if ((pj.chart_type && pj.data) || pj.type === 'export_ready') finalOutput = jsonMatch[0];
            } catch (e) {}
        }

        const updatedCell = { ...cell, isExecuting: false, output: finalOutput, error };
        cells[cellIndex] = updatedCell;
        const updatedProject = { ...activeProject, cells };
        setActiveProject(updatedProject);
        await storage.saveProject(updatedProject);
        
        const modificationRegex = /(df\s*(\[|\.|=)|drop\(|fillna\(|replace\(|apply\(|str\.|rename\(|astype\(|map\()/;
        if (cell.content.match(modificationRegex)) {
            const currentSummary = await pyEngine.getDatasetSummary();
            setSummary(currentSummary);
        }
    };

    if (isKeyChecking) {
        return (
            <div className="flex h-screen bg-slate-900 items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-inter">
            {!user ? ( <Auth onAuthSuccess={(u) => setUser({ email: u.email, id: u.id })} /> ) : (
                <>
                    <Sidebar projects={projects} activeProjectId={activeProject?.id || null} onSelectProject={handleSelectProject} onDeleteProject={handleDeleteProject} onNewProject={() => { setShowUpload(true); setLoadError(null); setIsFixingMissingFile(false); }} summary={summary} />
                    <main className="flex-1 relative">
                        {/* Status Badges */}
                        <div className="absolute top-4 right-20 z-40 flex items-center gap-2">
                            {needsKey ? (
                                <button onClick={handleOpenKeyDialog} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-full text-[10px] font-black shadow-sm hover:bg-red-100 transition-colors">
                                    <Key className="w-3 h-3" /> AI DISCONNECTED
                                </button>
                            ) : isLocalMode ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-full text-[10px] font-black shadow-sm">
                                    <CloudOff className="w-3 h-3" /> LOCAL ONLY
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-[10px] font-black shadow-sm">
                                    <Database className="w-3 h-3" /> CLOUD ACTIVE
                                </div>
                            )}
                        </div>

                        {/* Progress Overlay */}
                        {autoProgressMsg && (
                            <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
                                <div className="p-12 rounded-[2.5rem] bg-white shadow-2xl border border-slate-100 flex flex-col items-center gap-6 max-w-sm text-center">
                                    <div className="relative">
                                        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                                        <Sparkles className="absolute -top-1 -right-1 w-8 h-8 text-indigo-400 animate-bounce" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight italic">Engine Processing...</h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">{autoProgressMsg}</p>
                                </div>
                            </div>
                        )}

                        {/* Upload Modal */}
                        {showUpload && (
                            <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                                <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                            {isFixingMissingFile ? 'Repair Missing Connection' : 'Initialize New Lab'}
                                        </h3>
                                        <button onClick={() => { setShowUpload(false); setIsFixingMissingFile(false); }} className="text-slate-400 hover:text-slate-900 p-2">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className={`border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-indigo-300 transition-colors cursor-pointer group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => !isUploading && document.getElementById('fileInput')?.click()}>
                                        <input id="fileInput" type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleNewProject(e.target.files[0])} />
                                        {isUploading ? <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto" /> : <Upload className="w-16 h-16 text-slate-300 mx-auto mb-6 group-hover:text-indigo-400" />}
                                        <p className="text-base font-bold text-slate-700">
                                            {isFixingMissingFile ? 'Re-upload Source Dataset' : 'Select Source Dataset'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-3 uppercase font-black tracking-widest">
                                            {isFixingMissingFile ? 'Links this lab back to a physical file' : 'Syncs to Local and Supabase Cloud'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Boundary */}
                        {loadError ? (
                            <div className="flex-1 flex flex-col items-center justify-center h-full p-10 text-center animate-in zoom-in-95 duration-500">
                                <div className="w-28 h-28 bg-red-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-red-100 shadow-inner">
                                    <AlertTriangle className="w-14 h-14 text-red-500" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter uppercase">Startup Blocked</h2>
                                <p className="text-slate-500 max-w-md mb-12 leading-relaxed font-medium text-lg">
                                    {loadError.includes("API Key") ? "A Gemini API Key is required to power the Data Engineering AI." : loadError}
                                </p>
                                <div className="flex flex-wrap justify-center gap-5">
                                    {needsKey ? (
                                        <button onClick={handleOpenKeyDialog} className="flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                                            <Key className="w-6 h-6" /> CONNECT GEMINI API
                                        </button>
                                    ) : (
                                        <button onClick={() => activeProject && startEngineForProject(activeProject)} className="flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                                            <RefreshCw className="w-6 h-6" /> AGGRESSIVE SYNC
                                        </button>
                                    )}
                                    <button onClick={() => { setIsFixingMissingFile(true); setShowUpload(true); }} className="px-10 py-5 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] font-bold shadow-sm hover:bg-slate-50 transition-all">FIX BY RE-UPLOAD</button>
                                    <button onClick={() => activeProject && handleDeleteProject(activeProject.id)} className="px-10 py-5 bg-slate-100 text-slate-400 rounded-[1.5rem] font-bold hover:bg-red-50 hover:text-red-500 transition-all">ABANDON LAB</button>
                                </div>
                                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-8 text-[10px] text-slate-400 underline font-bold uppercase tracking-widest">Billing & Key Documentation</a>
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
                                onExport={async (format) => { try { const bytes = await pyEngine.exportData(format); const blob = new Blob([bytes], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `cleaned_${activeProject.name.replace(/\.[^/.]+$/, "")}.${format}`; a.click(); } catch (e: any) { alert("Export failed"); } }} 
                                onSave={() => storage.saveProject(activeProject)} 
                                onDeleteProject={handleDeleteProject} 
                                onSaveCleanedToCloud={handleSaveCleanedToCloud}
                                onOpenDashboard={async () => { setDashboardData([]); setShowDashboard(true); try { const fullData = await pyEngine.getFullData(); setDashboardData(fullData); } catch (err) { console.error("Dashboard failed"); } }} 
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400">
                                <div className="p-20 border-2 border-dashed border-slate-200 rounded-[4rem] text-center max-w-lg bg-white shadow-2xl shadow-slate-200/50">
                                    <div className="w-32 h-32 bg-indigo-50 rounded-[3rem] flex items-center justify-center mb-10 mx-auto hover:rotate-6 transition-transform">
                                        <Database className="w-16 h-16 text-indigo-400" />
                                    </div>
                                    <h3 className="text-slate-800 text-3xl font-black mb-4 tracking-tighter">Workspace Idle</h3>
                                    <p className="text-base mb-12 text-slate-500 leading-relaxed px-10">Select an existing transformation lab or upload a raw file to initiate AI-powered Pandas engineering.</p>
                                    <button onClick={() => setShowUpload(true)} className="w-full px-12 py-6 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-200 font-bold hover:bg-indigo-700 hover:-translate-y-1 transition-all active:translate-y-0 tracking-[0.15em] text-xs uppercase">START NEW WORKSPACE</button>
                                </div>
                            </div>
                        )}
                        <button onClick={() => supabase.auth.signOut()} className="absolute bottom-6 right-6 p-4 bg-white border border-slate-200 rounded-full shadow-2xl text-slate-400 hover:text-red-500 transition-all hover:scale-110" title="Exit Laboratory">
                            <LogOut className="w-7 h-7" />
                        </button>
                    </main>
                    {showDashboard && activeProject && <Dashboard filename={activeProject.name} data={dashboardData} onClose={() => setShowDashboard(false)} />}
                </>
            )}
        </div>
    );
};

export default App;
