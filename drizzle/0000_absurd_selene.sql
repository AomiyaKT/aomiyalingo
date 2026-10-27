CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	`word` text NOT NULL,
	`mode` text NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attempts_class` ON `attempts` (`class_id`);--> statement-breakpoint
CREATE INDEX `attempts_student` ON `attempts` (`student_id`);--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`lesson` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`last_seen` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_label` ON `students` (`class_id`,`label`);--> statement-breakpoint
CREATE INDEX `students_class` ON `students` (`class_id`);--> statement-breakpoint
CREATE TABLE `teacher_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
