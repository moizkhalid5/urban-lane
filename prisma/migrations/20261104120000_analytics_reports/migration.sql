-- Admin → Analytics reports (also applied at runtime by src/lib/analytics/settings.ts)
ALTER TABLE `AnalyticsSettings` ADD COLUMN `gaPropertyId` VARCHAR(20) NULL,
    ADD COLUMN `gaServiceKey` TEXT NULL,
    ADD COLUMN `clarityApiToken` TEXT NULL;

CREATE TABLE IF NOT EXISTS `AnalyticsCache` (
    `key` VARCHAR(191) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
