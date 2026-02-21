ALTER TABLE `kins` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `kins_slug_unique` ON `kins` (`slug`);