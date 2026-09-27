import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type MistralTextChunk =
  | string
  | {
      type?: string;
      text?: string;
      content?: string;
    };

type MistralChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | MistralTextChunk[];
    };
  }>;
};

export type MistralInsightRequest = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export type MistralInsightResponse = {
  text: string;
  model: string;
};

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractMistralText(payload: MistralChatResponse): string | null {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (!Array.isArray(content)) return null;

  const text = content
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      if (typeof chunk?.text === "string") return chunk.text;
      if (typeof chunk?.content === "string") return chunk.content;
      return "";
    })
    .join("")
    .trim();

  return text || null;
}

@Injectable()
export class MistralProvider {
  readonly providerName = "mistral";
  readonly endpoint: string;
  readonly model: string;

  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: ConfigService) {
    this.apiKey = String(config.get("MISTRAL_API_KEY") || "").trim();
    this.endpoint = String(
      config.get("MISTRAL_API_URL") ||
        "https://api.mistral.ai/v1/chat/completions",
    ).trim();
    this.model = String(
      config.get("MISTRAL_MODEL") || "mistral-small-latest",
    ).trim();
    this.timeoutMs = clampInteger(
      config.get("MISTRAL_TIMEOUT_MS"),
      12_000,
      2_000,
      30_000,
    );
    this.maxRetries = clampInteger(
      config.get("MISTRAL_MAX_RETRIES"),
      1,
      0,
      3,
    );
  }

  get configured() {
    return Boolean(this.apiKey && this.endpoint && this.model);
  }

  async complete(request: MistralInsightRequest): Promise<MistralInsightResponse | null> {
    if (!this.configured) return null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            temperature: request.temperature ?? 0.2,
            max_tokens: request.maxTokens ?? 220,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.ok) {
          const payload = (await response.json()) as MistralChatResponse;
          const text = extractMistralText(payload);
          return text ? { text, model: this.model } : null;
        }

        const retryable =
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;

        if (!retryable || attempt >= this.maxRetries) return null;

        const retryAfter = Number(response.headers.get("retry-after"));
        const delayMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 5_000)
            : Math.min(500 * 2 ** attempt, 2_000);
        await sleep(delayMs);
      } catch {
        if (attempt >= this.maxRetries) return null;
        await sleep(Math.min(500 * 2 ** attempt, 2_000));
      }
    }

    return null;
  }
}
