-- "How was your order?" review requests (also created at runtime by src/lib/reviews/db.ts)
CREATE TABLE IF NOT EXISTS `ReviewRequest` (
    `orderId` VARCHAR(191) NOT NULL,
    `emailedAt` DATETIME(3) NULL,
    `whatsappAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`orderId`),
    CONSTRAINT `ReviewRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
