import Anthropic from "@anthropic-ai/sdk";

export type IncidentInterpretation = {
  incident_title: string;
  status: "investigating" | "resolved";
  summary: string;
};

const SYSTEM_PROMPT = `You are an incident-management assistant. Your job is to interpret a Slack message about a service incident and return structured data.

Rules:
- Respond ONLY with a single JSON object. No markdown, no code fences, no explanation, no extra text.
- The JSON object must have exactly three keys: "incident_title", "status", and "summary".
- "incident_title": a short title for the incident (≤10 words).
- "status": must be one of "investigating" or "resolved".
  - If the message contains words like "down", "broken", "having issues", "outage", "degraded", "failing", "errors", "unavailable", or similar → "investigating"
  - If the message contains words like "fixed", "resolved", "restored", "recovered", "back up", "back online", or similar → "resolved"
  - If unclear, default to "investigating".
- "summary": a clean one-sentence summary suitable for an incident timeline. No jargon, no Slack formatting.`;

const client = new Anthropic();

export async function interpretIncidentMessage(
  text: string,
): Promise<IncidentInterpretation> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const contentBlock = response.content[0];
  if (!contentBlock || contentBlock.type !== "text") {
    throw new ClaudeParseError("Claude returned no text content", "");
  }

  const raw = contentBlock.text
    .trim()
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ClaudeParseError("Claude response is not valid JSON", raw);
  }

  if (!isIncidentInterpretation(parsed)) {
    throw new ClaudeParseError(
      "Claude response does not match expected schema",
      raw,
    );
  }

  return parsed;
}

function isIncidentInterpretation(
  value: unknown,
): value is IncidentInterpretation {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.incident_title === "string" &&
    (obj.status === "investigating" || obj.status === "resolved") &&
    typeof obj.summary === "string"
  );
}

export class ClaudeParseError extends Error {
  public readonly rawResponse: string;

  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "ClaudeParseError";
    this.rawResponse = rawResponse;
  }
}
