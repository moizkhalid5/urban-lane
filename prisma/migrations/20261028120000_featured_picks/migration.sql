-- Homepage "Featured" product choices (also created at runtime by src/lib/featured.ts)
CREATE TABLE IF NOT EXISTS `FeaturedPick` (
    `id` VARCHAR(191) NOT NULL,
    `department` VARCHAR(20) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `FeaturedPick_department_productId_key`(`department`, `productId`),
    INDEX `FeaturedPick_department_position_idx`(`department`, `position`),
    PRIMARY KEY (`id`),
    CONSTRAINT `FeaturedPick_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
