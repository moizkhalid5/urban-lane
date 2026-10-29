-- Easypaisa and JazzCash at checkout (also applied at runtime by src/lib/payments/settings.ts)
ALTER TABLE `Order` MODIFY `paymentMethod` ENUM('COD', 'BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'CARD', 'STRIPE', 'PAYPAL', 'SAFEPAY', 'PAYFAST') NOT NULL;

CREATE TABLE IF NOT EXISTS `PaymentSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `easypaisaEnabled` BOOLEAN NOT NULL DEFAULT true,
    `easypaisaNumber` VARCHAR(191) NULL,
    `easypaisaName` VARCHAR(191) NULL,
    `jazzcashEnabled` BOOLEAN NOT NULL DEFAULT true,
    `jazzcashNumber` VARCHAR(191) NULL,
    `jazzcashName` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
