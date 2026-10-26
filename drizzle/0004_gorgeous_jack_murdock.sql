CREATE TABLE `racers` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`label` text NOT NULL,
	`number` integer NOT NULL,
	`token_hash` text NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`last_seen` integer NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `race_label` ON `racers` (`race_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `race_number` ON `racers` (`race_id`,`number`);--> statement-breakpoint
CREATE INDEX `racers_race` ON `racers` (`race_id`);--> statement-breakpoint
CREATE TABLE `races` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`tasks` text NOT NULL,
	`remaining_ms` integer DEFAULT 360000 NOT NULL,
	`started_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
