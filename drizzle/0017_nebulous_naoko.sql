ALTER TABLE `audioChunks` ADD `transcriptionStatus` enum('pending','transcribing','done','error') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `audioChunks` ADD `transcriptionError` text;--> statement-breakpoint
ALTER TABLE `audioChunks` ADD `transcribedAt` timestamp;