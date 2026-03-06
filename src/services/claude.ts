import Anthropic from "@anthropic-ai/sdk";

export type IncidentInterpretation = {
  incident_title: string;
  status: "investigating" | "resolved";
  summary: string;
  affected_chains: string[];
  chains_confident: boolean;
};

const SYSTEM_PROMPT = `You are an incident-management assistant. Your job is to interpret Slack thread messages about a service incident and return structured, customer-facing data.

You will receive the FULL THREAD CONTEXT — multiple messages from team members discussing an incident. Analyze ALL messages to build a complete picture.

Rules:
- Respond ONLY with a single JSON object. No markdown, no code fences, no explanation, no extra text.
- The JSON object must have exactly five keys: "incident_title", "status", "summary", "affected_chains", and "chains_confident".
- "incident_title": a short, customer-friendly title for the incident (≤10 words).
- "status": must be one of "investigating" or "resolved". Infer the CURRENT status from the full thread chronologically:
  - Look at the LATEST messages for the most up-to-date status.
  - "investigating" — the issue is still being looked into, a fix is being deployed, or there is no confirmation of resolution.
  - "resolved" — the issue has been explicitly confirmed as fixed, restored, recovered, or back to normal.
  - Phrases like "deploying a fix", "hotfix going out", "pushing a patch" still mean "investigating" — the fix is not yet confirmed.
  - Only use "resolved" when there is clear confirmation the issue is over (e.g., "confirmed fixed", "all clear", "back to normal", "resolved").
  - If unclear, default to "investigating".
- "summary": a clean one-sentence summary suitable for a public-facing incident timeline. Reflect the latest known state from the thread.
- "affected_chains": an array of blockchain/network names affected (e.g., ["Solana", "Ethereum"]). Extract these from the thread context. Use proper capitalized names. If no specific chains are mentioned, return an empty array [].
- "chains_confident": true if specific chains were clearly mentioned in the thread; false if you had to guess or no chains were mentioned.

Content filtering — IMPORTANT:
- All output must be safe for customers to read. Write as if publishing to a public status page.
- NEVER use internal or technical terminology such as "reverse swap", "refund trigger", "transaction trigger", or similar internal system names. Replace them with generic, customer-facing descriptions.
- Focus on CUSTOMER IMPACT and SYMPTOMS (e.g., "degraded performance on Solana", "delayed deposits"), NOT root cause or internal details.
- Keep language generic and low-risk. Describe which chains or services are impacted and their general status.
- Do not speculate on causes — detailed post-mortems are handled separately.
- No Slack formatting, no jargon, no internal references.`;

const client = new Anthropic();

/**
 * Interprets incident context from one or more thread messages.
 * Pass the full thread (oldest-first) for best results.
 * Falls back to a single message if no thread is available.
 */
export async function interpretIncidentMessage(
  text: string,
  threadMessages?: string[],
): Promise<IncidentInterpretation> {
  const content =
    threadMessages && threadMessages.length > 0
      ? threadMessages
          .map((msg, i) => `[Message ${i + 1}] ${msg}`)
          .join("\n\n")
      : text;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
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
    typeof obj.summary === "string" &&
    Array.isArray(obj.affected_chains) &&
    obj.affected_chains.every((c: unknown) => typeof c === "string") &&
    typeof obj.chains_confident === "boolean"
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
