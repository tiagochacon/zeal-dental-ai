CREATE TABLE `patientDentistAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`dentistId` int NOT NULL,
	`clinicId` int NOT NULL,
	`assignedByUserId` int,
	`scheduledAt` timestamp,
	`role` enum('primary','secondary') NOT NULL DEFAULT 'secondary',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patientDentistAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `calls` ADD `sourceType` enum('phone_call','audio_upload','whatsapp_export') DEFAULT 'phone_call';--> statement-breakpoint
ALTER TABLE `calls` ADD `whatsappImportData` json;--> statement-breakpoint
ALTER TABLE `calls` ADD `whatsappMediaSummary` json;--> statement-breakpoint
ALTER TABLE `patients` ADD `scheduledAt` timestamp;