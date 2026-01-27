
import React, { useState, useEffect, useCallback } from 'react';
import { User, Project, NotebookCell } from './types';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Notebook from './components/Notebook';
import Dashboard from './components/Dashboard';
import { storage } from './services/storageService';
import { pyEngine } from './services/pyodideService';
import { aiMentor } from './services/geminiService';
import { LogOut, Upload, FileText } from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [isEngineReady, setIsEngineReady] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [dashboardData, setDashboardData] = useState<any[]>([]);

    // Secure local-only hashing
    const hashPassword = async (password: string) => {
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    useEffect(() => {
        const init = async () => {
            await storage.init();
            const storedUser = localStorage.getItem('dataMentor_user');
            if (storedUser) setUser(JSON.parse(storedUser));
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

    const startEngineForProject = async (project: Project) => {
        setIsEngineReady(false);
        try {
            await pyEngine.init();
            const dataset = await storage.getDataset(project.datasetId);
            if (dataset) {
                await pyEngine.loadFile(dataset.data, dataset.name);
                for (const cell of project.cells) {
                    if (cell.type === 'code' && cell.content.trim()) {
                        await pyEngine.runCode(cell.content);
                    }
                }
                const currentSummary = await pyEngine.getDatasetSummary();
                setSummary(currentSummary);
            }
            setIsEngineReady(true);
        } catch (err) {
            console.error("Engine failed:", err);
        }
    };

    const handleSelectProject = async (id: string) => {
        const p = await storage.getProject(id);
        if (p) {
            setActiveProject(p);
            await startEngineForProject(p);
        }
    };

    const handleNewProject = (file: File) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const datasetId = `ds_${Date.now()}`;
            await storage.saveDataset(datasetId, file);
            const newProject: Project = {
                id: `proj_${Date.now()}`,
                name: file.name,
                datasetId: datasetId,
                cells: [],
                createdAt: Date.now()
            };
            await storage.saveProject(newProject);
            await loadProjects();
            handleSelectProject(newProject.id);
            setShowUpload(false);
        };
        reader.readAsArrayBuffer(file);
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
        const codeLines = cell.content.trim().split('\n');
        const lastLine = codeLines[codeLines.length - 1];

        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        let capturedChart = false;
        if (jsonMatch) {
            try {
                const potentialJson = JSON.parse(jsonMatch[0]);
                if (potentialJson.chart_type && potentialJson.data) {
                    finalOutput = jsonMatch[0];
                    capturedChart = true;
                } else if (potentialJson.type === 'export_ready') {
                    finalOutput = jsonMatch[0];
                    capturedChart = true;
                }
            } catch (e) {}
        }

        if (!capturedChart && lastLine && (lastLine.includes('df') || lastLine.includes('head(') || lastLine.includes('describe('))) {
            const currentSummary = await pyEngine.getDatasetSummary();
            finalOutput = JSON.stringify(currentSummary.sample ? JSON.parse(currentSummary.sample) : stdout);
            setSummary(currentSummary);
        }

        cells[cellIndex] = { ...cell, isExecuting: false, output: finalOutput, error };
        const updatedProject = { ...activeProject, cells };
        setActiveProject(updatedProject);
        await storage.saveProject(updatedProject);
    };

    const handleGeneratePlan = async () => {
        if (!activeProject || !summary) return;
        setIsSuggesting(true);
        try {
            const plan = await aiMentor.generateFullPlan(summary);
            const newCells: NotebookCell[] = [{
                id: `cell_header_${Date.now()}`,
                type: 'markdown',
                content: `# ${plan.plan_title}\n\nI have analyzed your dataset and mapped out a strict 10-row workflow to prepare it for analysis.`,
                metadata: { isAI: true }
            }];

            plan.steps.forEach((step, idx) => {
                newCells.push({
                    id: `cell_md_${idx}_${Date.now()}`,
                    type: 'markdown',
                    content: `## ${step.step_name}\n${step.explanation}`,
                    metadata: { isAI: true }
                });
                newCells.push({
                    id: `cell_code_${idx}_${Date.now()}`,
                    type: 'code',
                    content: step.code,
                    metadata: { isAI: true }
                });
            });

            const updated = { ...activeProject, cells: [...activeProject.cells, ...newCells] };
            setActiveProject(updated);
            await storage.saveProject(updated);
        } catch (err) { console.error(err); } finally { setIsSuggesting(false); }
    };

    const handleAddCell = (type: 'code' | 'markdown') => {
        if (!activeProject) return;
        const newCell: NotebookCell = { id: `cell_${Date.now()}`, type, content: '', isExecuting: false };
        const updated = { ...activeProject, cells: [...activeProject.cells, newCell] };
        setActiveProject(updated);
    };

    const handleOpenDashboard = async () => {
        if (!activeProject) return;
        const data = await pyEngine.getFullData();
        setDashboardData(data);
        setShowDashboard(true);
    };

    return (
        <div className="flex h-screen bg-slate-50">
            {!user ? (
                <Auth 
                    onLogin={async (e, p) => {
                        const stored = await storage.getUser(e);
                        const hashed = await hashPassword(p);
                        if (stored && stored.passwordHash === hashed) {
                            setUser(stored);
                            localStorage.setItem('dataMentor_user', JSON.stringify(stored));
                            return true;
                        }
                        return false;
                    }}
                    onSignup={async (e, p) => {
                        const existing = await storage.getUser(e);
                        if (existing) return false;
                        const hashed = await hashPassword(p);
                        const newUser = { email: e, id: `user_${Date.now()}` };
                        await storage.saveUser(newUser, hashed);
                        setUser(newUser);
                        localStorage.setItem('dataMentor_user', JSON.stringify(newUser));
                        return true;
                    }}
                />
            ) : (
                <>
                    <Sidebar 
                        projects={projects}
                        activeProjectId={activeProject?.id || null}
                        onSelectProject={handleSelectProject}
                        onDeleteProject={async (id) => {
                            await storage.deleteProject(id);
                            loadProjects();
                            if (activeProject?.id === id) setActiveProject(null);
                        }}
                        onNewProject={() => setShowUpload(true)}
                        summary={summary}
                    />
                    <main className="flex-1 relative">
                        {showUpload && (
                            <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                                <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-slate-800">New Data Project</h3>
                                        <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600">×</button>
                                    </div>
                                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-indigo-300 transition-colors cursor-pointer group" onClick={() => document.getElementById('fileInput')?.click()}>
                                        <input id="fileInput" type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleNewProject(e.target.files[0])} />
                                        <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4 group-hover:text-indigo-400 transition-colors" />
                                        <p className="text-sm font-medium text-slate-600">Drag and drop or click to upload</p>
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
                                onUpdateCell={(id, content) => {
                                    const cells = activeProject.cells.map(c => c.id === id ? { ...c, content } : c);
                                    setActiveProject({ ...activeProject, cells });
                                }}
                                onRunCell={handleRunCell}
                                onDeleteCell={(id) => {
                                    const cells = activeProject.cells.filter(c => c.id !== id);
                                    setActiveProject({ ...activeProject, cells });
                                }}
                                onAddCell={handleAddCell}
                                onGetSuggestion={handleGeneratePlan}
                                onExport={async (format) => {
                                    const bytes = await pyEngine.exportData(format);
                                    const blob = new Blob([bytes], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `cleaned_${activeProject.name}.${format}`;
                                    a.click();
                                }}
                                onSave={() => storage.saveProject(activeProject)}
                                onOpenDashboard={handleOpenDashboard}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400">
                                <FileText className="w-16 h-16 mb-4 opacity-10" />
                                <p className="text-lg font-medium">Select a project or upload a dataset to begin</p>
                                <button onClick={() => setShowUpload(true)} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                                    UPLOAD DATASET
                                </button>
                            </div>
                        )}
                        <button onClick={() => { localStorage.removeItem('dataMentor_user'); setUser(null); }} className="absolute bottom-6 right-6 p-3 bg-white border border-slate-200 rounded-full shadow-lg text-slate-400 hover:text-red-500 hover:border-red-100 transition-all">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </main>

                    {showDashboard && activeProject && (
                        <Dashboard 
                            filename={activeProject.name} 
                            data={dashboardData} 
                            onClose={() => setShowDashboard(false)} 
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default App;
