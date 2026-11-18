import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const topics = ["Installation", "Quality", "Service", "Support", "Overall"];

export async function POST(request: Request) {
  try {
    const { topic, language } = await request.json();

    if (
      ![...topics, "All topics"].includes(topic) ||
      !["English", "hi-en", "All languages"].includes(language)
    ) {
      return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: `
Generate exactly 5 distinct review-writing templates.

Topic: ${topic}
Language: ${language}

Rules:
- Use the requested topic.
- If All topics, distribute the topics.
- English means English.
- hi-en means natural Hinglish.
- All languages means a mixture.
- Keep each example short and natural.
- Use placeholders for personal experiences.
- Never invent customer experiences or testimonials.
- Return exactly five writing templates.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  language: { type: Type.STRING },
                  text: { type: Type.STRING },
                  style: { type: Type.STRING },
                },
                required: ["topic", "language", "text", "style"],
              },
            },
          },
          required: ["comments"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");

    if (!Array.isArray(result.comments) || result.comments.length !== 5) {
      throw new Error("Invalid AI response");
    }

    const comments = result.comments.slice(0, 5).map(
      (
        comment: {
          topic: string;
          language: string;
          text: string;
          style: string;
        },
        index: number,
      ) => ({
        ...comment,
        id: index + 1,
      }),
    );

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Gemini API error:", error);

    return NextResponse.json(
      {
        error: "AI generation failed. Please try again later.",
      },
      { status: 500 },
    );
  }
}
