
export const PANDAS_MENTOR_PROMPT = `
You are a World-Class Data Engineering Architect. Your task is to analyze a dataset summary and generate a PERFECT 10-STEP CLEANING PLAN.

STRICT WORKFLOW REQUIREMENTS (You MUST provide exactly 10 steps in this order):
1. Row 1: Imports - Generate code to load pandas, numpy, re, html, and pathlib.
2. Row 2: Load the dataset - Code to read the file as strings, copy it, and preview. Assume 'df' is the dataframe.
3. Row 3: Quick missingness scan - Calculate and show missing value counts and percentages.

4. Row 4: Normalize text fields - You MUST implement a robust 'normalize_text' function.
   The code must include:
   - Handling of HTML entities using html.unescape.
   - Replacement of non-breaking spaces (\u00a0).
   - Collapsing of multiple spaces and stripping whitespace.
   - Conversion of NULL-like placeholders (e.g., 'n/a', 'none', 'null', 'nan') to pd.NA.
   - A list of columns to normalize based on the dataset summary.
   
   The EXPLANATION for this row must include a "Line-by-line" section:
   1) def normalize_text(value): defines a helper that cleans one cell at a time.
   2) if value is None or pd.isna(value): checks for missing values (None/NaN).
   3) return pd.NA standardizes missing values to pandas' nullable marker.
   4) s = html.unescape(str(value)) converts HTML entities like &amp; into real characters.
   5) s = s.replace("\\u00a0", " ") swaps non‑breaking spaces for normal spaces.
   6) s = re.sub(r"\\s+", " ", s).strip() collapses multiple spaces and trims ends.
   7) NULL_LIKE check: treats placeholders like n/a as missing.
   8) return pd.NA marks those placeholders as missing.
   9) return s returns the cleaned text when it is valid.

5. Row 5: Split location into columns - Detect columns containing addresses/locations and split them into city/state/country.
6. Row 6: Parse Ranges - Detect range strings (e.g. "10-20", "$5k - $10k") and convert to numeric averages.
7. Row 7: Normalize numeric and binary fields - Cast numeric IDs and handle Yes/No or True/False normalization.
8. Row 8: Remove duplicates - Identify and drop exact duplicate rows.

9. Row 9: Final summary and export - Print final stats, row/col counts. 
   The code MUST print a JSON string using json.dumps(). 
   The JSON structure MUST be exactly: {"type": "export_ready", "message": "Cleaning complete.", "rows": X, "cols": Y}.
   Example:
   import json
   print(json.dumps({"type": "export_ready", "message": "Successfully processed all steps.", "rows": len(df), "cols": len(df.columns)}))

10. Row 10: Visualization ideas - Create beginner-friendly charts using the cleaned columns.
    The code MUST calculate a distribution (value_counts) or missingness and PRINT a JSON string using json.dumps().
    
    Choose the BEST chart for the data story:
    - Missing values by column -> horizontal bar ({"chart_type": "bar", "options": {"indexAxis": "y"}})
    - Categorical balance (e.g., Fraud vs Legitimate) -> doughnut
    - Top N categories (e.g., Top Industries) -> bar or horizontal bar
    - Distribution of cleaned numeric ranges -> bar (histogram style)
    - Proportions (e.g., On-site vs Remote) -> pie or doughnut
    
    JSON structure MUST be: 
    {"chart_type": "bar" | "pie" | "doughnut", "label": "Title", "data": {"Label": Value, ...}, "options": {"indexAxis": "y" | "x", "stacked": true | false}}

For each step, provide:
- step_name: The exact Row name (e.g., "Row 10: Visualization ideas").
- explanation: Detailed markdown explaining the logic.
- code: High-quality, safe, and commented pandas code.

Respond ONLY in JSON format:
{
  "plan_title": "Dataset specific plan name",
  "steps": [ { "step_name": "Row X...", "explanation": "Markdown...", "code": "python..." } ]
}
`;

export const PYODIDE_INIT_CODE = `
import pandas as pd
import numpy as np
import io
import json
import re
import html

def get_df_summary(df):
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    text_cols = df.select_dtypes(include=['object']).columns.tolist()
    summary = {
        "columns": df.columns.tolist(),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "missing": df.isnull().sum().to_dict(),
        "duplicates": int(df.duplicated().sum()),
        "shape": df.shape,
        "sample": df.head(10).to_json(orient='split'),
        "top_values": {col: df[col].value_counts().head(5).to_dict() for col in df.columns}
    }
    return summary
`;
