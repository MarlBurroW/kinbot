CREATE TABLE `quick_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	`expires_at` integer,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_quick_sessions_kin_status` ON `quick_sessions` (`kin_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_quick_sessions_user` ON `quick_sessions` (`created_by`);--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`payload` text,
	`source_ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_logs_webhook_created` ON `webhook_logs` (`webhook_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_triggered_at` integer,
	`trigger_count` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhooks_token_unique` ON `webhooks` (`token`);--> statement-breakpoint
CREATE INDEX `idx_webhooks_kin_id` ON `webhooks` (`kin_id`);--> statement-breakpoint
ALTER TABLE `messages` ADD `session_id` text REFERENCES quick_sessions(id);--> statement-breakpoint
CREATE INDEX `idx_messages_session_id` ON `messages` (`session_id`);--> statement-breakpoint
ALTER TABLE `queue_items` ADD `session_id` text;