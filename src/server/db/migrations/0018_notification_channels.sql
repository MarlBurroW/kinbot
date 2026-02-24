CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`channel_id` text NOT NULL REFERENCES `channels`(`id`) ON DELETE CASCADE,
	`platform_chat_id` text NOT NULL,
	`label` text,
	`is_active` integer DEFAULT true NOT NULL,
	`type_filter` text,
	`last_delivered_at` integer,
	`last_error` text,
	`consecutive_errors` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notif_channels_user` ON `notification_channels` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notif_channels_unique` ON `notification_channels` (`user_id`, `channel_id`, `platform_chat_id`);
