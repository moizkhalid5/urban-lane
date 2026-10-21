-- Admin-uploaded images are stored in the database so redeploys can't delete them.
-- Safe to run more than once, and safe to paste into phpMyAdmin. The site also creates this table
-- itself on the first upload if it is missing (src/lib/storage/db-files.ts).
CREATE TABLE IF NOT EXISTS `StoredFile` (
    `key` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
