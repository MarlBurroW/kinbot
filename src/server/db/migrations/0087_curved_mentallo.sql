CREATE TABLE `pending_email_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`kin_id` text NOT NULL,
	`task_id` text,
	`payload` text NOT NULL,
	`summary` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_channel_message_links` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text,
	`platform_message_id` text NOT NULL,
	`platform_chat_id` text NOT NULL,
	`direction` text NOT NULL,
	`sent_by_kin_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sent_by_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_channel_message_links`("id", "channel_id", "message_id", "platform_message_id", "platform_chat_id", "direction", "sent_by_kin_id", "created_at") SELECT "id", "channel_id", "message_id", "platform_message_id", "platform_chat_id", "direction", "sent_by_kin_id", "created_at" FROM `channel_message_links`;--> statement-breakpoint
DROP TABLE `channel_message_links`;--> statement-breakpoint
ALTER TABLE `__new_channel_message_links` RENAME TO `channel_message_links`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_cml_message` ON `channel_message_links` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_cml_channel` ON `channel_message_links` (`channel_id`);