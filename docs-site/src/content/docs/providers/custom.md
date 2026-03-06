---
title: Adding Custom Providers
description: Extend KinBot with custom AI providers via plugins.
---

Beyond the 23 built-in providers, you can add custom providers through the **plugin system**.

## Plugin Providers

Plugins can register new AI providers that appear alongside built-in ones in the Settings UI. This is useful for:

- Proprietary or internal LLM endpoints
- Custom model hosting (e.g., vLLM, TGI)
- Specialized embedding or image generation services
- Proxy services with custom authentication

## Implementation

A plugin registers a provider by implementing the provider interface and registering it during plugin initialization. The provider must declare its capabilities (LLM, embedding, image, search) so KinBot knows where to use it.

```typescript
// Example plugin provider registration
export default {
  name: 'my-custom-provider',
  register(ctx) {
    ctx.registerProvider({
      id: 'my-provider',
      displayName: 'My Provider',
      capabilities: ['llm', 'embedding'],
      // ... implementation
    })
  }
}
```

Once registered, the provider appears in **Settings > Providers** and can be configured with an API key and base URL like any built-in provider.

## OpenAI-Compatible Endpoints

Many self-hosted solutions expose an OpenAI-compatible API. For these, you can often use the built-in **OpenAI** or **OpenRouter** provider with a custom base URL, without needing a plugin:

1. Go to **Settings > Providers > OpenAI**
2. Set the **Base URL** to your endpoint (e.g., `http://localhost:8000/v1`)
3. Set the API key if required

This works with vLLM, llama.cpp server, LocalAI, and other OpenAI-compatible services.

## Ollama

For local models, [Ollama](https://ollama.ai) is the recommended approach. It's a built-in provider that requires no API key:

1. Install and run Ollama on your machine
2. Pull models: `ollama pull llama3` or `ollama pull nomic-embed-text`
3. In KinBot, configure the Ollama provider with the base URL (default: `http://localhost:11434`)

From Docker, use `http://host.docker.internal:11434` instead of `localhost`.
