CREATE TABLE `secret_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`task_id` text,
	`purpose` text NOT NULL,
	`spec` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result_ref` text,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_secret_prompts_kin` ON `secret_prompts` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_secret_prompts_status` ON `secret_prompts` (`status`);