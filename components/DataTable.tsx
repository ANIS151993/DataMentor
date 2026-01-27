
import React from 'react';

interface DataTableProps {
    data: any; // Pyodide 'split' orient JSON
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
    if (!data || !data.columns) return <div className="p-4 text-slate-400 italic">No data to display</div>;

    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm max-h-[400px]">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 sticky top-0">
                    <tr>
                        {data.columns.map((col: string) => (
                            <th key={col} className="px-4 py-2 text-left font-semibold text-slate-700 uppercase tracking-wider">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {data.data.map((row: any[], i: number) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                            {row.map((val: any, j: number) => (
                                <td key={j} className="px-4 py-2 whitespace-nowrap text-slate-600 border-r border-slate-100 last:border-0">
                                    {String(val)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;
