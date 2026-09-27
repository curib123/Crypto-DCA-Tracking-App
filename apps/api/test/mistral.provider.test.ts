import assert from "node:assert/strict";
import test from "node:test";
import type { ConfigService } from "@nestjs/config";
import {
  extractMistralText,
  MistralProvider,
} from "../src/modules/ai/mistral.provider";

function config(values: Record<string, string>) {
  return {
    get(key: string) {
      return values[key];
    },
  } as ConfigService;
}

test("extractMistralText supports string and chunk responses", () => {
  assert.equal(
    extractMistralText({
      choices: [{ message: { content: "  Portfolio looks balanced.  " } }],
    }),
    "Portfolio looks balanced.",
  );

  assert.equal(
    extractMistralText({
      choices: [{
        message: {
          content: [
            { type: "text", text: "First " },
            { type: "text", text: "second." },
          ],
        },
      }],
    }),
    "First second.",
  );
});

test("Mistral provider stays disabled without a server-side API key", async () => {
  const provider = new MistralProvider(config({}));

  assert.equal(provider.configured, false);
  assert.equal(
    await provider.complete({ system: "system", user: "user" }),
    null,
  );
});

test("Mistral provider sends the official chat-completions request shape", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Tracked fees are 0.5% of contributions." } }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const provider = new MistralProvider(
      config({
        MISTRAL_API_KEY: "test-secret",
        MISTRAL_MODEL: "mistral-small-latest",
        MISTRAL_MAX_RETRIES: "0",
      }),
    );

    const result = await provider.complete({
      system: "Explain only supplied analytics.",
      user: JSON.stringify({ fees: 0.5 }),
      temperature: 0.2,
      maxTokens: 120,
    });

    assert.equal(requestUrl, "https://api.mistral.ai/v1/chat/completions");
    assert.equal(
      new Headers(requestInit?.headers).get("Authorization"),
      "Bearer test-secret",
    );

    const body = JSON.parse(String(requestInit?.body));
    assert.equal(body.model, "mistral-small-latest");
    assert.equal(body.max_tokens, 120);
    assert.equal(body.messages[0].role, "system");
    assert.equal(body.messages[1].role, "user");
    assert.deepEqual(result, {
      text: "Tracked fees are 0.5% of contributions.",
      model: "mistral-small-latest",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
