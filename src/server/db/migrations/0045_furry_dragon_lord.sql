ALTER TABLE `tasks` ADD `concurrency_group` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `concurrency_max` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `queued_at` integer;--> statement-breakpoint
CREATE INDEX `idx_tasks_concurrency` ON `tasks` (`concurrency_group`,`status`,`queued_at`);