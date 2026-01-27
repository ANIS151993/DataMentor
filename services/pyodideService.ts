
import { PYODIDE_INIT_CODE } from '../constants';

class PyodideService {
  private pyodide: any = null;
  private isLoaded = false;
  private isInitializing = false;
  private readonly INTERNAL_PATH = '/mnt/data_source';

  async init() {
    if (this.isLoaded) return;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(r => setTimeout(r, 500));
      }
      return;
    }

    this.isInitializing = true;
    try {
      // @ts-ignore
      this.pyodide = await loadPyodide();
      await this.pyodide.loadPackage(['pandas', 'micropip', 'numpy']);
      
      await this.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('openpyxl')
        import os
        if not os.path.exists('/mnt'):
            os.makedirs('/mnt', exist_ok=True)
      `);
      
      await this.pyodide.runPythonAsync(PYODIDE_INIT_CODE);
      this.isLoaded = true;
    } catch (err) {
      console.error("Pyodide initialization failed:", err);
      throw err;
    } finally {
      this.isInitializing = false;
    }
  }

  async loadFile(blob: Blob, fileName: string) {
    if (!this.pyodide) await this.init();
    if (!blob) throw new Error("Dataset binary data is missing.");
    
    try {
        const buffer = await blob.arrayBuffer();
        
        await this.pyodide.runPythonAsync(`
import os
import pandas as pd
import numpy as np
import re
import html
if not os.path.exists('/mnt'):
    os.makedirs('/mnt', exist_ok=True)
globals()['pd'] = pd
globals()['np'] = np
globals()['re'] = re
globals()['html'] = html
        `);

        this.pyodide.FS.writeFile(this.INTERNAL_PATH, new Uint8Array(buffer));
        
        const extension = fileName.split('.').pop()?.toLowerCase();
        const safeFileName = fileName.replace(/['"\\\b\f\n\r\t]/g, '');

        let pythonCode = `
import pandas as pd
import numpy as np
import os

path = '${this.INTERNAL_PATH}'

if not os.path.exists(path):
    raise FileNotFoundError(f"Python engine virtual filesystem failure: Missing file at {path}")

try:
    if '${extension}' in ['xlsx', 'xls']:
        df = pd.read_excel(path)
    else:
        try:
            df = pd.read_csv(path)
        except:
            df = pd.read_csv(path, encoding='latin1')
except Exception as e:
    raise RuntimeError(f"Pandas parsing error for ${safeFileName}: {str(e)}")

# Critical anchoring to global scope
_df_orig = df.copy()
globals()['df'] = df
globals()['_df_orig'] = _df_orig
print(f"Engine active. {len(df)} rows loaded from ${safeFileName}.")
`;
        await this.pyodide.runPythonAsync(pythonCode);
    } catch (err: any) {
        console.error("Pyodide loadFile error:", err);
        throw new Error(`Engine Activation Failed: ${err.message}`);
    }
  }

  async runCode(code: string): Promise<{ result: any; stdout: string; error?: string }> {
    if (!this.pyodide) throw new Error("Python engine not ready.");
    
    try {
      await this.pyodide.runPythonAsync(`
import sys
import io
import pandas as pd
import numpy as np
import re
import html
sys.stdout = io.StringIO()
# Ensure globals are mapped per execution
globals()['pd'] = pd
globals()['np'] = np
globals()['re'] = re
globals()['html'] = html
      `);
      
      const result = await this.pyodide.runPythonAsync(code);
      const stdout = await this.pyodide.runPythonAsync('sys.stdout.getvalue()');
      
      return { result, stdout };
    } catch (err: any) {
      return { result: null, stdout: '', error: err.message };
    }
  }

  async getDatasetSummary() {
    if (!this.pyodide) return null;
    try {
      const summaryJson = await this.pyodide.runPythonAsync(`
import json
if 'df' in globals():
    res = json.dumps(get_df_summary(df))
else:
    res = json.dumps({"error": "DataFrame 'df' not found in memory"})
res
`);
      return JSON.parse(summaryJson);
    } catch (e) {
      console.error("Summary Generation Failed:", e);
      return null;
    }
  }

  async getFullData(): Promise<any[]> {
    if (!this.pyodide) return [];
    try {
      const jsonStr = await this.pyodide.runPythonAsync('df.to_json(orient="records")');
      return JSON.parse(jsonStr);
    } catch (e) {
      return [];
    }
  }

  async getDfBlob(format: 'csv' | 'xlsx'): Promise<Blob> {
    const bytes = await this.exportData(format);
    return new Blob([bytes], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  async exportData(format: 'csv' | 'xlsx'): Promise<Uint8Array> {
    if (!this.pyodide) throw new Error("Engine not ready");
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
