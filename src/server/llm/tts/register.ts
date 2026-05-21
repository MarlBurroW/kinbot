import { registerTTSProvider } from '@/server/llm/tts/registry'
import { openaiTTSProvider } from '@/server/llm/tts/openai'
import { elevenlabsTTSProvider } from '@/server/llm/tts/elevenlabs'

/**
 * Register every built-in TTS provider in the registry. Called once at
 * server startup, after the search provider registration.
 *
 * Plugin-contributed TTS providers are registered by the plugin loader
 * regardless of which built-ins exist.
 */
export function registerBuiltinTTSProviders(): void {
  registerTTSProvider(openaiTTSProvider)
  registerTTSProvider(elevenlabsTTSProvider)
}
