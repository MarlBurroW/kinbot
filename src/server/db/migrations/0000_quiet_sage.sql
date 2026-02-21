CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `compacting_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`summary` text NOT NULL,
	`messages_up_to_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`messages_up_to_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_compacting_kin_active` ON `compacting_snapshots` (`kin_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`linked_user_id` text,
	`linked_kin_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_kin_id` ON `contacts` (`kin_id`);--> statement-breakpoint
CREATE TABLE `crons` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`schedule` text NOT NULL,
	`task_description` text NOT NULL,
	`target_kin_id` text,
	`model` text,
	`is_active` integer DEFAULT true NOT NULL,
	`requires_approval` integer DEFAULT false NOT NULL,
	`last_triggered_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `custom_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`parameters` text NOT NULL,
	`script_path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_tools_kin_name` ON `custom_tools` (`kin_id`,`name`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`message_id` text,
	`uploaded_by` text,
	`original_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kin_mcp_servers` (
	`kin_id` text NOT NULL,
	`mcp_server_id` text NOT NULL,
	PRIMARY KEY(`kin_id`, `mcp_server_id`),
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mcp_server_id`) REFERENCES `mcp_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kins` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`avatar_path` text,
	`character` text NOT NULL,
	`expertise` text NOT NULL,
	`model` text NOT NULL,
	`workspace_path` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`args` text,
	`env` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`content` text NOT NULL,
	`embedding` blob,
	`category` text NOT NULL,
	`subject` text,
	`source_message_id` text,
	`source_channel` text DEFAULT 'automatic' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_memories_kin_id` ON `memories` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_memories_kin_category` ON `memories` (`kin_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_memories_kin_subject` ON `memories` (`kin_id`,`subject`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`task_id` text,
	`role` text NOT NULL,
	`content` text,
	`source_type` text NOT NULL,
	`source_id` text,
	`tool_calls` text,
	`tool_call_id` text,
	`request_id` text,
	`in_reply_to` text,
	`is_redacted` integer DEFAULT false NOT NULL,
	`redact_pending` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_kin_id` ON `messages` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_task_id` ON `messages` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_kin_created` ON `messages` (`kin_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_source` ON `messages` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config_encrypted` text NOT NULL,
	`capabilities` text NOT NULL,
	`is_valid` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`message_type` text NOT NULL,
	`content` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`in_reply_to` text,
	`task_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_queue_kin_status_priority` ON `queue_items` (`kin_id`,`status`,`priority`,`created_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_kin_id` text NOT NULL,
	`source_kin_id` text,
	`spawn_type` text NOT NULL,
	`mode` text DEFAULT 'await' NOT NULL,
	`model` text,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`error` text,
	`depth` integer DEFAULT 1 NOT NULL,
	`parent_task_id` text,
	`cron_id` text,
	`request_input_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cron_id`) REFERENCES `crons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_parent_kin` ON `tasks` (`parent_kin_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_cron` ON `tasks` (`cron_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`pseudonym` text NOT NULL,
	`language` text DEFAULT 'fr' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vault_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vault_secrets_key_unique` ON `vault_secrets` (`key`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
