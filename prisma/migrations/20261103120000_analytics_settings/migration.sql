-- Google Analytics and Microsoft Clarity IDs (also applied at runtime by src/lib/analytics/settings.ts)
CREATE TABLE IF NOT EXISTS `AnalyticsSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `gaMeasurementId` VARCHAR(20) NULL,
    `clarityProjectId` VARCHAR(20) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
