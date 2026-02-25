CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contact_platform_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_platform_ids_unique` ON `contact_platform_ids` (`platform`,`platform_id`);--> statement-breakpoint
CREATE INDEX `idx_contact_platform_ids_contact` ON `contact_platform_ids` (`contact_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`label` text,
	`created_by` text NOT NULL,
	`kin_id` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invitations_created_by` ON `invitations` (`created_by`);--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`platform_chat_id` text NOT NULL,
	`label` text,
	`is_active` integer DEFAULT true NOT NULL,
	`type_filter` text,
	`last_delivered_at` integer,
	`last_error` text,
	`consecutive_errors` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notif_channels_user` ON `notification_channels` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notif_channels_unique` ON `notification_channels` (`user_id`,`channel_id`,`platform_chat_id`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notif_pref_user_type` ON `notification_preferences` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`kin_id` text,
	`related_id` text,
	`related_type` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `scheduled_wakeups` (
	`id` text PRIMARY KEY NOT NULL,
	`caller_kin_id` text NOT NULL,
	`target_kin_id` text NOT NULL,
	`reason` text,
	`fire_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`caller_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wakeups_target_status` ON `scheduled_wakeups` (`target_kin_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_wakeups_caller` ON `scheduled_wakeups` (`caller_kin_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`platform_config` text NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`status_message` text,
	`auto_create_contacts` integer DEFAULT false NOT NULL,
	`messages_received` integer DEFAULT 0 NOT NULL,
	`messages_sent` integer DEFAULT 0 NOT NULL,
	`last_activity_at` integer,
	`created_by` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_channels`("id", "kin_id", "name", "platform", "platform_config", "status", "status_message", "auto_create_contacts", "messages_received", "messages_sent", "last_activity_at", "created_by", "created_at", "updated_at") SELECT "id", "kin_id", "name", "platform", "platform_config", "status", "status_message", "auto_create_contacts", "messages_received", "messages_sent", "last_activity_at", "created_by", "created_at", "updated_at" FROM `channels`;--> statement-breakpoint
DROP TABLE `channels`;--> statement-breakpoint
ALTER TABLE `__new_channels` RENAME TO `channels`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_channels_kin_id` ON `channels` (`kin_id`);--> statement-breakpoint
ALTER TABLE `channel_user_mappings` ADD `status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_channel_user_map_status` ON `channel_user_mappings` (`channel_id`,`status`);