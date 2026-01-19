// backend/gemini.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// REPLACE WITH YOUR ACTUAL KEY
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Analyzes a route string and returns a JSON object with score and advice.
 * @param {string} routeSummary - The name of the road/area.
 * @param {string} stepDetails - The turn-by-turn text.
 */
export async function getRouteSafetyAnalysis(routeSummary, stepDetails) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
        You are a safety consultant for women traveling at night. 
        Analyze this route:
        Summary: ${routeSummary}
        Details: ${stepDetails}

        1. Give a safety score (1-10) based on typical night lighting and business density in such areas.
        2. Write a short 1-sentence warning or tip.
        
        Return ONLY valid JSON in this format:
        { "score": 8, "advisory": "This area is well-lit." }
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Clean the response (remove Markdown code blocks if Gemini adds them)
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Gemini AI Error:", error);
        // Fallback data if AI fails
        return { score: "?", advisory: "AI Analysis currently unavailable." };
    }
}

