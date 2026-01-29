CREATE TABLE `payment_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`userId` int,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`priceId` varchar(255),
	`productId` varchar(255),
	`planType` enum('trial','basic','pro','unlimited'),
	`amount` int,
	`currency` varchar(10),
	`status` enum('success','failed','duplicate','ignored') NOT NULL,
	`errorMessage` text,
	`rawPayload` json,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_logs_eventId_unique` UNIQUE(`eventId`)
);
