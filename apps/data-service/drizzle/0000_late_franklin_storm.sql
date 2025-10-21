CREATE TABLE `geo_link_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`country` text NOT NULL,
	`time` integer NOT NULL
);
