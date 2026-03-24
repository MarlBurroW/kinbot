ALTER TABLE `tasks` ADD `webhook_id` text REFERENCES webhooks(id);--> statement-breakpoint
CREATE INDEX `idx_tasks_webhook` ON `tasks` (`webhook_id`);--> statement-breakpoint
ALTER TABLE `webhooks` ADD `dispatch_mode` text DEFAULT 'conversation' NOT NULL;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `task_title_template` text;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `task_prompt_template` text;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `max_concurrent_tasks` integer DEFAULT 1 NOT NULL;