
import { GoogleGenAI, Type } from "@google/genai";
import { PANDAS_MENTOR_PROMPT } from "../constants";

export interface CleaningStep {
    step_name: string;
    explanation: string;
    code: string;
}

export interface CleaningPlan {
    plan_title: string;
    steps: CleaningStep[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    suggestedCode?: string;
}

class GeminiService {
  private ai: GoogleGenAI | null = null;

  init() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateFullPlan(summary: any): Promise<CleaningPlan> {
    if (!this.ai) this.init();

    const prompt = `
      Dataset Analysis Summary:
      ${JSON.stringify(summary, null, 2)}

      Based on this data, construct a perfect 10-row cleaning plan following the strict guidelines provided.
    `;

    const response = await this.ai!.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: PANDAS_MENTOR_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                plan_title: { type: Type.STRING },
                steps: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            step_name: { type: Type.STRING },
                            explanation: { type: Type.STRING },
                            code: { type: Type.STRING }
                        },
                        required: ["step_name", "explanation", "code"]
                    }
                }
            },
            required: ["plan_title", "steps"]
        }
      },
    });

    const result = JSON.parse(response.text.trim());
    if (result.steps.length !== 10) {
        console.warn("AI generated plan with unexpected number of steps:", result.steps.length);
    }
    return result;
  }

  async solveError(code: string, error: string, summary: any, chatHistory: ChatMessage[]): Promise<ChatMessage> {
    if (!this.ai) this.init();

    const systemInstruction = `You are a world-class Python/Pandas debugging assistant (Copilot). 
    The user is encountering an error in their notebook cell.
    Analyze the code, the error message, and the dataset summary.
    Provide a clear explanation of what went wrong and suggest corrected code.
    
    Respond in JSON format:
    {
      "explanation": "Brief explanation of the bug...",
      "suggestedCode": "The complete fixed python code..."
    }`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: `
          CODE:
          ${code}
          
          ERROR:
          ${error}
          
          DATASET CONTEXT:
          ${JSON.stringify(summary, null, 2)}
          
          CHAT HISTORY:
          ${JSON.stringify(chatHistory)}
        `}]
      }
    ];

    const response = await this.ai!.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            suggestedCode: { type: Type.STRING }
          },
          required: ["explanation", "suggestedCode"]
        }
      }
    });

    const data = JSON.parse(response.text);
    return {
      role: 'model',
      text: data.explanation,
      suggestedCode: data.suggestedCode
    };
  }
}

export const aiMentor = new GeminiService();
