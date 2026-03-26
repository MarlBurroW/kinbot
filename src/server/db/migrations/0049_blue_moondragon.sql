CREATE TABLE `compacting_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`summary` text NOT NULL,
	`first_message_at` integer NOT NULL,
	`last_message_at` integer NOT NULL,
	`first_message_id` text,
	`last_message_id` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`token_estimate` integer DEFAULT 0 NOT NULL,
	`is_in_context` integer DEFAULT true NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`source_summary_ids` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_compacting_summaries_kin` ON `compacting_summaries` (`kin_id`,`is_in_context`);