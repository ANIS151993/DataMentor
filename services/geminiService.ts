
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
}

export const aiMentor = new GeminiService();
