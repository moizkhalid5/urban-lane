import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Urban Lane collects, uses and protects your data.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PageShell title="Privacy Policy" intro="Your privacy matters to us. This policy explains what we collect and why.">
      <h2>Information we collect</h2>
      <p>We collect information you provide when you create an account, place an order or contact us — such as your name, email, phone number and delivery address. We also collect limited technical data to operate and secure the site.</p>
      <h2>How we use it</h2>
      <p>We use your information to process orders, provide customer support, send transactional emails and — with your consent — marketing updates. We never sell your personal data.</p>
      <h2>Cookies and analytics</h2>
      <p>We use Google Analytics and Microsoft Clarity to understand how our shop is used: which pages and products are viewed, what is added to the bag and bought, and how visitors move around a page (Clarity records clicks, taps and scrolling as anonymous replays and heatmaps). Text you type into forms is hidden from these recordings. Both tools use cookies.</p>
      <p>If you are in the UK, the EEA or Switzerland, we only use these cookies after you accept them. Wherever you are, you can accept or reject them at any time under &ldquo;Cookie settings&rdquo; at the bottom of every page. We do not use advertising cookies.</p>
      <h2>Payments</h2>
      <p>We do not store card details. Card payments are processed by our payment providers under their own secure systems.</p>
      <h2>Your rights</h2>
      <p>You can request access to, correction of, or deletion of your personal data at any time by contacting us.</p>
      <h2>Contact</h2>
      <p>For privacy questions, please <a href="/contact">contact us</a>.</p>
    </PageShell>
  );
}
