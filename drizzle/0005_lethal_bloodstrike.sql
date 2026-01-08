CREATE TABLE `audioChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultationId` int NOT NULL,
	`recordingSessionId` varchar(64) NOT NULL,
	`chunkIndex` int NOT NULL,
	`fileKey` text NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(50) NOT NULL,
	`sizeBytes` int NOT NULL,
	`durationSeconds` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audioChunks_id` PRIMARY KEY(`id`)
);
