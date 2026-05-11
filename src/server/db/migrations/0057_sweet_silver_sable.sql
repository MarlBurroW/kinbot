PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contact_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`kin_id` text,
	`user_id` text,
	`scope` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contact_notes`("id", "contact_id", "kin_id", "user_id", "scope", "content", "created_at", "updated_at") SELECT "id", "contact_id", "kin_id", NULL, "scope", "content", "created_at", "updated_at" FROM `contact_notes`;--> statement-breakpoint
DROP TABLE `contact_notes`;--> statement-breakpoint
ALTER TABLE `__new_contact_notes` RENAME TO `contact_notes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_notes_unique` ON `contact_notes` (`contact_id`,`kin_id`,`user_id`,`scope`);--> statement-breakpoint
CREATE INDEX `idx_contact_notes_contact_id` ON `contact_notes` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_contact_notes_kin_id` ON `contact_notes` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_contact_notes_user_id` ON `contact_notes` (`user_id`);