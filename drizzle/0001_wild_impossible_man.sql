CREATE TABLE `recovery_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`student_id` text,
	`created` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recovery_class` ON `recovery_requests` (`class_id`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `hint_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `is_review` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `accepting` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `paused` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `ended` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `round_size` integer DEFAULT 6 NOT NULL;