ALTER TABLE `channel_user_mappings` ADD `status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_channel_user_map_status` ON `channel_user_mappings` (`channel_id`, `status`);
