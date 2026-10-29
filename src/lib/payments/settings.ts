import { cache } from "react";
import type { PaymentSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * Easypaisa and JazzCash: the customer sends the order total to the store's wallet number and sends the
 * receipt on WhatsApp; the order waits as payment PENDING until someone marks it paid. The numbers live in
 * PaymentSettings (Admin → Settings → Payments).
 *
 * The table and the two new payment methods are set up on first use (same SQL as
 * prisma/migrations/20261029120000_mobile_wallets), because the host's deploy doesn't run migrations.
 */
const PAYMENT_METHODS = ["COD", "BANK_TRANSFER", "EASYPAISA", "JAZZCASH", "CARD", "STRIPE", "PAYPAL", "SAFEPAY", "PAYFAST"];

const ALTER_ORDER_METHOD = `ALTER TABLE \`Order\` MODIFY \`paymentMethod\` ENUM(${PAYMENT_METHODS.map((m) => `'${m}'`).join(", ")}) NOT NULL`;

const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`PaymentSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`easypaisaEnabled\` BOOLEAN NOT NULL DEFAULT true,
    \`easypaisaNumber\` VARCHAR(191) NULL,
    \`easypaisaName\` VARCHAR(191) NULL,
    \`jazzcashEnabled\` BOOLEAN NOT NULL DEFAULT true,
    \`jazzcashNumber\` VARCHAR(191) NULL,
    \`jazzcashName\` VARCHAR(191) NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** The store's wallet numbers, filled in the first time (they can be changed in Admin → Settings). */
const DEFAULT_EASYPAISA = "0332-5253799";
const DEFAULT_JAZZCASH = "0323-7395946";

/** The COD limit everyone got by default (Rs 10,000), and the dummy bank details from the sample data. */
const OLD_DEFAULT_COD_LIMIT = 1_000_000;
const SAMPLE_BANK_DETAILS = "0000-0000-0000";

let ready: Promise<void> | null = null;
export function ensurePaymentTables(): Promise<void> {
  ready ??= (async () => {
    const [column] = await prisma.$queryRawUnsafe<{ type: string }[]>(
      "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentMethod'",
    );
    if (column && !String(column.type).includes("'JAZZCASH'")) await prisma.$executeRawUnsafe(ALTER_ORDER_METHOD);
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
    await setUpOnce();
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/**
 * Once per database: adds the wallet numbers, offers cash on delivery for every order (the old Rs 10,000
 * default limit hid it from most orders) and removes the dummy bank details, so Bank Transfer stays hidden
 * until real account details are entered. A limit or bank details set in Admin are left alone.
 */
async function setUpOnce(): Promise<void> {
  const done = await prisma.auditLog.findFirst({ where: { action: "payments.setup" }, select: { id: true } });
  if (done) return;
  await prisma.paymentSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", easypaisaNumber: DEFAULT_EASYPAISA, jazzcashNumber: DEFAULT_JAZZCASH },
  });
  const site = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const codUnlimited = site?.codLimitCents === OLD_DEFAULT_COD_LIMIT;
  const bankCleared = !!site?.bankTransferInstructions?.includes(SAMPLE_BANK_DETAILS);
  if (site && (codUnlimited || bankCleared)) {
    await prisma.siteSettings.update({
      where: { id: "singleton" },
      data: { ...(codUnlimited && { codLimitCents: 0 }), ...(bankCleared && { bankTransferInstructions: null }) },
    });
  }
  await logAudit(undefined, "payments.setup", "PaymentSettings", "singleton", { codUnlimited, bankCleared });
}

/** Per-request cached. */
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  await ensurePaymentTables();
  const row = await prisma.paymentSettings.findUnique({ where: { id: "singleton" } });
  return row ?? prisma.paymentSettings.create({ data: { id: "singleton" } });
});
