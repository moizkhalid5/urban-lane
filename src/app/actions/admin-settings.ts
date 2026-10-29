"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { settingsInputSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { ensurePaymentTables } from "@/lib/payments/settings";

export type SettingsResult = { ok: boolean; message?: string };

/** Update store settings. ADMIN only (payment toggles, COD limit, shipping, etc.). */
export async function updateSettings(input: unknown): Promise<SettingsResult> {
  const user = await requireAdmin();
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings." };
  const d = parsed.data;

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {
      storeName: d.storeName,
      storeEmail: d.storeEmail,
      supportPhone: d.supportPhone || null,
      baseCurrency: d.baseCurrency,
      enableCOD: d.enableCOD,
      enableBankTransfer: d.enableBankTransfer,
      enableCard: d.enableCard,
      enablePaypal: d.enablePaypal,
      codLimitCents: d.codLimitCents,
      freeShippingThresholdCents: d.freeShippingThresholdCents ?? null,
      flatShippingCents: d.flatShippingCents,
      bankTransferInstructions: d.bankTransferInstructions || null,
      announcementText: d.announcementText || null,
    },
    create: {
      id: "singleton",
      storeName: d.storeName,
      storeEmail: d.storeEmail,
      supportPhone: d.supportPhone || null,
      baseCurrency: d.baseCurrency,
      enableCOD: d.enableCOD,
      enableBankTransfer: d.enableBankTransfer,
      enableCard: d.enableCard,
      enablePaypal: d.enablePaypal,
      codLimitCents: d.codLimitCents,
      freeShippingThresholdCents: d.freeShippingThresholdCents ?? null,
      flatShippingCents: d.flatShippingCents,
      bankTransferInstructions: d.bankTransferInstructions || null,
      announcementText: d.announcementText || null,
    },
  });

  const wallets = {
    easypaisaEnabled: d.easypaisaEnabled,
    easypaisaNumber: d.easypaisaNumber || null,
    easypaisaName: d.easypaisaName || null,
    jazzcashEnabled: d.jazzcashEnabled,
    jazzcashNumber: d.jazzcashNumber || null,
    jazzcashName: d.jazzcashName || null,
  };
  await ensurePaymentTables();
  await prisma.paymentSettings.upsert({ where: { id: "singleton" }, update: wallets, create: { id: "singleton", ...wallets } });

  await logAudit(user.id, "settings.update", "SiteSettings", "singleton");
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
