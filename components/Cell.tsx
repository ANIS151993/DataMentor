
import React, { useState, useEffect, useRef } from 'react';
import { NotebookCell } from '../types';
import { Play, Sparkles, Trash2, CheckCircle2, AlertCircle, Terminal, FileCode, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import DataTable from './DataTable';

interface CellProps {
    cell: NotebookCell;
    onRun: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, content: string) => void;
}

const Cell: React.FC<CellProps> = ({ cell, onRun, onDelete, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showOutput, setShowOutput] = useState(true);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    useEffect(() => {
        // Handle Chart.js rendering for Row 10 outputs
        if (cell.type === 'code' && cell.output && chartRef.current) {
            try {
                const data = JSON.parse(cell.output);
                if (data.chart_type && data.data) {
                    if (chartInstance.current) {
                        chartInstance.current.destroy();
                    }
                    // @ts-ignore (Chart is global from index.html)
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
            } catch (e) {
                // Not a chart JSON, ignore
            }
        }
    }, [cell.output]);

    const renderOutput = () => {
        if (!cell.output && !cell.error) return null;

        if (cell.error) {
            return (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-mono flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <pre className="whitespace-pre-wrap">{cell.error}</pre>
                </div>
            );
        }

        try {
            const data = JSON.parse(cell.output!);
            
            // Check if it's a chart config
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

            // Otherwise treat as Table data (Pyodide split orient)
            if (data.columns && data.data) {
                return <div className="mt-4"><DataTable data={data} /></div>;
            }
        } catch (e) {
            // Treat as raw text/stdout
            return (
                <div className="mt-4 p-4 bg-slate-900 rounded-xl text-indigo-300 text-xs font-mono overflow-x-auto shadow-xl">
                    <pre className="whitespace-pre-wrap">{cell.output}</pre>
                </div>
            );
        }
    };

    return (
        <div className={`group relative rounded-2xl border transition-all duration-300 ${cell.type === 'code' ? 'bg-white border-slate-200 hover:border-indigo-300' : 'bg-transparent border-transparent'}`}>
            {/* Cell Actions Overlay */}
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
                    {/* Rendered markdown preview when not focused could go here */}
                </div>
            ) : (
                <div className="flex flex-col">
                    {/* Code Editor Header */}
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
                    
                    {/* Code Editor Area */}
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

                    {/* Output Area */}
                    {showOutput && renderOutput()}
                </div>
            )}
        </div>
    );
};

export default Cell;
