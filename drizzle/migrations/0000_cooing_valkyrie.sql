CREATE TABLE `checkin_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`recordDate` varchar(10) NOT NULL,
	`scheduledCount` int,
	`completedCount` int,
	`moodScore` int,
	`actionPlan` text,
	`workingHours` varchar(256),
	`morningNotes` text,
	`morningSubmittedAt` timestamp,
	`followupCount` int,
	`followupNotes` text,
	`followupSubmittedAt` timestamp,
	`disengagementCount` int,
	`disengagementNotes` text,
	`disengagementSubmittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkin_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_coach_date` UNIQUE(`coachId`,`recordDate`)
);
--> statement-breakpoint
CREATE TABLE `client_check_ins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`coachName` varchar(128) NOT NULL,
	`clientName` varchar(256) NOT NULL,
	`dayOfWeek` enum('monday','tuesday','wednesday','thursday','friday') NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`completedByUserId` int DEFAULT 0,
	`completedAt` timestamp,
	`clientSubmitted` tinyint DEFAULT 0,
	`clientSubmittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_check_ins_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_client_week_day` UNIQUE(`coachId`,`clientName`,`dayOfWeek`,`weekStart`)
);
--> statement-breakpoint
CREATE TABLE `client_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`clientName` varchar(256) NOT NULL,
	`rating` enum('green','yellow','red') NOT NULL,
	`notes` text,
	`ratedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_client_rating` UNIQUE(`coachId`,`clientName`)
);
--> statement-breakpoint
CREATE TABLE `coaches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`email` varchar(256),
	`userId` int,
	`slackUserId` varchar(64),
	`timezone` varchar(64) DEFAULT 'Australia/Melbourne',
	`reminderTimes` json,
	`workdays` json,
	`remindersEnabled` tinyint DEFAULT 1,
	`leaveStartDate` varchar(10),
	`leaveEndDate` varchar(10),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coaches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `excused_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`coachName` varchar(128) NOT NULL,
	`clientName` varchar(256) NOT NULL,
	`dayOfWeek` enum('monday','tuesday','wednesday','thursday','friday') NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`reason` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`submittedByUserId` int NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`slackMessageTs` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `excused_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_excused_client` UNIQUE(`coachId`,`clientName`,`dayOfWeek`,`weekStart`)
);
--> statement-breakpoint
CREATE TABLE `kudos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromUserId` int NOT NULL,
	`coachId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kudos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paused_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`pausedByUserId` int,
	`pausedAt` datetime,
	`resumedAt` datetime,
	CONSTRAINT `paused_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roster_client_starts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`coachName` varchar(128) NOT NULL,
	`clientName` varchar(256) NOT NULL,
	`dayOfWeek` enum('monday','tuesday','wednesday','thursday','friday') NOT NULL,
	`firstWeekStart` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roster_client_starts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_roster_client` UNIQUE(`coachId`,`clientName`,`dayOfWeek`)
);
--> statement-breakpoint
CREATE TABLE `roster_weekly_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`coachName` varchar(128) NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`snapshotJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roster_weekly_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_roster_snapshot` UNIQUE(`coachId`,`weekStart`)
);
--> statement-breakpoint
CREATE TABLE `sales_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(128) NOT NULL,
	`recordDate` varchar(10) NOT NULL,
	`moodScore` int,
	`intendedWorkingHours` varchar(128),
	`morningNotes` text,
	`morningSubmittedAt` timestamp,
	`howDayWent` text,
	`salesMade` int,
	`intendedHoursNextDay` varchar(128),
	`eveningNotes` text,
	`eveningSubmittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sales_user_date` UNIQUE(`userId`,`recordDate`)
);
--> statement-breakpoint
CREATE TABLE `slack_reminder_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`reminderDate` varchar(10) NOT NULL,
	`reminderIndex` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slack_reminder_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reminder_slot` UNIQUE(`coachId`,`reminderDate`,`reminderIndex`)
);
--> statement-breakpoint
CREATE TABLE `sweep_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdByName` varchar(256) NOT NULL,
	`snapshotJson` json NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`isSaved` tinyint NOT NULL DEFAULT 0,
	`scopeType` varchar(16) NOT NULL DEFAULT 'all',
	`scopeCoachId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sweep_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256),
	`email` varchar(256),
	`role` varchar(32) NOT NULL DEFAULT 'coach',
	`openId` varchar(256),
	`profileImageUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
