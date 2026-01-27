
export const PANDAS_MENTOR_PROMPT = `
You are a World-Class Data Engineering Architect. Your task is to analyze a dataset summary and generate a PERFECT 10-STEP CLEANING PLAN.

STRICT WORKFLOW REQUIREMENTS (You MUST provide exactly 10 steps in this order):
1. Row 1: Imports - Load pandas, numpy, re, html, json.
2. Row 2: Load and Inspect Dataset - 
   The code MUST:
   - Check if 'df' is in globals(). If not, use 'pd.read_csv("/mnt/data_source")'.
   - Print df.info() and head().
3. Row 3: Missing Value Analysis - Show counts of nulls per column.

4. Row 4: Normalize text fields - 
   The code MUST:
   - Include 'import pandas as pd', 'import re', and 'import html' at the top of the cell.
   - Print "Starting text normalization..." to show execution has begun.
   - Define a robust 'clean_text(val)' function that:
     1. Returns val if it's pd.isna(val) or None.
     2. Converts val to string, strips whitespace.
     3. Uses re.sub and html.unescape to remove HTML tags and entities.
     4. Converts to a consistent lowercase.
   - Identify all columns with 'object' or 'string' dtypes.
   - Loop through these columns and EXPLICITLY RE-ASSIGN: 'df[col] = df[col].apply(clean_text)'.
   - Print a clear success summary like: "Normalized text in X columns successfully."
   
5. Row 5: Column Splitting - Split composite fields (like locations or date-times) if applicable.
6. Row 6: Range Parsing - Convert range strings (e.g., "50k-70k") to numeric averages or medians.
7. Row 7: Type Standardization - Cast numeric IDs to strings and ensure boolean columns are correct.
8. Row 8: Deduplication - Identify and remove exact duplicate records.

9. Row 9: Export Preparation - Print final counts in JSON using: print(json.dumps({"type": "export_ready", "message": "Cleaning complete.", "rows": len(df), "cols": len(df.columns)})).

10. Row 10: Statistical Insights - Select a key categorical column (e.g., a target variable or major feature). Calculate value counts and use the provided 'display_chart(chart_type, data, label)' helper to output the visualization. 
    Example code: display_chart('bar', df['column_name'].value_counts().to_dict(), 'Distribution of column_name')

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

# Anchor core libraries to global scope for resilience
globals()['pd'] = pd
globals()['np'] = np
globals()['re'] = re
globals()['html'] = html

def display_chart(chart_type, data, label="Insights"):
    """
    Helper function for Step 10 to output Chart.js compatible JSON.
    chart_type: 'bar', 'pie', 'doughnut', 'line'
    data: dictionary of {label: value}
    """
    try:
        # Standardize keys/values for JSON safety
        clean_data = {str(k): float(v) if isinstance(v, (int, float, np.number)) else str(v) for k, v in data.items()}
        print(json.dumps({
            "chart_type": chart_type,
            "data": clean_data,
            "label": label
        }))
    except Exception as e:
        print(f"Chart Error: {str(e)}")

def get_df_summary(df):
    try:
        # Standardize missing values for summary accuracy
        df_clean = df.copy()
        # Convert all object columns to string to ensure json serializability for top_values
        for col in df_clean.select_dtypes(include=['object', 'string']).columns:
            df_clean[col] = df_clean[col].fillna('N/A').astype(str)
            
        summary = {
            "columns": df_clean.columns.tolist(),
            "dtypes": {col: str(df_clean[col].dtype) for col in df_clean.columns},
            "missing": df.isnull().sum().to_dict(), # Use original df for missing count
            "duplicates": int(df.duplicated().sum()),
            "shape": list(df.shape),
            "sample": df_clean.head(10).to_json(orient='split'),
            "top_values": {col: df_clean[col].value_counts().head(5).to_dict() for col in df_clean.columns}
        }
        return summary
    except Exception as e:
        return {"error": str(e)}
`;
