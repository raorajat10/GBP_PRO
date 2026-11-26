"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { sendPrivateFeedbackAction } from "./actions";
import { getSampleComments } from "@/lib/reviews/sample-comments";

type Language = "en" | "hi" | "hinglish";

type Topic = "Installation" | "Quality" | "Service" | "Support" | "Overall";

type SampleComment = {
  id: number;
  business: string;
  topic: Topic;
  language: string;
  style: string;
  text: string;
  /** Optional link for this example's button; defaults to the business's Google review link. */
  href?: string;
};

const TOPICS: Topic[] = ["Installation", "Quality", "Service", "Support", "Overall"];

const field =
  "border-line focus:border-primary focus:ring-primary/20 w-full rounded-xl border bg-transparent p-3 text-sm outline-none focus:ring-2";

function shuffle<T>(items: T[], seed: number): T[] {
  const array = [...items];
  let x = (seed * 2654435761 + 1) >>> 0;
  const next = () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/** JSON files may say "English"/"Hindi"/"Hinglish" or "en"/"hi"/"hi-en". */
function normaliseLanguage(value: string | undefined) {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "english" || v === "en") return "en";
  if (v === "hindi" || v === "hi") return "hi";
  if (v === "hinglish" || v === "hi-en") return "hi-en";
  return v;
}

function jsonLanguage(language: Language) {
  switch (language) {
    case "en":
      return "en";
    case "hi":
      return "hi";
    case "hinglish":
      return "hi-en";
  }
}

