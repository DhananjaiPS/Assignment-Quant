import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const { description, category } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured.' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
      You are an elite E-commerce SEO Expert.
      Based on the following product data, generate EXACTLY ONE highly optimized, click-driven product title.
      Rules:
      - Include Brand, Material, Key Feature, and Category if present.
      - Max 75 characters.
      - Do NOT output quotes or extra text, just the title.

      Category: ${category || 'General'}
      Description: ${description || 'N/A'}
    `;

        const response = await model.generateContent(prompt);
        const suggestedTitle = response.response.text().trim().replace(/['"]/g, '');

        return NextResponse.json({ success: true, suggestedTitle });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}