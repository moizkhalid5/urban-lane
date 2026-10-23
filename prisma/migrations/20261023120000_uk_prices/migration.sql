-- Real UK retail prices per product, and the pound-to-rupee rate used to show them. Safe to run more
-- than once, and safe to paste into phpMyAdmin. The site also creates these tables itself on first use
-- (src/lib/pricing/uk-price.ts).
CREATE TABLE IF NOT EXISTS `UkPrice` (
    `productId` VARCHAR(191) NOT NULL,
    `pence` INTEGER NOT NULL,
    `source` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`productId`),
    CONSTRAINT `UkPrice_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PricingSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `gbpToPkr` DOUBLE NOT NULL DEFAULT 360,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
