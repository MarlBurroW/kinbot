ALTER TABLE `memories` ADD `consolidation_generation` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `memories` ADD `consolidated_from_ids` text;