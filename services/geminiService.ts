
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
  private getAI() {
    const key = process.env.API_KEY;
    
    // Check if key is actually a valid string and not a literal 'undefined' from build tools
    if (!key || key === 'undefined' || key === 'null' || key.length < 5) {
        throw new Error("API Key Missing: Please configure your Gemini API Key.");
    }
    
    return new GoogleGenAI({ apiKey: key });
  }

  async generateFullPlan(summary: any): Promise<CleaningPlan> {
    const ai = this.getAI();

    const prompt = `
      Dataset Analysis Summary:
      ${JSON.stringify(summary, null, 2)}

      Based on this data, construct a perfect 10-row cleaning plan following the strict guidelines provided.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

    const text = response.text;
    if (!text) throw new Error("AI returned an empty response.");
    
    const result = JSON.parse(text.trim());
    return result;
  }

  async solveError(code: string, error: string, summary: any, chatHistory: ChatMessage[]): Promise<ChatMessage> {
    const ai = this.getAI();

    const systemInstruction = `You are a world-class Python/Pandas debugging assistant. 
    Analyze the code, error, and dataset context. Suggest fixed code in JSON format.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: `CODE: ${code}\nERROR: ${error}\nCONTEXT: ${JSON.stringify(summary)}` }]
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
