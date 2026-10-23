import { prisma } from "@/lib/prisma";

/**
 * The review tables are created on first use, so the site works whether or not the host's deploy runs
 * migrations. Same SQL as prisma/migrations/20261022120000_reviews and 20261024120000_review_requests.
 */
const CREATE_REVIEW = `CREATE TABLE IF NOT EXISTS \`Review\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`productId\` VARCHAR(191) NULL,
    \`authorName\` VARCHAR(100) NOT NULL,
    \`authorCity\` VARCHAR(100) NULL,
    \`rating\` INTEGER NOT NULL,
    \`title\` VARCHAR(150) NULL,
    \`body\` TEXT NOT NULL,
    \`source\` ENUM('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'IN_STORE', 'EMAIL', 'OTHER') NOT NULL DEFAULT 'WEBSITE',
    \`status\` ENUM('PENDING', 'APPROVED', 'HIDDEN') NOT NULL DEFAULT 'PENDING',
    \`verifiedPurchase\` BOOLEAN NOT NULL DEFAULT false,
    \`featured\` BOOLEAN NOT NULL DEFAULT false,
    \`featuredPosition\` INTEGER NOT NULL DEFAULT 0,
    \`isSample\` BOOLEAN NOT NULL DEFAULT false,
    \`userId\` VARCHAR(191) NULL,
    \`email\` VARCHAR(191) NULL,
    \`reviewedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    INDEX \`Review_productId_status_idx\`(\`productId\`, \`status\`),
    INDEX \`Review_featured_status_idx\`(\`featured\`, \`status\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`Review_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`Product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`ReviewSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`minReviewsForStars\` INTEGER NOT NULL DEFAULT 1,
    \`minSoldToShow\` INTEGER NOT NULL DEFAULT 10,
    \`allowCustomerReviews\` BOOLEAN NOT NULL DEFAULT true,
    \`autoApprove\` BOOLEAN NOT NULL DEFAULT false,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_PRIOR_SALES = `CREATE TABLE IF NOT EXISTS \`PriorSales\` (
    \`productId\` VARCHAR(191) NOT NULL,
    \`units\` INTEGER NOT NULL DEFAULT 0,
    \`note\` VARCHAR(200) NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`productId\`),
    CONSTRAINT \`PriorSales_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`Product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_REVIEW_REQUEST = `CREATE TABLE IF NOT EXISTS \`ReviewRequest\` (
    \`orderId\` VARCHAR(191) NOT NULL,
    \`emailedAt\` DATETIME(3) NULL,
    \`whatsappAt\` DATETIME(3) NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`orderId\`),
    CONSTRAINT \`ReviewRequest_orderId_fkey\` FOREIGN KEY (\`orderId\`) REFERENCES \`Order\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

let ready: Promise<void> | null = null;

/** Creates the review, prior-sales and review-request tables if they don't exist yet (once per server process). */
export function ensureReviewTables(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(CREATE_REVIEW);
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
    await prisma.$executeRawUnsafe(CREATE_PRIOR_SALES);
    await prisma.$executeRawUnsafe(CREATE_REVIEW_REQUEST);
  })().catch((err) => {
    ready = null; // try again on the next request
    throw err;
  });
  return ready;
}

export type ReviewSettingsData = {
  minReviewsForStars: number;
  minSoldToShow: number;
  allowCustomerReviews: boolean;
  autoApprove: boolean;
};

export const DEFAULT_REVIEW_SETTINGS: ReviewSettingsData = {
  minReviewsForStars: 1,
  minSoldToShow: 10,
  allowCustomerReviews: true,
  autoApprove: false,
};

export async function getReviewSettings(): Promise<ReviewSettingsData> {
  try {
    await ensureReviewTables();
    const row = await prisma.reviewSettings.findUnique({ where: { id: "singleton" } });
    return row
      ? {
          minReviewsForStars: row.minReviewsForStars,
          minSoldToShow: row.minSoldToShow,
          allowCustomerReviews: row.allowCustomerReviews,
          autoApprove: row.autoApprove,
        }
      : DEFAULT_REVIEW_SETTINGS;
  } catch (err) {
    console.error("[reviews] Couldn't read review settings; using defaults.", err);
    return DEFAULT_REVIEW_SETTINGS;
  }
}

/** Sample reviews (local design preview) are only visible when SHOW_SAMPLE_REVIEWS=true. */
export function showSampleReviews(): boolean {
  return process.env.SHOW_SAMPLE_REVIEWS === "true";
}

/** Prisma filter for reviews shoppers may see. */
export function visibleReviewWhere() {
  return { status: "APPROVED" as const, ...(showSampleReviews() ? {} : { isSample: false }) };
}
