import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AnalysisResult = {
  likelyCauses: string[];
  bestNextSteps: string[];
  avoidRetrying: string[];
  fastestIsolationStrategy: string[];
  potentialTimeWasters: string[];
  confidenceLevel: "Low" | "Medium" | "High";
  confidenceRationale: string;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { issue, stack, tried } = await req.json();

    if (!issue) {
      return NextResponse.json({ error: "Issue is required" }, { status: 400 });
    }

    const prompt = `
You are Unstuck, an expert senior software engineer.

Return ONLY valid JSON.

Issue:
${issue}

Stack:
${stack || "Not provided"}

Already Tried:
${tried || "Not provided"}

Format:
{
  "likelyCauses": string[],
  "bestNextSteps": string[],
  "avoidRetrying": string[],
  "fastestIsolationStrategy": string[],
  "potentialTimeWasters": string[],
  "confidenceLevel": "Low" | "Medium" | "High",
  "confidenceRationale": string
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // extract JSON safely
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return NextResponse.json(
        { error: "No JSON found in model output", raw: text },
        { status: 500 },
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON from model", raw: text },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
