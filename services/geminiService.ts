import { GoogleGenAI } from "@google/genai";

const AI_KEY = process.env.API_KEY || '';

export const getDailyWisdom = async (): Promise<string> => {
  if (!AI_KEY) {
    return "Indeed, with hardship comes ease."; // Fallback if no key
  }

  try {
    const ai = new GoogleGenAI({ apiKey: AI_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Generate a very short, inspiring Islamic quote or Hadith (maximum 20 words) suitable for a mosque display board. Do not include references or narration chains, just the wisdom text.",
    });
    
    return response.text?.trim() || "Patience is a pillar of faith.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Speak a good word or remain silent."; // Fallback on error
  }
};
