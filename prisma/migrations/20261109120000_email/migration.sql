-- The shop's email: mailboxes, which mailbox does which job, Admin → Inbox and Admin → Marketing. Safe to
-- run more than once, and safe to paste into phpMyAdmin. The site also creates these tables itself on first
-- use (src/lib/mail/db.ts).
CREATE TABLE IF NOT EXISTS `MailAccount` (
    `address` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(80) NOT NULL DEFAULT 'Urban Lane',
    `password` TEXT NULL,
    `lastUid` INTEGER NOT NULL DEFAULT 0,
    `uidValidity` BIGINT NOT NULL DEFAULT 0,
    `lastSyncAt` DATETIME(3) NULL,
    `lastError` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`address`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MailSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `roles` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MailMessage` (
    `id` VARCHAR(191) NOT NULL,
    `mailbox` VARCHAR(191) NOT NULL,
    `uid` INTEGER NOT NULL,
    `messageId` VARCHAR(500) NULL,
    `fromName` VARCHAR(200) NULL,
    `fromAddress` VARCHAR(320) NOT NULL,
    `replyTo` VARCHAR(320) NULL,
    `toList` VARCHAR(1000) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `snippet` VARCHAR(300) NOT NULL,
    `text` MEDIUMTEXT NULL,
    `html` MEDIUMTEXT NULL,
    `attachments` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `repliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `MailMessage_mailbox_uid_key`(`mailbox`, `uid`),
    INDEX `MailMessage_date_idx`(`date`),
    INDEX `MailMessage_isRead_idx`(`isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketingCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `preheader` VARCHAR(200) NULL,
    `heading` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `buttonText` VARCHAR(60) NULL,
    `buttonUrl` VARCHAR(500) NULL,
    `audience` VARCHAR(20) NOT NULL DEFAULT 'both',
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketingSend` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'QUEUED',
    `error` VARCHAR(300) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `MarketingSend_campaignId_email_key`(`campaignId`, `email`),
    INDEX `MarketingSend_campaignId_status_idx`(`campaignId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