export function ReviewFlow({
  company,
  reviewUrl,
}: {
  company: { slug: string; name: string };
  reviewUrl: string | null;
}) {
  const [rating] = useState(0); // star box removed; kept for the draft and feedback steps
  const [draft, setDraft] = useState<string | null>(null);
  const [note] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);

  // Company-specific JSON comment bank
  const [allSamples, setAllSamples] = useState<SampleComment[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState(false);
  const [sampleFile, setSampleFile] = useState<{
    business?: string;
    description?: string;
    total?: number;
    min?: number;
    max?: number;
  } | null>(null);

  const [sampleTopic, setSampleTopic] = useState<Topic>("Overall");
  const [sampleLanguage, setSampleLanguage] = useState<Language>("en");

  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Load company-specific JSON automatically
  useEffect(() => {
    let cancelled = false;

    async function loadSamples() {
      setSamplesLoading(true);
      setSamplesError(false);
      setAllSamples([]);

      try {
        const data = await getSampleComments(company.slug);

        if (!data || !Array.isArray(data.templates)) {
          throw new Error("Invalid sample file");
        }

        if (!cancelled) {
          setAllSamples(data.templates);
          setShuffleSeed(Math.floor(Math.random() * 1_000_000));
          setSampleFile({
            business: data.business,
            description: data.description,
            total: data.total ?? data.templates.length,
            min: data.min_words_per_template,
            max: data.max_words_per_template,
          });
        }
      } catch {
        if (!cancelled) {
          setSamplesError(true);
          setAllSamples([]);
        }
      } finally {
        if (!cancelled) {
          setSamplesLoading(false);
        }
      }
    }

    loadSamples();

    return () => {
      cancelled = true;
    };
  }, [company.slug]);

  // Filter by topic and language
  const filteredSamples = useMemo(() => {
    const selectedLanguage = jsonLanguage(sampleLanguage);

    return allSamples.filter(
      (sample) =>
        sample.topic?.trim().toLowerCase() === sampleTopic.toLowerCase() &&
        normaliseLanguage(sample.language) === selectedLanguage,
    );
  }, [allSamples, sampleTopic, sampleLanguage]);

  // 5 examples in a mixed order; "Show 5 different examples" picks a new order
  const visibleSamples = useMemo(
    () => shuffle(filteredSamples, shuffleSeed).slice(0, 5),
    [filteredSamples, shuffleSeed],
  );

  function refreshSamples() {
    setShuffleSeed((s) => s + 1);
  }

  async function copyAndOpen() {
    if (!draft?.trim() || !reviewUrl) return;

    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
    } catch {
      setError("Couldn't copy automatically. Select the text and copy it yourself.");
    }

    window.open(reviewUrl, "_blank", "noopener");
  }

  return (
    <div className="grid gap-5">
      {/* Company-specific inspiration */}
      <section className="border-line bg-surface rounded-2xl border p-5">
        <div>
          <div>
            <p className="text-sm font-semibold">
              Review examples for {sampleFile?.business || company.name}
            </p>

            <p className="text-ink-muted mt-1 text-xs">
              {sampleFile?.description || "Ideas to help you describe your own experience"}
            </p>

            {sampleFile?.total != null && (
              <p className="text-ink-muted mt-1 text-xs">
                {sampleFile.total} examples
                {sampleFile.min != null && sampleFile.max != null
                  ? `, ${sampleFile.min}–${sampleFile.max} words each`
                  : ""}
              </p>
            )}
          </div>
        </div>

        {
          <div className="mt-4 grid gap-4">
            {/* Topic filter */}
            <div>
              <label className="mb-1 block text-xs font-medium">Topic</label>

              <select
                value={sampleTopic}
                onChange={(e) => setSampleTopic(e.target.value as Topic)}
                className="border-line bg-surface w-full rounded-xl border px-3 py-2 text-sm"
              >
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            {/* Language filter */}
            <div>
              <label className="mb-1 block text-xs font-medium">Example language</label>

              <select
                value={sampleLanguage}
                onChange={(e) => setSampleLanguage(e.target.value as Language)}
                className="border-line bg-surface w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>

            {samplesLoading ? (
              <p className="text-ink-muted text-sm">Loading examples…</p>
            ) : samplesError ? (
              <p className="text-ink-muted text-sm">
                Examples aren&apos;t available for this business yet.
              </p>
            ) : filteredSamples.length === 0 ? (
              <p className="text-ink-muted text-sm">
                No examples found for this topic and language.
              </p>
            ) : (
              <>
                <div className="grid gap-3">
                  {visibleSamples.map((sample) => (
                    <article
                      key={`${sample.id}-${sample.topic}-${sample.language}`}
                      className="border-line rounded-xl border p-3"
                    >
                      <p className="text-primary text-xs font-semibold">
                        {sample.topic}
                        {sample.style && (
                          <span className="text-ink-muted font-normal"> ({sample.style})</span>
                        )}
                      </p>

                      <p className="mt-2 text-sm leading-relaxed">{sample.text}</p>

                      {(sample.href || reviewUrl) && (
                        <a
                          href={sample.href || reviewUrl || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-primary text-primary-ink mt-3 inline-block rounded-xl px-4 py-2 text-sm font-semibold"
                        >
                          Write your review on Google
                        </a>
                      )}
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={refreshSamples}
                  className="border-line rounded-xl border px-3 py-2 text-sm font-medium"
                >
                  Show 5 different examples
                </button>
              </>
            )}

            <p className="text-ink-muted text-xs">
              These are illustrative examples, not customer testimonials. Please write your own
              review based on your actual experience.
            </p>
          </div>
        }
      </section>

      {/* 3. Review draft */}
      {draft !== null && (
        <section
          className="border-line bg-surface grid gap-3 rounded-2xl border p-5"
          aria-live="polite"
        >
          <p className="text-primary text-sm font-semibold">03 / Check and post</p>

          {note && <p className="bg-accent-soft rounded-lg px-3 py-2 text-xs">{note}</p>}

          <textarea
            aria-label="Your review"
            rows={6}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={field}
          />

          {reviewUrl ? (
            <>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={copyAndOpen}
                className="bg-ink text-surface rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {copied ? "Copied — paste it on Google" : "Copy & open Google"}
              </button>

              <p className="text-ink-muted text-xs">
                On Google: choose your {rating} star
                {rating > 1 ? "s" : ""}, paste your review, and post. Google shows your name with
                the review.
              </p>
            </>
          ) : (
            <p className="text-ink-muted text-sm">
              {company.name}&apos;s Google link isn&apos;t set up yet. Copy your text and search for
              them on Google Maps to post it.
            </p>
          )}
        </section>
      )}

      {/* Errors */}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {/* Private feedback */}
      {showPrivate ? (
        <PrivateFeedback company={company} rating={rating} onClose={() => setShowPrivate(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowPrivate(true)}
          className="text-ink-muted text-left text-sm underline"
        >
          Send a private message to {company.name} instead
        </button>
      )}
    </div>
  );
}

function PrivateFeedback({
  company,
  rating,
  onClose,
}: {
  company: { slug: string; name: string };
  rating: number;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<{
    ok?: boolean;
    error?: string;
  }>({});
  const [pending, startTransition] = useTransition();

  if (result.ok) {
    return (
      <section
        role="status"
        className="border-success bg-primary-soft rounded-2xl border p-5 text-sm"
      >
        Thank you — {company.name} has your message.
      </section>
    );
  }

  return (
    <section className="border-line bg-surface grid gap-3 rounded-2xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">Private message to {company.name}</p>

        <button type="button" onClick={onClose} className="text-ink-muted text-xs underline">
          Close
        </button>
      </div>

      <p className="text-ink-muted text-xs">
        Only the business sees this. It isn&apos;t posted anywhere.
      </p>

      <textarea
        aria-label="Your message"
        rows={4}
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What happened, and what would make it right?"
        className={field}
      />

      <input
        aria-label="Phone or email (optional)"
        maxLength={100}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Phone or email, if you'd like a call back (optional)"
        className={field}
      />

      <button
        type="button"
        disabled={pending || !message.trim()}
        onClick={() =>
          startTransition(async () => {
            const response = await sendPrivateFeedbackAction({
              company: company.slug,
              rating: rating || null,
              message,
              contact,
            });

            setResult(response);
          })
        }
        className="bg-primary text-primary-ink rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send privately"}
      </button>

      {result.error && (
        <p role="alert" className="text-danger text-sm">
          {result.error}
        </p>
      )}
    </section>
  );
}
