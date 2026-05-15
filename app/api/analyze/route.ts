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

const SYSTEM_PROMPT = `You are a senior staff engineer pair-debugging with a solo developer in a live session. You are NOT a chatbot and NOT a tutorial. Be ruthless about signal vs. noise.

Operating principles (apply rigorously):
- Optimize for the FASTEST path to isolating the bug, not the most thorough explanation.
- Always recommend the SIMPLEST possible validation first.
- Read "Already tried" carefully.
- Forbid generic advice.
- Prefer falsifiable hypotheses.

Output rules:
- Respond ONLY by calling the report_analysis tool. No prose.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const issue = body.issue?.trim();
    const stack = body.stack ?? "";
    const tried = body.tried ?? "";

    if (!issue || issue.length < 5) {
      return NextResponse.json(
        { error: "Please describe your issue in more detail." },
        { status: 400 }
      );
    }

    const apiKey = process.env.LOVABLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI gateway not configured." },
        { status: 500 }
      );
    }

    const userPrompt = `
Issue:
${issue}

Tech stack:
${stack || "unspecified"}

Already tried:
${tried || "(nothing reported)"}
`;

    const payload = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_analysis",
            description: "Return the structured debugging analysis.",
            parameters: {
              type: "object",
              properties: {
                likelyCauses: {
                  type: "array",
                  items: { type: "string" },
                },
                bestNextSteps: {
                  type: "array",
                  items: { type: "string" },
                },
                avoidRetrying: {
                  type: "array",
                  items: { type: "string" },
                },
                fastestIsolationStrategy: {
                  type: "array",
                  items: { type: "string" },
                },
                potentialTimeWasters: {
                  type: "array",
                  items: { type: "string" },
                },
                confidenceLevel: {
                  type: "string",
                  enum: ["Low", "Medium", "High"],
                },
                confidenceRationale: {
                  type: "string",
                },
              },
              required: [
                "likelyCauses",
                "bestNextSteps",
                "avoidRetrying",
                "fastestIsolationStrategy",
                "potentialTimeWasters",
                "confidenceLevel",
                "confidenceRationale",
              ],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: {
          name: "report_analysis",
        },
      },
    };

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (resp.status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached." },
        { status: 429 }
      );
    }

    if (!resp.ok) {
      const txt = await resp.text();

      console.error(txt);

      return NextResponse.json(
        { error: "AI analysis failed." },
        { status: 500 }
      );
    }

    const json = await resp.json();

    const toolCall =
      json?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return NextResponse.json(
        { error: "AI returned no analysis." },
        { status: 500 }
      );
    }

    const parsed: AnalysisResult = JSON.parse(
      toolCall.function.arguments
    );

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
