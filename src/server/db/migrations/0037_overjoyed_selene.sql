CREATE TABLE `knowledge_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`kin_id` text NOT NULL,
	`content` text NOT NULL,
	`embedding` blob,
	`position` integer NOT NULL,
	`token_count` integer NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `knowledge_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_chunks_kin_id` ON `knowledge_chunks` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_chunks_source_id` ON `knowledge_chunks` (`source_id`);--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`original_filename` text,
	`mime_type` text,
	`stored_path` text,
	`source_url` text,
	`raw_content` text,
	`chunk_count` integer DEFAULT 0 NOT NULL,
	`token_count` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_sources_kin_id` ON `knowledge_sources` (`kin_id`);