CREATE TABLE `record_trash` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`scope` text NOT NULL,
	`label` text,
	`created` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trash_class` ON `record_trash` (`class_id`);--> statement-breakpoint
DROP INDEX `class_label`;--> statement-breakpoint
ALTER TABLE `students` ADD `deleted_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `trash_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `class_label` ON `students` (`class_id`,`label`) WHERE "students"."deleted_at" = 0;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `word_group` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `modes` text DEFAULT '["text","voice","spelling"]' NOT NULL;