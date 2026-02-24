CREATE TABLE `contact_platform_ids` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `contact_id` TEXT NOT NULL REFERENCES `contacts`(`id`) ON DELETE CASCADE,
  `platform` TEXT NOT NULL,
  `platform_id` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_platform_ids_unique` ON `contact_platform_ids` (`platform`, `platform_id`);--> statement-breakpoint
CREATE INDEX `idx_contact_platform_ids_contact` ON `contact_platform_ids` (`contact_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `contact_platform_ids` (`id`, `contact_id`, `platform`, `platform_id`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  cum.contact_id,
  c.platform,
  cum.platform_user_id,
  cum.created_at,
  cum.updated_at
FROM channel_user_mappings cum
JOIN channels c ON cum.channel_id = c.id
WHERE cum.status = 'approved' AND cum.contact_id IS NOT NULL;--> statement-breakpoint
DELETE FROM channel_user_mappings WHERE status IN ('approved', 'blocked');
