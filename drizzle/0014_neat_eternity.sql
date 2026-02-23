CREATE TABLE `calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`crcId` int NOT NULL,
	`leadId` int NOT NULL,
	`leadName` varchar(255) NOT NULL,
	`audioUrl` text,
	`audioFileKey` text,
	`audioDurationSeconds` int,
	`transcript` text,
	`transcriptSegments` json,
	`neurovendasAnalysis` json,
	`schedulingResult` enum('scheduled','not_scheduled','callback','no_answer'),
	`schedulingNotes` text,
	`callStatus` enum('draft','transcribed','analyzed','finalized') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`finalizedAt` timestamp,
	CONSTRAINT `calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`ownerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`crcId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`source` varchar(100),
	`notes` text,
	`isConverted` boolean NOT NULL DEFAULT false,
	`convertedPatientId` int,
	`neurovendasAnalysis` json,
	`callProfile` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `consultations` ADD `treatmentClosed` boolean;--> statement-breakpoint
ALTER TABLE `consultations` ADD `treatmentClosedNotes` text;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `treatmentClosed` boolean;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `treatmentClosedNotes` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `clinicId` int;--> statement-breakpoint
ALTER TABLE `patients` ADD `createdByUserId` int;--> statement-breakpoint
ALTER TABLE `patients` ADD `originLeadId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `clinicId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `clinicRole` enum('gestor','crc','dentista');