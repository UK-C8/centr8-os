// Low-level Gemini transport shared by every agent module that needs it —
// not itself one of the five agents (CLAUDE.md §5), just the plumbing they
// call through, same role this file played inside the old lib/ai/gemini.ts
// before the Planner/Monitor logic that used it moved into their own
// modules (Prompt 2.1).
export class AgentError extends Error {}

// `json: true` asks Gemini for strict JSON output (still returned as text;
// the caller parses it); omit it for a plain-language response.
export async function callGemini(
  promptText: string,
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AgentError("GEMINI_API_KEY is not configured");
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new AgentError(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new AgentError("Gemini returned no content");
  }
  return text;
}
