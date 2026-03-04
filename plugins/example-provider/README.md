# Example Provider Plugin

A demonstration plugin showing how to register a custom AI provider in KinBot.

This is a **template**, not a functional provider. Use it as a starting point for integrating your own LLM API.

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string (secret) | ✅ | API key for your provider |
| `baseUrl` | string | | Custom API endpoint URL |

## What it demonstrates

- Registering a provider with `providers` in the plugin exports
- Implementing `testConnection()` to validate credentials
- Implementing `listModels()` to expose available models
- Provider type auto-prefixing (`plugin_<name>_<key>`)

## Building a real provider

To turn this into a functional provider:

1. Replace `testConnection()` with an actual API health check
2. Replace `listModels()` with a real model listing call
3. Implement the full `ProviderDefinition` interface (see `src/server/providers/types.ts`)
4. Add the appropriate HTTP permissions to `plugin.json`
