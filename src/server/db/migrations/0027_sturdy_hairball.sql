CREATE TABLE `mini_app_storage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `mini_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mini_app_storage_app_key` ON `mini_app_storage` (`app_id`,`key`);--> statement-breakpoint
CREATE INDEX `idx_mini_app_storage_app_id` ON `mini_app_storage` (`app_id`);--> statement-breakpoint
ALTER TABLE `providers` ADD `last_error` text;