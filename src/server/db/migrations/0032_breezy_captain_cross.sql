ALTER TABLE `memories` ADD `retrieval_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `memories` ADD `last_retrieved_at` integer;