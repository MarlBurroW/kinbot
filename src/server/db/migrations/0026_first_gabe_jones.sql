CREATE TABLE `mini_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`entry_file` text DEFAULT 'index.html' NOT NULL,
	`has_backend` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mini_apps_kin_slug` ON `mini_apps` (`kin_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_mini_apps_kin_id` ON `mini_apps` (`kin_id`);