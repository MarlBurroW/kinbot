CREATE TABLE `llm_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`call_site` text NOT NULL,
	`call_type` text NOT NULL,
	`provider_type` text,
	`provider_id` text,
	`model_id` text,
	`kin_id` text,
	`task_id` text,
	`cron_id` text,
	`session_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`cache_read_tokens` integer,
	`cache_write_tokens` integer,
	`reasoning_tokens` integer,
	`embedding_tokens` integer,
	`step_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_llm_usage_created` ON `llm_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_kin` ON `llm_usage` (`kin_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_provider_type` ON `llm_usage` (`provider_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_model` ON `llm_usage` (`model_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_task` ON `llm_usage` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_cron` ON `llm_usage` (`cron_id`);