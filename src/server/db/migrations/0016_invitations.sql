CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`label` text,
	`created_by` text NOT NULL REFERENCES `user`(`id`),
	`kin_id` text REFERENCES `kins`(`id`) ON DELETE SET NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by` text REFERENCES `user`(`id`),
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);
--> statement-breakpoint
CREATE INDEX `idx_invitations_created_by` ON `invitations` (`created_by`);
