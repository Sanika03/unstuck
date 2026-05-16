import { NextResponse } from "next/server";

export type AnalysisResult = {
  likelyCauses: string[];
  bestNextSteps: string[];
  avoidRetrying: string[];
  fastestIsolationStrategy: string[];
  potentialTimeWasters: string[];
  confidenceLevel: "Low" | "Medium" | "High";
  confidenceRationale: string;
};

export async function POST(req: Request) {
  try {
    const { issue, stack, tried } = await req.json();

    if (!issue) {
      return NextResponse.json({ error: "Issue is required" }, { status: 400 });
    }

    const prompt = `
You are a strict JSON generator for a debugging assistant.

CRITICAL RULES:
- Output ONLY valid JSON
- No markdown
- No explanations
- No text before or after JSON
- If unsure, return empty arrays but still valid JSON

Return EXACT format:

{
  "likelyCauses": [],
  "bestNextSteps": [],
  "avoidRetrying": [],
  "fastestIsolationStrategy": [],
  "potentialTimeWasters": [],
  "confidenceLevel": "Low",
  "confidenceRationale": ""
}

USER INPUT:
Issue: ${issue}
Stack: ${stack || "Not provided"}
Already Tried: ${tried || "Not provided"}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

    const candidate = data?.candidates?.[0];

    if (!candidate) {
      return NextResponse.json(
        {
          error: "No response from model",
          raw: data,
        },
        { status: 500 },
      );
    }

    const text =
      candidate?.content?.parts?.map((p: any) => p.text).join("") || "";

    // SAFE EMPTY CHECK
    if (!text || text.trim().length === 0) {
      return NextResponse.json({
        likelyCauses: ["Empty model response"],
        bestNextSteps: ["Retry request"],
        avoidRetrying: [],
        fastestIsolationStrategy: [],
        potentialTimeWasters: [],
        confidenceLevel: "Low",
        confidenceRationale: "Model returned empty output",
      });
    }

    // SAFE JSON EXTRACTION
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return NextResponse.json(
        {
          error: "No JSON found in model output",
          raw: text,
        },
        { status: 500 },
      );
    }

    const jsonString = text.slice(start, end + 1);

    let parsed: AnalysisResult;

    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Invalid JSON from model",
          raw: text,
        },
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
