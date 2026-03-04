CREATE TABLE `plugin_states` (
	`name` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`config_encrypted` text,
	`approved_permissions` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plugin_storage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plugin_name` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plugin_storage_name_key` ON `plugin_storage` (`plugin_name`,`key`);--> statement-breakpoint
CREATE INDEX `idx_plugin_storage_plugin` ON `plugin_storage` (`plugin_name`);