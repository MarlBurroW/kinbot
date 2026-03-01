CREATE TABLE `mini_app_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` text NOT NULL,
	`version` integer NOT NULL,
	`label` text,
	`file_manifest` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `mini_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mini_app_snapshots_app_id` ON `mini_app_snapshots` (`app_id`);--> statement-breakpoint
CREATE INDEX `idx_mini_app_snapshots_app_version` ON `mini_app_snapshots` (`app_id`,`version`);