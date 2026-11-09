-- Admin → Analytics → Heatmaps (also created at runtime by src/lib/analytics/heatmap.ts).
CREATE TABLE IF NOT EXISTS `HeatmapClick` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `day` DATE NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `device` VARCHAR(8) NOT NULL,
    `selector` VARCHAR(512) NOT NULL,
    `rx` SMALLINT NOT NULL,
    `ry` SMALLINT NOT NULL,
    `x` SMALLINT NOT NULL,
    `y` INTEGER NOT NULL,
    `label` VARCHAR(80) NULL,
    INDEX `HeatmapClick_path_device_day_idx`(`path`, `device`, `day`),
    INDEX `HeatmapClick_day_idx`(`day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HeatmapView` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `day` DATE NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `device` VARCHAR(8) NOT NULL,
    `depth` TINYINT NOT NULL,
    INDEX `HeatmapView_path_device_day_idx`(`path`, `device`, `day`),
    INDEX `HeatmapView_day_idx`(`day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
