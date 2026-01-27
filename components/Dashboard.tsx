
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Filter, RefreshCcw, LayoutDashboard, Database, TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

interface DashboardProps {
    filename: string;
    data: any[];
    onClose: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ filename, data, onClose }) => {
    const [filters, setFilters] = useState<Record<string, string>>({});
    const chartRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
    const chartInstances = useRef<Record<string, any>>({});

    const categoricalCols = useMemo(() => {
        if (!data || !data.length || !data[0]) return [];
        return Object.keys(data[0]).filter(col => {
            const val = data[0][col];
            return typeof val === 'string' || typeof val === 'boolean';
        }).slice(0, 7); // Limit to top 7 for filter clarity
    }, [data]);

    const filterOptions = useMemo(() => {
        const options: Record<string, string[]> = {};
        categoricalCols.forEach(col => {
            options[col] = Array.from(new Set(data.map(d => String(d[col])))).filter(v => v !== 'null' && v !== 'undefined') as string[];
        });
        return options;
    }, [data, categoricalCols]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            return Object.entries(filters).every(([col, val]) => {
                if (!val || val === 'All') return true;
                return String(item[col]) === val;
            });
        });
    }, [data, filters]);

    const resetFilters = () => setFilters({});

    useEffect(() => {
        if (!data || data.length === 0 || !data[0]) return;

        // Cleanup existing charts
        Object.values(chartInstances.current).forEach(chart => (chart as any)?.destroy());
        chartInstances.current = {};

        const createChart = (id: string, type: string, labels: string[], values: number[], title: string, options: any = {}) => {
            const canvas = chartRefs.current[id];
            if (!canvas) return;

            // @ts-ignore
            chartInstances.current[id] = new Chart(canvas, {
                type,
                data: {
                    labels,
                    datasets: [{
                        label: title,
                        data: values,
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.7)', 'rgba(168, 85, 247, 0.7)',
                            'rgba(236, 72, 153, 0.7)', 'rgba(249, 115, 22, 0.7)',
                            'rgba(34, 197, 94, 0.7)', 'rgba(20, 184, 166, 0.7)'
                        ],
                        borderWidth: 0,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: type === 'pie' || type === 'doughnut', position: 'bottom' },
                        title: { display: true, text: title, font: { size: 14, weight: 'bold' } }
                    },
                    ...options
                }
            });
        };

        // Aggregations
        const counts = (col: string) => {
            const acc: Record<string, number> = {};
            filteredData.forEach(d => {
                const key = String(d[col]);
                acc[key] = (acc[key] || 0) + 1;
            });
            return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 8);
        };

        // 1. Fraud vs Legit (Mocking 'fraudulent' column if exists, or just first categorical)
        const fraudCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('fraud')) || categoricalCols[0];
        if (fraudCol) {
            const fraudData = counts(fraudCol);
            createChart('fraud', 'doughnut', fraudData.map(d => d[0]), fraudData.map(d => d[1]), `Distribution: ${fraudCol}`);
        }

        // 2. Top Industries (Mocking 'industry' or second categorical)
        const indCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('indus')) || categoricalCols[1];
        if (indCol) {
            const indData = counts(indCol);
            createChart('industries', 'bar', indData.map(d => d[0]), indData.map(d => d[1]), `Top Categories: ${indCol}`, { indexAxis: 'y' });
        }

        // 3. Employment Type
        const empCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('employ')) || categoricalCols[2];
        if (empCol) {
            const empData = counts(empCol);
            createChart('employment', 'bar', empData.map(d => d[0]), empData.map(d => d[1]), `${empCol} Analysis`);
        }

        // 4. Missingness Simulation
        const missingLabels = Object.keys(data[0]).slice(0, 8);
        const missingValues = missingLabels.map(l => data.filter(d => d[l] === null || d[l] === '').length);
        createChart('missingness', 'bar', missingLabels, missingValues, 'Missingness (Top Columns)', { indexAxis: 'y' });

        // 5. Telecommuting
        const teleCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('tele')) || categoricalCols[3];
        if (teleCol) {
            const teleData = counts(teleCol);
            createChart('telecommuting', 'pie', teleData.map(d => d[0]), teleData.map(d => d[1]), `${teleCol} Breakdown`);
        }

    }, [filteredData, data, categoricalCols]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">
                            {filename} <span className="text-slate-400 font-normal">| Chart.js Proof of Concept</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Insights Engine POC</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800">
                    <X className="w-6 h-6" />
                </button>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Filters Sidebar */}
                <aside className="w-72 border-r border-slate-200 bg-white p-6 overflow-y-auto shrink-0 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Filters
                        </h2>
                        <button onClick={resetFilters} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                            <RefreshCcw className="w-3 h-3" /> RESET
                        </button>
                    </div>

                    <div className="space-y-4">
                        {categoricalCols.map(col => (
                            <div key={col} className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col}</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={filters[col] || 'All'}
                                    onChange={(e) => setFilters(prev => ({ ...prev, [col]: e.target.value }))}
                                >
                                    <option>All</option>
                                    {filterOptions[col]?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="mt-auto p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-900">Summary</span>
                        </div>
                        <div className="text-2xl font-black text-indigo-600 leading-none">
                            {filteredData.length.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-400 uppercase mt-1">Matched Rows</div>
                    </div>
                </aside>

                {/* Main Dashboard Area */}
                <main className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
                    {data.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Database className="w-16 h-16 mb-4 opacity-10 animate-pulse" />
                            <p className="text-lg font-medium">Loading analysis data...</p>
                        </div>
                    ) : (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Key Stats */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-slate-800">{filteredData.length}</div>
                                        <div className="text-xs font-medium text-slate-400">Total Samples</div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                        <BarChart3 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-slate-800">{Object.keys(data[0] || {}).length}</div>
                                        <div className="text-xs font-medium text-slate-400">Cleaned Columns</div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                                        <PieChartIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-slate-800">{data.length > 0 ? Math.round((filteredData.length / data.length) * 100) : 0}%</div>
                                        <div className="text-xs font-medium text-slate-400">Filter Coverage</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Charts */}
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
                                    <canvas ref={el => chartRefs.current.fraud = el}></canvas>
                                </div>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
                                    <canvas ref={el => chartRefs.current.industries = el}></canvas>
                                </div>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
                                    <canvas ref={el => chartRefs.current.employment = el}></canvas>
                                </div>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
                                    <canvas ref={el => chartRefs.current.missingness = el}></canvas>
                                </div>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] lg:col-span-2">
                                    <canvas ref={el => chartRefs.current.telecommuting = el}></canvas>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
