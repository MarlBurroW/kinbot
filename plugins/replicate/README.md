# 🦜 Replicate plugin for KinBot

Brings [Replicate](https://replicate.com)-hosted models to KinBot via a single API token. One plugin contributes **all three native provider families** — LLM, Image, and Embedding. The catalogue is sourced from Replicate's own curated collections (`language-models`, `text-to-image`, `embedding-models`), **not** a hardcoded list in this plugin — when Replicate adds or retires a model, KinBot sees the change on the next `listModels()` call.

## Setup

1. Grab an API token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens).
2. In KinBot, go to **Settings → Providers → Add provider**, pick **Replicate**, paste the token.
3. Save. KinBot creates one provider row with all three capabilities enabled (LLM, Image, Embedding).

### Surfacing your own models (private fine-tunes, LoRAs, …)

Replicate's REST API has no "list my models" endpoint — `/v1/models` returns the entire public catalogue with no owner filter. So the plugin can't auto-discover your own models. Instead, the provider config form has three optional textareas:

- **Custom LLM models** — comma-separated `owner/name` identifiers for LLMs missing from the `language-models` collection.
- **Custom image models** — same, for image models (your LoRAs, private fine-tunes, niche community models).
- **Custom embedding models** — same.

Example: `marlburrow/betontower-lora, marlburrow/nicolas-lora` in **Custom image models**.

For each entry the plugin hits `GET /v1/models/{owner}/{name}` (your API token grants access to your private models) and surfaces it with the same metadata extraction (max output tokens, image-input support) as the curated entries. A failed lookup (revoked access, typo) is logged and skipped — the rest of the list keeps working.

## What this plugin demonstrates

This plugin doubles as a real-world reference for [`@kinbot-developer/sdk`](https://www.npmjs.com/package/@kinbot-developer/sdk):

- **Three native providers in one plugin.** Same SDK contract as Anthropic / OpenAI built-ins — `LLMProvider`, `ImageProvider`, `EmbeddingProvider` from `@kinbot-developer/sdk`.
- **`listModels()` reads Replicate's collections.** No hardcoded model IDs in the plugin; the catalogue stays in sync with what Replicate curates upstream. Per-model metadata (max output tokens, image-input support) is read from each model's OpenAPI schema when available, left undefined otherwise.
- **`ctx.http.fetch` everywhere.** No raw `globalThis.fetch`. The manifest's `http:api.replicate.com` and `http:replicate.delivery` permissions are enforced + audited by KinBot.
- **No KinBot-internal imports.** The whole module graph imports from `@kinbot-developer/sdk` only — exactly what a third-party plugin published on npm would look like.

## Caveats

- **Not streamed.** The current implementation uses Replicate's `Prefer: wait` sync mode and emits the whole response as one `text-delta` followed by `finish`. Real SSE streaming is a follow-up.
- **Tool calling via a JSON protocol** (best-effort). Replicate's prediction API doesn't model tool calling at the transport layer, but instruct-tuned models (Llama-instruct, DeepSeek, Qwen, Hermes, Mistral-instruct…) are trained to follow precise format instructions, so the plugin wraps the round-trip in a universal `<tool_call>{"name":"...","arguments":{...}}</tool_call>` protocol. Detection is purely schema-driven: any model whose OpenAPI Input declares a `system_prompt` (Llama/DeepSeek convention) or `messages` (chat-completion convention) field automatically participates. Raw text-completion models without either marker keep `maxTools: 0` and stay tool-less. Robustness depends on each model's instruction-following; very small models can mangle JSON or invent fake tools — KinBot's engine sees those as parse failures and recovers on the next turn.
- **Async generation is bounded.** Image generation can exceed the 60s `Prefer: wait` window; the plugin then polls for up to 5 minutes before giving up.

## Tests

`bun test ./plugins/replicate` — 14 unit tests cover the LLM streaming shape, image download flow, embedding output normalisation, and permission auditing through `ctx.http.fetch`.
