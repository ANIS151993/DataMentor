
import React, { useState, useEffect, useRef } from 'react';
import { NotebookCell } from '../types';
import { Play, Sparkles, Trash2, AlertCircle, Terminal, BarChart3, ChevronDown, ChevronUp, Bot, Download, FileCheck, CheckCircle2 } from 'lucide-react';
import DataTable from './DataTable';
import Copilot from './Copilot';

interface CellProps {
    cell: NotebookCell;
    summary: any;
    onRun: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, content: string) => void;
    onExport?: (format: 'csv' | 'xlsx') => void;
}

const Cell: React.FC<CellProps> = ({ cell, summary, onRun, onDelete, onUpdate, onExport }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showOutput, setShowOutput] = useState(true);
    const [showCopilot, setShowCopilot] = useState(false);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    useEffect(() => {
        if (cell.error) {
            setShowCopilot(true);
        } else {
            setShowCopilot(false);
        }
    }, [cell.error]);

    useEffect(() => {
        if (cell.type === 'code' && cell.output && chartRef.current) {
            try {
                const data = JSON.parse(cell.output);
                if (data.chart_type && data.data) {
                    if (chartInstance.current) {
                        chartInstance.current.destroy();
                    }
                    
                    const isDoughnutOrPie = data.chart_type === 'doughnut' || data.chart_type === 'pie';
                    const indexAxis = data.options?.indexAxis || 'x';
                    const isStacked = !!data.options?.stacked;

                    // @ts-ignore
                    chartInstance.current = new Chart(chartRef.current, {
                        type: data.chart_type,
                        data: {
                            labels: Object.keys(data.data),
                            datasets: [{
                                label: data.label || 'Data Analysis',
                                data: Object.values(data.data),
                                backgroundColor: [
                                    'rgba(99, 102, 241, 0.7)',
                                    'rgba(168, 85, 247, 0.7)',
                                    'rgba(236, 72, 153, 0.7)',
                                    'rgba(249, 115, 22, 0.7)',
                                    'rgba(34, 197, 94, 0.7)',
                                    'rgba(20, 184, 166, 0.7)',
                                    'rgba(234, 179, 8, 0.7)',
                                    'rgba(239, 68, 68, 0.7)'
                                ],
                                borderColor: 'white',
                                borderWidth: 2,
                                borderRadius: isDoughnutOrPie ? 0 : 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            indexAxis: indexAxis,
                            plugins: {
                                legend: { 
                                    display: isDoughnutOrPie,
                                    position: 'bottom',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        font: { size: 11, weight: '600' }
                                    }
                                },
                                tooltip: {
                                    padding: 12,
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                    titleFont: { size: 13, weight: 'bold' },
                                    bodyFont: { size: 12 }
                                }
                            },
                            scales: isDoughnutOrPie ? {} : {
                                x: { stacked: isStacked, grid: { display: false } },
                                y: { stacked: isStacked, grid: { color: 'rgba(0,0,0,0.05)' } }
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("Chart build error:", e);
            }
        }
    }, [cell.output]);

    const renderOutput = () => {
        if (!cell.output && !cell.error) return null;

        if (cell.error) {
            return (
                <div className="mt-4 space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-mono flex items-start gap-3 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <div className="font-bold mb-1 uppercase tracking-wider flex items-center justify-between">
                                <span>Execution Error</span>
                                {!showCopilot && (
                                    <button 
                                        onClick={() => setShowCopilot(true)}
                                        className="text-[10px] flex items-center gap-1.5 px-2 py-0.5 bg-white border border-red-200 rounded hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    >
                                        <Bot className="w-3 h-3" /> ASK COPILOT
                                    </button>
                                )}
                            </div>
                            <pre className="whitespace-pre-wrap">{cell.error}</pre>
                        </div>
                    </div>
                    
                    {showCopilot && (
                        <Copilot 
                            code={cell.content} 
                            error={cell.error} 
                            summary={summary}
                            onApplyFix={(newCode) => {
                                onUpdate(cell.id, newCode);
                                setShowCopilot(false);
                            }}
                            onClose={() => setShowCopilot(false)}
                        />
                    )}
                </div>
            );
        }

        try {
            const data = JSON.parse(cell.output!);
            
            if (data.type === 'export_ready') {
                return (
                    <div className="mt-4 p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-2xl text-white flex flex-col items-center text-center animate-in fade-in zoom-in slide-in-from-bottom-8 duration-700">
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/30 shadow-inner">
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 tracking-tight">Cleaning Lab Success!</h3>
                        <p className="text-indigo-100 text-sm mb-8 max-w-sm leading-relaxed">
                            {data.message || "Your transformation workflow is complete. The dataset is polished and ready for download."}
                        </p>
                        
                        <div className="flex items-center gap-8 mb-10 text-xs font-bold uppercase tracking-[0.2em] opacity-90">
                            <div className="flex flex-col gap-1">
                                <span className="opacity-60 text-[10px]">Total Rows</span>
                                <span>{data.rows.toLocaleString()}</span>
                            </div>
                            <div className="w-px h-8 bg-white/20" />
                            <div className="flex flex-col gap-1">
                                <span className="opacity-60 text-[10px]">Columns</span>
                                <span>{data.cols}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4 w-full max-w-md">
                            <button 
                                onClick={() => onExport?.('csv')}
                                className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-white text-indigo-700 rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-xl hover:-translate-y-1 active:translate-y-0"
                            >
                                <Download className="w-5 h-5" /> DOWNLOAD CSV
                            </button>
                            <button 
                                onClick={() => onExport?.('xlsx')}
                                className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-indigo-500/50 text-white border border-indigo-400/50 backdrop-blur-sm rounded-2xl font-bold hover:bg-indigo-400/60 transition-all shadow-xl hover:-translate-y-1 active:translate-y-0"
                            >
                                <Download className="w-5 h-5" /> DOWNLOAD EXCEL
                            </button>
                        </div>
                    </div>
                );
            }

            if (data.chart_type && data.data) {
                return (
                    <div className="mt-4 p-6 bg-white border border-slate-100 rounded-xl shadow-inner">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-500" />
                                {data.label || 'Data Visualization'}
                            </h4>
                        </div>
                        <div className="h-[350px] w-full relative">
                            <canvas ref={chartRef}></canvas>
                        </div>
                    </div>
                );
            }
            if (data.columns && data.data) {
                return <div className="mt-4"><DataTable data={data} /></div>;
            }
        } catch (e) {
            return (
                <div className="mt-4 p-4 bg-slate-900 rounded-xl text-indigo-300 text-xs font-mono overflow-x-auto shadow-xl">
                    <pre className="whitespace-pre-wrap">{cell.output}</pre>
                </div>
            );
        }
    };

    return (
        <div className={`group relative rounded-2xl border transition-all duration-300 ${cell.type === 'code' ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md' : 'bg-transparent border-transparent'}`}>
            <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {cell.type === 'code' && (
                    <button 
                        onClick={() => onRun(cell.id)}
                        disabled={cell.isExecuting}
                        className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200 hover:scale-110 transition-transform disabled:bg-slate-300"
                    >
                        <Play className={`w-4 h-4 ${cell.isExecuting ? 'animate-pulse' : ''}`} />
                    </button>
                )}
                <button 
                    onClick={() => onDelete(cell.id)}
                    className="p-1.5 bg-white text-slate-400 hover:text-red-500 border border-slate-100 rounded-lg shadow-sm hover:scale-110 transition-transform"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {cell.type === 'markdown' ? (
                <div className="p-4 prose prose-slate max-w-none">
                    <textarea
                        className={`w-full bg-transparent border-none outline-none resize-none text-slate-700 placeholder:italic ${isEditing ? 'min-h-[100px] border-b border-indigo-100 mb-2' : ''}`}
                        value={cell.content}
                        onChange={(e) => onUpdate(cell.id, e.target.value)}
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setTimeout(() => setIsEditing(false), 200)}
                        placeholder="Add documentation or cleaning notes..."
                    />
                </div>
            ) : (
                <div className="flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            {cell.metadata?.isAI ? <Sparkles className="w-3 h-3 text-indigo-500" /> : <Terminal className="w-3 h-3" />}
                            <span>{cell.metadata?.isAI ? 'AI Suggested Transformation' : 'Python Workspace'}</span>
                        </div>
                        {cell.output && (
                             <button onClick={() => setShowOutput(!showOutput)} className="hover:text-indigo-500 flex items-center gap-1">
                                {showOutput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {showOutput ? 'Hide Results' : 'Show Results'}
                             </button>
                        )}
                    </div>
                    
                    <div className="p-4 bg-slate-50/30">
                        <textarea
                            className="w-full bg-transparent code-font text-sm text-slate-800 outline-none resize-none min-h-[80px]"
                            spellCheck={false}
                            value={cell.content}
                            onChange={(e) => onUpdate(cell.id, e.target.value)}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                            }}
                        />
                    </div>
                    {showOutput && renderOutput()}
                </div>
            )}
        </div>
    );
};

export default Cell;
