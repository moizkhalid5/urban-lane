-- Winter Collection: the homepage winter banner pointed at /collections/men. It now opens a
-- seasonal collection of men's and women's winter clothing.
-- Safe to run more than once, and safe to paste into phpMyAdmin if migrations don't run on deploy.

-- 1. The category. Hidden from the main menu and the homepage category tiles; reached from the banner.
INSERT INTO `Category` (`id`, `name`, `slug`, `description`, `parentId`, `level`, `position`, `image`,
                        `isActive`, `showInNav`, `isVirtual`, `seoTitle`, `seoDescription`, `createdAt`, `updatedAt`)
SELECT 'cat_winter_collection', 'Winter Collection', 'winter',
       'Coats, jackets, hoodies and knitwear for men and women.',
       NULL, 0, 90, NULL, true, false, false,
       'Winter Collection',
       'Shop the Urban Lane winter collection: coats, jackets, hoodies and knitwear for men and women.',
       CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `Category` WHERE `slug` = 'winter');

-- 2a. Men's and women's products already filed under winter sub-categories.
INSERT IGNORE INTO `ProductCategory` (`productId`, `categoryId`)
SELECT DISTINCT pc.`productId`, w.`id`
FROM `ProductCategory` pc
JOIN `Category` c ON c.`id` = pc.`categoryId`
JOIN `Category` w ON w.`slug` = 'winter'
WHERE (c.`slug` LIKE 'men-%' OR c.`slug` LIKE 'women-%')
  AND (c.`slug` LIKE '%coats-and-jackets%' OR c.`slug` LIKE '%hoodies%' OR c.`slug` LIKE '%knitwear%'
       OR c.`slug` LIKE '%jumpers%' OR c.`slug` LIKE '%sweatshirts%');

-- 2b. Men's and women's winter pieces by name (jumpers, knitwear, fleeces...), wherever they are filed.
--     Suit jackets and padded bras are deliberately not matched.
INSERT IGNORE INTO `ProductCategory` (`productId`, `categoryId`)
SELECT DISTINCT p.`id`, w.`id`
FROM `Product` p
JOIN `ProductCategory` pc ON pc.`productId` = p.`id`
JOIN `Category` d ON d.`id` = pc.`categoryId` AND d.`slug` IN ('men', 'women')
JOIN `Category` w ON w.`slug` = 'winter'
WHERE LOWER(p.`title`) REGEXP 'jumper|knit|cardigan|sweater|fleece|sweatshirt|hoodie|puffer|gilet|parka|thermal|thinsulate'
  AND LOWER(p.`title`) NOT REGEXP 'bra';

-- 3. Point the winter banner at the new collection.
UPDATE `Banner`
SET `link` = '/collections/winter', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `kind` = 'PROMO' AND `image` = '/images/banners/winter.jpg';
