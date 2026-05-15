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

const genAI = new GoogleGenerativeAI(process.env.Gemini_API_Key!);

export async function POST(req: Request) {
  try {
    const { issue, stack, tried } = await req.json();

    if (!issue) {
      return NextResponse.json(
        { error: "Issue is required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
You are Unstuck, an expert senior software engineer and debugging assistant.

Your job:
Analyze the user's bug and return structured debugging guidance.

RULES:
- Be extremely practical
- No fluff
- Focus on root cause thinking
- Avoid generic advice like "check logs"
- Output ONLY valid JSON

USER INPUT:

Issue:
${issue}

Stack Trace:
${stack || "Not provided"}

Already Tried:
${tried || "Not provided"}

OUTPUT FORMAT (strict JSON):
{
  "likelyCauses": string[],
  "bestNextSteps": string[],
  "avoidRetrying": string[],
  "fastestIsolationStrategy": string[],
  "potentialTimeWasters": string[],
  "confidenceLevel": "Low" | "Medium" | "High",
  "confidenceRationale": string
}

GUIDELINES:
- likelyCauses: root technical reasons
- bestNextSteps: actionable fixes in order
- avoidRetrying: wrong directions user might waste time on
- fastestIsolationStrategy: how to debug fastest
- potentialTimeWasters: common traps
- confidenceLevel: how certain you are
- confidenceRationale: why

Return ONLY JSON. No markdown. No explanation.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed: AnalysisResult;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Model returned invalid JSON",
          raw: text,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}