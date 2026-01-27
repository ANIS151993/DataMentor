
import { PYODIDE_INIT_CODE } from '../constants';

class PyodideService {
  private pyodide: any = null;
  private isLoaded = false;

  async init() {
    if (this.isLoaded) return;
    
    try {
      // @ts-ignore
      this.pyodide = await loadPyodide();
      await this.pyodide.loadPackage(['pandas', 'micropip']);
      
      await this.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('openpyxl')
      `);
      
      await this.pyodide.runPythonAsync(PYODIDE_INIT_CODE);
      this.isLoaded = true;
    } catch (err) {
      console.error("Pyodide initialization failed:", err);
      throw err;
    }
  }

  async loadFile(blob: Blob, fileName: string) {
    const buffer = await blob.arrayBuffer();
    this.pyodide.FS.writeFile(fileName, new Uint8Array(buffer));
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    let code = '';
    if (extension === 'csv') {
      code = `df = pd.read_csv('${fileName}')\n_df_orig = df.copy()`;
    } else if (extension === 'xlsx' || extension === 'xls') {
      code = `df = pd.read_excel('${fileName}')\n_df_orig = df.copy()`;
    }
    
    await this.pyodide.runPythonAsync(code);
  }

  async runCode(code: string): Promise<{ result: any; stdout: string; error?: string }> {
    try {
      await this.pyodide.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
      `);
      
      const result = await this.pyodide.runPythonAsync(code);
      const stdout = await this.pyodide.runPythonAsync('sys.stdout.getvalue()');
      
      return { result, stdout };
    } catch (err: any) {
      return { result: null, stdout: '', error: err.message };
    }
  }

  async getDatasetSummary() {
      const summaryJson = await this.pyodide.runPythonAsync('json.dumps(get_df_summary(df))');
      return JSON.parse(summaryJson);
  }

  async getFullData(): Promise<any[]> {
      const jsonStr = await this.pyodide.runPythonAsync('df.to_json(orient="records")');
      return JSON.parse(jsonStr);
  }

  async exportData(format: 'csv' | 'xlsx'): Promise<Uint8Array> {
      if (format === 'csv') {
          await this.pyodide.runPythonAsync('df.to_csv("export.csv", index=False)');
          return this.pyodide.FS.readFile('export.csv');
      } else {
          await this.pyodide.runPythonAsync('df.to_excel("export.xlsx", index=False)');
          return this.pyodide.FS.readFile('export.xlsx');
      }
  }
}

export const pyEngine = new PyodideService();
