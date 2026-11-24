import Link from "next/link";
import { brand } from "@/config/brand";
import { SiteFooter } from "@/components/site-footer";

const STEPS = [
  {
    title: "Connect your Google profile",
    text: "You sign in with Google once and allow us to manage your Business Profile. You can remove our access at any time.",
  },
  {
    title: "We do the work",
    text: "Our team checks your profile, writes updates with your photos, replies to reviews, and keeps your details correct.",
  },
  {
    title: "You approve, then it goes live",
    text: "Every post is sent to you first. Nothing is published on your profile until you approve it.",
  },
];

export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-16 sm:px-8">
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight">{brand.name}</h1>
          <p className="text-xl">{brand.tagline}</p>
          <p className="text-ink-muted max-w-prose">
            {brand.name} is a managed Google Business Profile service for local businesses in India,
            run by {brand.legal.name}. We help your business show up on Google Search and Maps and
            turn more searches into calls and visits.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="bg-primary text-primary-ink rounded-lg px-4 py-2.5 font-semibold"
            >
              Sign in
            </Link>
            <a
              href={`mailto:${brand.legal.contactEmail}`}
              className="border-line hover:bg-surface rounded-lg border px-4 py-2.5 font-medium"
            >
              Talk to us
            </a>
          </div>
        </header>

        <section aria-labelledby="how" className="flex flex-col gap-4">
          <h2 id="how" className="text-xl font-bold">
            How it works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-line bg-surface rounded-2xl border p-5">
                <p className="text-primary text-sm font-semibold">Step {i + 1}</p>
                <p className="mt-1 font-semibold">{s.title}</p>
                <p className="text-ink-muted mt-1 text-sm">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="google-data"
          className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-6"
        >
          <h2 id="google-data" className="text-xl font-bold">
            How we use your Google data
          </h2>
          <p className="text-sm leading-relaxed">
            When you connect your Google account, we ask for permission to manage your Google
            Business Profile. We use it only to provide this service to you: to read your profile
            details, reviews, photos, posts and performance numbers so we can show them to you and
            improve your profile; to publish posts you have approved; and to reply to reviews on
            your behalf.
          </p>
          <p className="text-sm leading-relaxed">
            We don&apos;t sell your data, use it for advertising, or share it beyond the service
            providers that run {brand.name}. You can remove our access at any time from your Google
            account. Read the details in our{" "}
            <Link href="/privacy" className="text-primary font-medium hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
