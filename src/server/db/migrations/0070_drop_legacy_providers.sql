-- Drop providers that are no longer supported by the V1 LLM provider abstraction.
-- Only anthropic, anthropic-oauth, openai and openai-codex remain in V1.
DELETE FROM providers WHERE type NOT IN ('anthropic', 'anthropic-oauth', 'openai', 'openai-codex');
--> statement-breakpoint
-- Clean up app_settings that may reference removed providers (search, etc.).
DELETE FROM app_settings WHERE key = 'default_search_provider';
