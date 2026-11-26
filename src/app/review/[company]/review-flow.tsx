
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  polishReviewAction,
  sendPrivateFeedbackAction,
} from "./actions";

type Language = "en" | "hi" | "hinglish";

type Topic =
  | "Installation"
  | "Quality"
  | "Service"
  | "Support"
  | "Overall";

type SampleComment = {
  id: number;
  business: string;
  topic: Topic;
  language: string;
  style: string;
  text: string;
};

const PROMPTS = [
  {
    id: "what",
    label: "What did they do for you?",
    placeholder: "e.g. installed a battery or solar system",
  },
  {
    id: "good",
    label: "What did you like?",
    placeholder: "e.g. staff were helpful and explained everything",
  },
  {
    id: "better",
    label: "Anything they could do better?",
    placeholder: "Optional",
  },
] as const;

const TOPICS: Topic[] = [
  "Installation",
  "Quality",
  "Service",
  "Support",
  "Overall",
];

const field =
  "border-line focus:border-primary focus:ring-primary/20 w-full rounded-xl border bg-transparent p-3 text-sm outline-none focus:ring-2";

function shuffle<T>(items: T[]): T[] {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
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
  const [rating, setRating] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<Language>("en");
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);
  const [pending, startTransition] = useTransition();

  // Company-specific JSON comment bank
  const [allSamples, setAllSamples] = useState<SampleComment[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState(false);
  const [showSamples, setShowSamples] = useState(false);

  const [sampleTopic, setSampleTopic] = useState<Topic>("Overall");
  const [sampleLanguage, setSampleLanguage] =
    useState<Language>("en");

  const [visibleSamples, setVisibleSamples] =
    useState<SampleComment[]>([]);

  // Load company-specific JSON automatically
  useEffect(() => {
    let cancelled = false;

    async function loadSamples() {
      setSamplesLoading(true);
      setSamplesError(false);
      setAllSamples([]);

      try {
        const filename = `${company.slug}_review_templates.json`;

        const response = await fetch(`/data/${filename}`);

        if (!response.ok) {
          throw new Error("Sample file not found");
        }

        const data = await response.json();

        if (!Array.isArray(data.templates)) {
          throw new Error("Invalid sample file");
        }

        if (!cancelled) {
          setAllSamples(data.templates);
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
        sample.topic === sampleTopic &&
        sample.language === selectedLanguage
    );
  }, [allSamples, sampleTopic, sampleLanguage]);

  // Select random 5 examples whenever filter changes
  useEffect(() => {
    setVisibleSamples(shuffle(filteredSamples).slice(0, 5));
  }, [filteredSamples]);

  function refreshSamples() {
    setVisibleSamples(shuffle(filteredSamples).slice(0, 5));
  }

  // Customer's own words
  const notes = PROMPTS.map((p) => answers[p.id]?.trim())
    .filter(Boolean)
    .join(". ");

  function applyAsWritten() {
    setError("");
    setNote("");
    setDraft(notes);
  }

  function tidy() {
    setError("");

    startTransition(async () => {
      const result = await polishReviewAction({
        company: company.slug,
        notes,
        rating,
        language,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setDraft(result.text ?? notes);

      setNote(
        result.sample
          ? "Basic tidy only. Check it says what you mean."
          : "Tidied from your words only. Check it says what you mean and change anything."
      );
    });
  }

  async function copyAndOpen() {
    if (!draft?.trim() || !reviewUrl) return;

    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
    } catch {
      setError(
        "Couldn't copy automatically. Select the text and copy it yourself."
      );
    }

    window.open(reviewUrl, "_blank", "noopener");
  }

  return (
    <div className="grid gap-5">
      {/* 1. Rating */}
      <section className="border-line bg-surface rounded-2xl border p-5">
        <p className="text-primary text-sm font-semibold">
          01 / Your rating
        </p>

        <div
          className="mt-3 flex gap-1"
          role="radiogroup"
          aria-label="Star rating"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className={`text-3xl leading-none ${
                n <= rating
                  ? "text-amber-500"
                  : "text-ink-muted/40"
              }`}
            >
              ★
            </button>
          ))}
        </div>

        {rating > 0 && rating <= 3 && (
          <p className="text-ink-muted mt-3 text-sm">
            Sorry it wasn't great. You can post on Google, and/or{" "}
            <button
              type="button"
              className="text-primary font-semibold underline"
              onClick={() => setShowPrivate(true)}
            >
              tell {company.name} privately
            </button>{" "}
            so they can fix it.
          </p>
        )}
      </section>

      {/* 2. Customer's own words */}
      {rating > 0 && (
        <section className="border-line bg-surface grid gap-4 rounded-2xl border p-5">
          <div>
            <p className="text-primary text-sm font-semibold">
              02 / In your own words
            </p>

            <p className="text-ink-muted mt-1 text-sm">
              A few words about your actual experience is enough.
              Answer only what you want to.
            </p>
          </div>

          {PROMPTS.map((p) => (
            <label
              key={p.id}
              className="grid gap-1.5 text-sm font-semibold"
            >
              {p.label}

              <textarea
                rows={2}
                maxLength={600}
                placeholder={p.placeholder}
                value={answers[p.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({
                    ...a,
                    [p.id]: e.target.value,
                  }))
                }
                className={`${field} font-normal`}
              />
            </label>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Language"
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as Language)
              }
              className="border-line bg-surface rounded-xl border px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>

            <button
              type="button"
              disabled={!notes || pending}
              onClick={tidy}
              className="bg-primary text-primary-ink rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Tidying…" : "Tidy my words"}
            </button>

            <button
              type="button"
              disabled={!notes || pending}
              onClick={applyAsWritten}
              className="border-line rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Use as written
            </button>
          </div>
        </section>
      )}

      {/* Company-specific inspiration */}
      <section className="border-line bg-surface rounded-2xl border p-5">
        <button
          type="button"
          onClick={() => setShowSamples((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <p className="text-sm font-semibold">
              Review examples for {company.name}
            </p>

            <p className="text-ink-muted mt-1 text-xs">
              Ideas to help you describe your own experience
            </p>
          </div>

          <span className="text-lg">
            {showSamples ? "−" : "+"}
          </span>
        </button>

        {showSamples && (
          <div className="mt-4 grid gap-4">
            {/* Topic filter */}
            <div>
              <label className="mb-1 block text-xs font-medium">
                Topic
              </label>

              <select
                value={sampleTopic}
                onChange={(e) =>
                  setSampleTopic(e.target.value as Topic)
                }
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
              <label className="mb-1 block text-xs font-medium">
                Example language
              </label>

              <select
                value={sampleLanguage}
                onChange={(e) =>
                  setSampleLanguage(e.target.value as Language)
                }
                className="border-line bg-surface w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>

            {samplesLoading ? (
              <p className="text-ink-muted text-sm">
                Loading examples…
              </p>
            ) : samplesError ? (
              <p className="text-ink-muted text-sm">
                Examples aren't available for this business yet.
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
                      </p>

                      <p className="mt-2 text-sm leading-relaxed">
                        {sample.text}
                      </p>
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
              These are illustrative examples, not customer testimonials.
              Please write your own review based on your actual experience.
            </p>
          </div>
        )}
      </section>

      {/* 3. Review draft */}
      {draft !== null && (
        <section
          className="border-line bg-surface grid gap-3 rounded-2xl border p-5"
          aria-live="polite"
        >
          <p className="text-primary text-sm font-semibold">
            03 / Check and post
          </p>

          {note && (
            <p className="bg-accent-soft rounded-lg px-3 py-2 text-xs">
              {note}
            </p>
          )}

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
                {copied
                  ? "Copied — paste it on Google"
                  : "Copy & open Google"}
              </button>

              <p className="text-ink-muted text-xs">
                On Google: choose your {rating} star
                {rating > 1 ? "s" : ""}, paste your review, and post.
                Google shows your name with the review.
              </p>
            </>
          ) : (
            <p className="text-ink-muted text-sm">
              {company.name}'s Google link isn't set up yet.
              Copy your text and search for them on Google Maps to post it.
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
        <PrivateFeedback
          company={company}
          rating={rating}
          onClose={() => setShowPrivate(false)}
        />
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
        <p className="text-sm font-semibold">
          Private message to {company.name}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-ink-muted text-xs underline"
        >
          Close
        </button>
      </div>

      <p className="text-ink-muted text-xs">
        Only the business sees this. It isn't posted anywhere.
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
