
export type CellType = 'code' | 'markdown';

export interface NotebookCell {
  id: string;
  type: CellType;
  content: string;
  output?: string;
  error?: string;
  isExecuting?: boolean;
  metadata?: {
    isAI?: boolean;
    suggestion?: string;
  };
}

export interface DatasetMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  rowCount?: number;
  columnCount?: number;
}

export interface Project {
  id: string;
  name: string;
  datasetId: string;
  cells: NotebookCell[];
  createdAt: number;
}

export interface User {
  email: string;
  id: string;
}

export interface TableData {
  columns: string[];
  data: any[][];
}
