import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { ContactBlock, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for using ${brand.name}, a service of ${brand.legal.name}.`,
};

const b = brand.name;
const co = brand.legal.name;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are an agreement between you and {co} (&quot;we&quot;, &quot;us&quot;) for using{" "}
        {b}. By signing in or connecting your Google Business Profile, you agree to them. If you use{" "}
        {b} for a business, you confirm you are allowed to accept these terms for it.
      </p>

      <h2>The service</h2>
      <p>
        {b} is a managed Google Business Profile service. With your permission, our team checks and
        improves your profile, prepares posts, replies to reviews, and shows you reports. Fees, the
        length of the service and what is included are set out in your separate service agreement or
        invoice with us.
      </p>

      <h2>Your Google profile and your approval</h2>
      <ul>
        <li>
          You authorise us to manage your Google Business Profile for the purposes of the service,
          through Google&apos;s official tools, until you remove our access or the service ends.
        </li>
        <li>
          <strong>No post is published without your approval.</strong> We send each post to you
          first, and publish only what you approve.
        </li>
        <li>
          We reply to reviews on your behalf in a polite, factual way. You can ask us to change or
          remove any reply.
        </li>
        <li>
          You confirm that the business information, photos and other content you give us are
          accurate and that you have the right to use them.
        </li>
      </ul>

      <h2>Honest reviews only</h2>
      <p>
        We follow Google&apos;s policies. We will not post fake reviews, pay or reward customers for
        reviews, or hide unhappy customers from leaving a review on Google (&quot;review
        gating&quot;). You agree not to ask us to, and not to use {b} for it yourself.
      </p>

      <h2>Accounts</h2>
      <p>
        Access to {b} is by invitation. Keep your sign-in email secure and tell us if someone else
        may have used your account. We may suspend access that is misused or that puts other users
        or the service at risk.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use {b} to break the law or Google&apos;s terms, to post misleading or harmful
        content, to access data that isn&apos;t yours, or to disrupt the service.
      </p>

      <h2>Google and other services</h2>
      <p>
        Your Google Business Profile is a Google product and is also governed by Google&apos;s
        terms. Google decides what appears on Search and Maps, and may reject, change or remove
        content. We can&apos;t guarantee rankings, calls or any particular result.
      </p>

      <h2>Your data</h2>
      <p>
        Your business data stays yours. We use it only to provide the service, as described in our{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          privacy policy
        </Link>
        .
      </p>

      <h2>Ending the service</h2>
      <p>
        You can stop using {b} and remove our Google access at any time; any notice period or fees
        are set out in your service agreement. We may end the service if these terms are broken.
        When the service ends, we stop acting on your profile and handle your data as our privacy
        policy describes.
      </p>

      <h2>Liability</h2>
      <p>
        We provide {b} with reasonable care and skill. To the extent the law allows, we are not
        liable for indirect losses such as lost profits or business, or for actions taken by Google
        or other platforms. Our total liability for any claim is limited to the fees you paid us in
        the three months before the claim.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We will change the date at the top and tell you about important
        changes. If you keep using {b} after that, the new terms apply.
      </p>

      <h2>Law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Courts in {brand.legal.city}, Rajasthan have
        jurisdiction over any dispute.
      </p>

      <h2>Contact</h2>
      <ContactBlock />
    </LegalPage>
  );
}
