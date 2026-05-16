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
      return NextResponse.json(
        { error: "Issue is required" },
        { status: 400 }
      );
    }

    const prompt = `
You are a strict JSON debugging assistant.

RULES:
- Return ONLY valid JSON
- No markdown
- No explanations
- No backticks
- No extra text

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

Issue:
${issue}

Stack:
${stack || "Not provided"}

Already Tried:
${tried || "Not provided"}
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://unstuck.vercel.app",
          "X-OpenRouter-Title": "Unstuck",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    // DEBUG
    console.log("OPENROUTER RESPONSE:", JSON.stringify(data, null, 2));

    const text = data?.choices?.[0]?.message?.content || "";

    if (!text) {
      return NextResponse.json(
        {
          error: "Empty model response",
          raw: data,
        },
        { status: 500 }
      );
    }

    // extract JSON safely
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return NextResponse.json(
        {
          error: "No JSON found in output",
          raw: text,
        },
        { status: 500 }
      );
    }

    const jsonString = text.slice(start, end + 1);

    let parsed: AnalysisResult;

    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Invalid JSON",
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