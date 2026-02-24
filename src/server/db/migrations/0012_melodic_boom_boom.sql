CREATE TABLE `channel_message_links` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text NOT NULL,
	`platform_message_id` text NOT NULL,
	`platform_chat_id` text NOT NULL,
	`direction` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cml_message` ON `channel_message_links` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_cml_channel` ON `channel_message_links` (`channel_id`);--> statement-breakpoint
CREATE TABLE `channel_user_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`platform_username` text,
	`platform_display_name` text,
	`contact_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_channel_user_map` ON `channel_user_mappings` (`channel_id`,`platform_user_id`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`platform_config` text NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`status_message` text,
	`auto_create_contacts` integer DEFAULT true NOT NULL,
	`messages_received` integer DEFAULT 0 NOT NULL,
	`messages_sent` integer DEFAULT 0 NOT NULL,
	`last_activity_at` integer,
	`created_by` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_channels_kin_id` ON `channels` (`kin_id`);