-- Colour bundles: settings, and the bundle saving on each order. Safe to run more than once, and safe to
-- paste into phpMyAdmin. The site also creates these tables itself on first use (src/lib/bundles.ts).
CREATE TABLE IF NOT EXISTS `BundleSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `minColours` INTEGER NOT NULL DEFAULT 3,
    `percentOff` INTEGER NOT NULL DEFAULT 10,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderBundle` (
    `orderId` VARCHAR(191) NOT NULL,
    `cents` INTEGER NOT NULL,
    `detail` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`orderId`),
    CONSTRAINT `OrderBundle_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
