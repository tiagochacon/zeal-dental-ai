ALTER TABLE `consultations` ADD `attendanceStatus` enum('unknown','attended','missed') DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `consultations` ADD `attendanceMarkedAt` timestamp;--> statement-breakpoint
ALTER TABLE `consultations` ADD `attendanceMarkedByUserId` int;