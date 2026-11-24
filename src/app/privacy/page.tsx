import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { ContactBlock, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${brand.name} (${brand.legal.name}) collects, uses and protects your data.`,
};

const b = brand.name;
const co = brand.legal.name;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        {b} is a service run by {co} (&quot;we&quot;, &quot;us&quot;). This policy explains what
        personal data we collect when you use {b}, why, who we share it with, and the choices and
        rights you have. It is written to meet India&apos;s Digital Personal Data Protection Act,
        2023 and the Information Technology Act, 2000 and its rules.
      </p>

      <h2>Who this covers</h2>
      <ul>
        <li>
          <strong>Business owners</strong> who use {b} for their business, and their staff.
        </li>
        <li>
          <strong>Our team members</strong> who manage clients in {b}.
        </li>
        <li>
          <strong>Customers of our clients</strong> who use a business&apos;s review page, QR code
          or digital card made with {b}.
        </li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name and email address, so you can sign in.
        </li>
        <li>
          <strong>Business details:</strong> business name, owner name, WhatsApp number, preferred
          language, and your consent to receive WhatsApp messages from us.
        </li>
        <li>
          <strong>Google Business Profile data</strong>, only after you connect your Google account
          and allow it: your profile information (name, address, phone, website, hours, categories,
          services, attributes, description), reviews and our replies, photos and posts, and
          performance numbers such as profile views, calls, direction requests and website clicks.
        </li>
        <li>
          <strong>Content you give us:</strong> photos you upload, change requests, support messages
          and your answers to post approvals.
        </li>
        <li>
          <strong>From your customers:</strong> if a customer leaves private feedback on a
          business&apos;s review page, we store their rating, message and any contact details they
          choose to give, and show them to that business. Taps on a digital card are counted without
          identifying the person.
        </li>
        <li>
          <strong>Technical data:</strong> sign-in records and basic logs needed to keep the service
          secure and working.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>
          To provide the service you asked for: managing and improving your Google Business Profile.
        </li>
        <li>To show you your profile score, reviews, performance numbers and reports.</li>
        <li>
          To prepare posts and send them to you for approval, and to publish only the posts you
          approve.
        </li>
        <li>To reply to reviews on your behalf.</li>
        <li>
          To contact you about your account, approvals and support requests, including on WhatsApp
          if you agreed to it.
        </li>
        <li>To keep the service secure and to meet legal obligations.</li>
      </ul>
      <p>
        We use your data on the basis of your consent and to perform our service agreement with you.
        We do not sell personal data and we do not use it for advertising.
      </p>

      <h2>Google user data</h2>
      <p>
        When you connect Google, {b} asks for the <code className="text-sm">business.manage</code>{" "}
        permission. We use the data we receive from Google only to provide the features described
        above for your own business: to read and display your profile, reviews, photos, posts and
        performance numbers, to publish posts you approve, and to reply to reviews. We do not use
        Google user data to develop or train general AI models, and we do not transfer it to others
        except the service providers listed below that run {b}, as needed to provide the service, or
        when the law requires it.
      </p>
      <p>
        {b}&apos;s use and transfer of information received from Google APIs to any other app will
        adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="text-primary hover:underline"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <p>
        You can remove {b}&apos;s access at any time at{" "}
        <a href="https://myaccount.google.com/permissions" className="text-primary hover:underline">
          myaccount.google.com/permissions
        </a>
        . We keep the Google sign-in token encrypted and use it only to act on your profile.
      </p>

      <h2>Who we share it with</h2>
      <p>We use trusted service providers who process data for us under contract:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: database, file storage and sign-in (servers in India).
        </li>
        <li>
          <strong>Vercel</strong>: website hosting.
        </li>
        <li>
          <strong>Google</strong>: the Business Profile APIs that read and update your profile, and
          Maps search data for ranking reports.
        </li>
        <li>
          <strong>Resend</strong>: sending sign-in and invitation emails.
        </li>
        <li>
          <strong>Meta (WhatsApp)</strong>: sending approval requests and updates on WhatsApp, if
          you agreed to receive them.
        </li>
        <li>
          <strong>Anthropic</strong>: helping our team draft post text and profile suggestions from
          your business details. Its output is always reviewed by our team and approved by you
          before anything is published.
        </li>
      </ul>
      <p>
        Some of these providers may process data outside India. We will share data with authorities
        only when the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while you use {b}. When the service ends, or when you ask us to delete
        your data, we delete it or make it anonymous within 90 days, unless the law requires us to
        keep some of it for longer (for example, billing records).
      </p>

      <h2>How we protect it</h2>
      <p>
        Data is sent over encrypted connections. Access is limited by role: a business owner sees
        only their own business, and a manager sees only the clients assigned to them. Google
        sign-in tokens are stored encrypted. No system is perfectly secure, but we work to protect
        your data and will tell you and the authorities about a breach as the law requires.
      </p>

      <h2>Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you and how we use it;</li>
        <li>correct or update it;</li>
        <li>
          delete it, or withdraw your consent (this may mean we can no longer provide the service);
        </li>
        <li>nominate someone to act for you if you die or become unable to act.</li>
      </ul>
      <p>
        Email us at the address below. We will reply as soon as we can and within the time the law
        allows.
      </p>

      <h2>Children</h2>
      <p>{b} is for businesses and is not meant for anyone under 18.</p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date at the top and, for important changes,
        tell you by email or in the app.
      </p>

      <h2>Contact and grievances</h2>
      <p>
        For questions, requests or complaints about your data, contact our{" "}
        {brand.legal.grievanceOfficer}:
      </p>
      <ContactBlock />
      <p>
        If you are not satisfied with our answer, you may complain to the Data Protection Board of
        India. See also our{" "}
        <Link href="/terms" className="text-primary hover:underline">
          terms of service
        </Link>
        .
      </p>
    </LegalPage>
  );
}
