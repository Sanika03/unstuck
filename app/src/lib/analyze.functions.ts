import { createServerFn } from "@tanstack/react-start";

export type AnalysisResult = {
  likelyCauses: string[];
  bestNextSteps: string[];
  avoidRetrying: string[];
  fastestIsolationStrategy: string[];
  potentialTimeWasters: string[];
  confidenceLevel: "Low" | "Medium" | "High";
  confidenceRationale: string;
};

type Input = {
  issue: string;
  stack: string;
  tried: string;
};

const SYSTEM_PROMPT = `You are a senior staff engineer pair-debugging with a solo developer in a live session. You are NOT a chatbot and NOT a tutorial. Be ruthless about signal vs. noise.

Operating principles (apply rigorously):
- Optimize for the FASTEST path to isolating the bug, not the most thorough explanation.
- Always recommend the SIMPLEST possible validation first (one-line check, console.log, curl, single env var print, smallest repro). Cheap checks before clever ones.
- Read "Already tried" carefully. If the user is repeating variants of the same attempt (reinstalling, restarting, clearing caches, retrying without new info), explicitly call out the LOOP and force a different axis of investigation (binary search, bisect, minimal repro, check the boundary, check assumptions).
- Forbid generic advice ("check your code", "make sure imports are correct", "read the docs", "try restarting"). Every item must be specific to THIS issue and THIS stack, and immediately executable.
- Warn against overengineering: do NOT suggest refactors, new abstractions, new libraries, rewrites, or architectural changes as a debugging step.
- Warn against guessing: never propose changes whose effect the user cannot predict or verify in under a minute.
- Prefer falsifiable hypotheses. Each "Likely Cause" should pair with a cheap test that would confirm or kill it.
- If information is missing to isolate confidently, say so in confidenceRationale and put the missing signal as the first "Best Next Step".

Output rules:
- Respond ONLY by calling the report_analysis tool. No prose.
- Each list item: ONE short imperative sentence, max ~140 chars, concrete and execution-focused. No fluff, no hedging, no "you might want to consider".
- likelyCauses: ranked most → least probable. Each phrased as a hypothesis, ideally with the falsifying check appended ("— verify with X").
- bestNextSteps: ordered. Step 1 is always the cheapest check that maximally narrows the search space.
- fastestIsolationStrategy: the minimum sequence (binary search / bisect / minimal repro / boundary check) to localize the bug fast.
- avoidRetrying: things the user already tried OR low-value repeats they're likely to attempt again. Empty array if none apply — do NOT pad.
- potentialTimeWasters: tempting-but-wasteful directions for THIS issue (rewrites, switching libraries, broad refactors, deep dives into unrelated layers, premature optimization). Empty array if none apply.
- confidenceLevel: High only if the cause is near-certain from the description; Medium if a top hypothesis is likely; Low if more signal is needed.`;

export const analyzeIssue = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!data || typeof data.issue !== "string" || data.issue.trim().length < 5) {
      throw new Error("Please describe your issue in more detail.");
    }
    return {
      issue: data.issue.slice(0, 8000),
      stack: (data.stack ?? "").slice(0, 500),
      tried: (data.tried ?? "").slice(0, 4000),
    };
  })
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured.");

    const userPrompt = `Issue:\n${data.issue}\n\nTech stack: ${data.stack || "unspecified"}\n\nAlready tried:\n${data.tried || "(nothing reported)"}\n`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
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
                likelyCauses: { type: "array", items: { type: "string", maxLength: 240 }, minItems: 1, maxItems: 5 },
                bestNextSteps: { type: "array", items: { type: "string", maxLength: 240 }, minItems: 1, maxItems: 5 },
                avoidRetrying: { type: "array", items: { type: "string", maxLength: 240 }, maxItems: 5 },
                fastestIsolationStrategy: { type: "array", items: { type: "string", maxLength: 240 }, minItems: 1, maxItems: 5 },
                potentialTimeWasters: { type: "array", items: { type: "string", maxLength: 240 }, maxItems: 5 },
                confidenceLevel: { type: "string", enum: ["Low", "Medium", "High"] },
                confidenceRationale: { type: "string", maxLength: 400 },
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
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_analysis" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error:", resp.status, txt);
      throw new Error("AI analysis failed. Please try again.");
    }

    const json = await resp.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no analysis.");
    const parsed = JSON.parse(call.function.arguments) as AnalysisResult;
    return parsed;
  });
