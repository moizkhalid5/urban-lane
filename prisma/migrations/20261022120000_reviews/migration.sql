-- Product reviews, their display settings, and sales made before the website. Safe to run more than once, and safe to paste into
-- phpMyAdmin. The site also creates these tables itself on first use (src/lib/reviews/db.ts).
CREATE TABLE IF NOT EXISTS `Review` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `authorName` VARCHAR(100) NOT NULL,
    `authorCity` VARCHAR(100) NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(150) NULL,
    `body` TEXT NOT NULL,
    `source` ENUM('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'IN_STORE', 'EMAIL', 'OTHER') NOT NULL DEFAULT 'WEBSITE',
    `status` ENUM('PENDING', 'APPROVED', 'HIDDEN') NOT NULL DEFAULT 'PENDING',
    `verifiedPurchase` BOOLEAN NOT NULL DEFAULT false,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `featuredPosition` INTEGER NOT NULL DEFAULT 0,
    `isSample` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Review_productId_status_idx`(`productId`, `status`),
    INDEX `Review_featured_status_idx`(`featured`, `status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ReviewSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `minReviewsForStars` INTEGER NOT NULL DEFAULT 1,
    `minSoldToShow` INTEGER NOT NULL DEFAULT 10,
    `allowCustomerReviews` BOOLEAN NOT NULL DEFAULT true,
    `autoApprove` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PriorSales` (
    `productId` VARCHAR(191) NOT NULL,
    `units` INTEGER NOT NULL DEFAULT 0,
    `note` VARCHAR(200) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`productId`),
    CONSTRAINT `PriorSales_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
