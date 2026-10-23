import { getSiteSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth/guards";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { GbpRateForm } from "@/components/admin/GbpRateForm";
import { getGbpToPkr } from "@/lib/pricing/uk-price";

export const dynamic = "force-dynamic";

const major = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));

export default async function AdminSettingsPage() {
  await requireAdmin(); // settings are ADMIN-only
  const [s, gbpToPkr] = await Promise.all([getSiteSettings(), getGbpToPkr()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Settings</h1>
      <SettingsForm
        initial={{
          storeName: s.storeName,
          storeEmail: s.storeEmail,
          supportPhone: s.supportPhone ?? "",
          baseCurrency: s.baseCurrency,
          enableCOD: s.enableCOD,
          enableBankTransfer: s.enableBankTransfer,
          enableCard: s.enableCard,
          enablePaypal: s.enablePaypal,
          codLimit: major(s.codLimitCents),
          freeShippingThreshold: major(s.freeShippingThresholdCents),
          flatShipping: major(s.flatShippingCents),
          bankTransferInstructions: s.bankTransferInstructions ?? "",
          announcementText: s.announcementText ?? "",
        }}
      />
      <GbpRateForm initial={gbpToPkr} />
    </div>
  );
}
