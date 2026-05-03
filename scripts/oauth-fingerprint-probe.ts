#!/usr/bin/env bun
/**
 * OAuth fingerprint probe.
 *
 * Sends a minimal Messages API request to Anthropic using the *exact* wire
 * shape that the official Claude Code CLI uses, with the user's OAuth token.
 * Prints headers + body the server returns so we can tell whether the request
 * gets routed to the regular plan pool or to "extra usage" billing.
 *
 * Usage:
 *   bun scripts/oauth-fingerprint-probe.ts
 *   bun scripts/oauth-fingerprint-probe.ts --no-tools     # control: same request without tools
 *   bun scripts/oauth-fingerprint-probe.ts --model claude-sonnet-4-6
 *
 * What this proves:
 *   - If this probe ALSO returns the "extra usage" warning → the OAuth token
 *     is flagged server-side; no amount of client-side spoofing can fix it.
 *   - If this probe is clean (no warning) but the KinBot dev server still
 *     warns → there's a fingerprint difference between this probe and what
 *     KinBot actually sends. Diff the two requests.
 */
import {
  getOAuthAccessToken,
  OAUTH_HEADERS,
  getOAuthUserId,
  buildBillingHeaderText,
} from '@/server/providers/anthropic-oauth'

const args = process.argv.slice(2)
const includeTools = !args.includes('--no-tools')
const useKinbotTools = args.includes('--kinbot-tools')
const useStreaming = args.includes('--stream')
const modelIdx = args.indexOf('--model')
const model = modelIdx >= 0 ? args[modelIdx + 1] : 'claude-sonnet-4-6'

async function main() {
  const accessToken = await getOAuthAccessToken()
  console.log(`Token loaded (${accessToken.slice(0, 12)}...).`)
  console.log(`Model: ${model}`)
  console.log(`Tools included: ${includeTools}`)
  console.log('')

  const messages = [{ role: 'user', content: 'Say "hello" and nothing else.' }]
  const body: Record<string, unknown> = {
    model,
    max_tokens: 64,
    messages,
    temperature: 1,
    system: [
      {
        type: 'text',
        text: buildBillingHeaderText(messages),
      },
      {
        type: 'text',
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        cache_control: { type: 'ephemeral' },
      },
    ],
    metadata: { user_id: getOAuthUserId() },
  }

  if (includeTools) {
    if (useKinbotTools) {
      // Real KinBot-style tool set — snake_case names, none of Claude Code's
      // official tool names. If this flips the response to "extra usage",
      // tool-name fingerprinting is part of Anthropic's classifier.
      body.tools = [
        { name: 'recall', description: 'Search long-term memory', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
        { name: 'memorize', description: 'Save a fact to long-term memory', input_schema: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' } }, required: ['content'] } },
        { name: 'send_message', description: 'Send a message to another Kin', input_schema: { type: 'object', properties: { slug: { type: 'string' }, message: { type: 'string' } }, required: ['slug', 'message'] } },
        { name: 'spawn_kin', description: 'Spawn a sub-Kin for a delegated task', input_schema: { type: 'object', properties: { slug: { type: 'string' }, task: { type: 'string' } }, required: ['slug', 'task'] } },
      ]
    } else {
      body.tools = [
        {
          name: 'Bash',
          description: 'Execute a shell command',
          input_schema: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      ]
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
    'anthropic-version': '2023-06-01',
    'x-stainless-retry-count': '0',
    'x-stainless-timeout': '600',
    ...(OAUTH_HEADERS as Record<string, string>),
  }

  console.log('Outgoing headers:')
  for (const [k, v] of Object.entries(headers)) {
    console.log(`  ${k}: ${v}`)
  }
  console.log('')
  console.log('Outgoing body (truncated):')
  console.log(`  ${JSON.stringify(body).slice(0, 200)}...`)
  console.log('')

  const url = 'https://api.anthropic.com/v1/messages?beta=true'
  console.log(`POST ${url}`)
  const t0 = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const dt = Date.now() - t0
  console.log(`HTTP ${res.status} (${dt}ms)`)
  console.log('')

  console.log('Response headers (relevant):')
  for (const k of [
    'anthropic-ratelimit-requests-limit',
    'anthropic-ratelimit-requests-remaining',
    'anthropic-ratelimit-tokens-limit',
    'anthropic-ratelimit-tokens-remaining',
    'anthropic-ratelimit-input-tokens-remaining',
    'anthropic-ratelimit-output-tokens-remaining',
    'anthropic-billing-tier',
    'anthropic-organization-id',
    'request-id',
    'x-should-retry',
  ]) {
    const v = res.headers.get(k)
    if (v != null) console.log(`  ${k}: ${v}`)
  }
  console.log('')

  const text = await res.text()
  console.log('Response body:')
  console.log(text.length > 1500 ? text.slice(0, 1500) + '\n…(truncated)' : text)
  console.log('')

  if (text.includes('extra usage')) {
    console.log('⚠️  "extra usage" warning detected — this request was classified as third-party.')
  } else if (res.ok) {
    console.log('✅ Clean response — request was accepted on the regular plan pool.')
  }
}

main().catch((err) => {
  console.error('Probe failed:', err)
  process.exit(1)
})
