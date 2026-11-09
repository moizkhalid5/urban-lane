import { getSiteSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth/guards";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { GbpRateForm } from "@/components/admin/GbpRateForm";
import { getGbpToPkr } from "@/lib/pricing/uk-price";
import { BundleForm } from "@/components/admin/BundleForm";
import { getBundleConfig } from "@/lib/bundles";
import { MailSettingsForm } from "@/components/admin/MailSettingsForm";
import { getRoles, mailboxesForSettings, MAIL_SERVER, ROLES } from "@/lib/mail/accounts";
import { getPaymentSettings } from "@/lib/payments/settings";
import { AnalyticsForm } from "@/components/admin/AnalyticsForm";
import { ReportAccessForm } from "@/components/admin/ReportAccessForm";
import { getAnalyticsIds, getReportAccessSummary } from "@/lib/analytics/settings";

export const dynamic = "force-dynamic";

const major = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));

export default async function AdminSettingsPage() {
  await requireAdmin(); // settings are ADMIN-only
  const wallets = await getPaymentSettings(); // first, as it sets up the payment settings the first time
  const [s, gbpToPkr, bundles, analytics, reportAccess, mailboxes, mailRoles] = await Promise.all([
    getSiteSettings(),
    getGbpToPkr(),
    getBundleConfig(),
    getAnalyticsIds(),
    getReportAccessSummary(),
    mailboxesForSettings(),
    getRoles(),
  ]);

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
          easypaisaEnabled: wallets.easypaisaEnabled,
          easypaisaNumber: wallets.easypaisaNumber ?? "",
          easypaisaName: wallets.easypaisaName ?? "",
          jazzcashEnabled: wallets.jazzcashEnabled,
          jazzcashNumber: wallets.jazzcashNumber ?? "",
          jazzcashName: wallets.jazzcashName ?? "",
          announcementText: s.announcementText ?? "",
        }}
      />
      <MailSettingsForm mailboxes={mailboxes} roles={ROLES} assigned={mailRoles} webmail={MAIL_SERVER.webmail} />
      <GbpRateForm initial={gbpToPkr} />
      <BundleForm initial={bundles} />
      <AnalyticsForm
        initial={{ gaMeasurementId: analytics.gaMeasurementId ?? "", clarityProjectId: analytics.clarityProjectId ?? "" }}
      />
      <ReportAccessForm initial={reportAccess} />
    </div>
  );
}
