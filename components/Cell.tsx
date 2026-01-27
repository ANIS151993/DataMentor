
import React, { useState, useEffect, useRef } from 'react';
import { NotebookCell } from '../types';
import { Play, Sparkles, Trash2, AlertCircle, Terminal, BarChart3, ChevronDown, ChevronUp, Bot, Download, FileCheck } from 'lucide-react';
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

    // Automatically show Copilot when an error appears
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
                    // @ts-ignore
                    chartInstance.current = new Chart(chartRef.current, {
                        type: data.chart_type,
                        data: {
                            labels: Object.keys(data.data),
                            datasets: [{
                                label: data.label || 'Cleaned Data Distribution',
                                data: Object.values(data.data),
                                backgroundColor: [
                                    'rgba(99, 102, 241, 0.5)',
                                    'rgba(168, 85, 247, 0.5)',
                                    'rgba(236, 72, 153, 0.5)',
                                    'rgba(249, 115, 22, 0.5)',
                                    'rgba(34, 197, 94, 0.5)'
                                ],
                                borderColor: 'white',
                                borderWidth: 2
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            }
                        }
                    });
                }
            } catch (e) {}
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
            
            // Special Export Readiness View
            if (data.type === 'export_ready') {
                return (
                    <div className="mt-4 p-8 bg-indigo-600 rounded-2xl shadow-xl text-white flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                            <FileCheck className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Dataset Ready for Export</h3>
                        <p className="text-indigo-100 text-sm mb-6 max-w-sm">
                            {data.message || "Your cleaning workflow is finished. You can now download the final polished file."}
                        </p>
                        <div className="flex items-center gap-6 mb-8 text-xs font-bold uppercase tracking-widest opacity-80">
                            <div>Rows: {data.rows}</div>
                            <div className="w-px h-3 bg-white/30" />
                            <div>Cols: {data.cols}</div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                            <button 
                                onClick={() => onExport?.('csv')}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-lg shadow-indigo-900/20"
                            >
                                <Download className="w-4 h-4" /> DOWNLOAD CSV
                            </button>
                            <button 
                                onClick={() => onExport?.('xlsx')}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white border border-indigo-400 rounded-xl font-bold hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-900/20"
                            >
                                <Download className="w-4 h-4" /> DOWNLOAD EXCEL
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
                                Interactive Visualization
                            </h4>
                        </div>
                        <div className="h-[300px] w-full relative">
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
                        placeholder="Add some documentation or analysis notes..."
                    />
                </div>
            ) : (
                <div className="flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            {cell.metadata?.isAI ? <Sparkles className="w-3 h-3 text-indigo-500" /> : <Terminal className="w-3 h-3" />}
                            <span>{cell.metadata?.isAI ? 'AI Suggested Code' : 'User Python Cell'}</span>
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
