-- Homepage hanging rail (also created at runtime by src/lib/rail/db.ts)
CREATE TABLE IF NOT EXISTS `RailCollection` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RailItem` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `collectionId` VARCHAR(191) NULL,
    `frontImage` VARCHAR(500) NOT NULL,
    `sideImage` VARCHAR(500) NOT NULL,
    `word` VARCHAR(20) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `RailItem_isActive_position_idx`(`isActive`, `position`),
    INDEX `RailItem_collectionId_idx`(`collectionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RailItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `RailItem_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `RailCollection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RailSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `placement` VARCHAR(40) NOT NULL DEFAULT 'after-hero',
    `heading` VARCHAR(80) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
