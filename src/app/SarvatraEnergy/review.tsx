"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const topics = ["Installation", "Quality", "Service", "Support", "Overall"] as const;

type Sample = {
  id: number;
  business: string;
  topic: string;
  language: string;
  text: string;
  style: string;
};

export function ReviewDemo() {
  const [topic, setTopic] = useState("All topics");
  const [language, setLanguage] = useState("All languages");

  const [allSamples, setAllSamples] = useState<Sample[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);

  const [selected, setSelected] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load JSON from public/data folder
  useEffect(() => {
    async function loadSamples() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/data/sarvtraEnergycomments.json");

        if (!response.ok) {
          throw new Error(`Unable to load templates (${response.status}).`);
        }

        const data = await response.json();

        if (!Array.isArray(data.templates)) {
          throw new Error("Invalid JSON format: templates array not found.");
        }

        setAllSamples(data.templates);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load examples.");
      } finally {
        setLoading(false);
      }
    }

    loadSamples();
  }, []);

  // Filter comments by topic and language
  const filteredSamples = useMemo(() => {
    return allSamples.filter((sample) => {
      const topicMatch = topic === "All topics" || sample.topic === topic;

      const languageMatch = language === "All languages" || sample.language === language;

      return topicMatch && languageMatch;
    });
  }, [allSamples, topic, language]);

  // Generate 5 random comments
  const generateComments = useCallback(() => {
    setError("");
    setCopiedId(null);
    setSelected(null);

    if (filteredSamples.length === 0) {
      setSamples([]);
      return;
    }

    // Copy filtered data before shuffling
    const shuffled = [...filteredSamples];

    // Fisher-Yates shuffle for random selection
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Display only 5 random comments
    setSamples(shuffled.slice(0, 5));
  }, [filteredSamples]);

  // Generate comments after loading and whenever filters change
  useEffect(() => {
    if (!loading && allSamples.length > 0) {
      // Re-pick after loading or a filter change; the random pick can't be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      generateComments();
    }
  }, [loading, allSamples, generateComments]);

  // Copy comment and redirect to Google review page
  async function copyComment(text: string, id: number) {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedId(id);

      window.setTimeout(() => {
        window.location.href =
          "https://search.google.com/local/writereview?placeid=ChIJ3cZEGsjJbTkRHCs5qNnXL-8";
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      setError("Unable to copy example.");
    }
  }

  return (
    <main className="min-h-screen bg-[#080f12] px-4 py-8 text-[#eef6f6] sm:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="border-b border-[#243439] bg-[#101a1e] px-5 py-5 sm:px-7">
          <Link href="/" className="text-xs text-[#91a6aa]">
            ← GBP Pro
          </Link>

          <div className="mt-4 flex items-start justify-between gap-4">
            <span className="rounded-full bg-[#142c2a] px-3 py-1 text-xs font-semibold text-[#1ce0c8]">
              PREVIEW
            </span>
          </div>
        </header>

        <section className="py-7">
          {/* Page Title */}
          <div className="mt-7">
            <h1 className="text-2xl font-bold">Please Select Any one</h1>
          </div>

          {/* Topic Filter */}
          <div className="mt-5">
            <p className="mb-2 text-sm text-[#91a6aa]">Topic</p>

            <div className="flex flex-wrap gap-2">
              {["All topics", ...topics].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTopic(item)}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    topic === item
                      ? "border-[#1ce0c8] bg-[#1ce0c8] text-[#071514]"
                      : "border-[#24514e] text-[#1ce0c8] hover:bg-[#102321]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Language Filter */}
          <div className="mt-5">
            <label htmlFor="language" className="mb-2 block text-sm text-[#91a6aa]">
              Language
            </label>

            <select
              id="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-xl border border-[#24514e] bg-[#0d171a] px-3 py-2 text-sm text-white"
            >
              <option>All languages</option>
              <option>English</option>
              <option>hi-en</option>
            </select>
          </div>

          {/* Information */}
          <div className="mt-5 rounded-xl border border-[#24514e] bg-[#0b2524] p-4 text-sm text-[#dceceb]">
            These are fictional sample templates for preview purposes, not genuine customer reviews.
            Customers should always write about their own actual experiences.
          </div>

          {/* Generate Button */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-[#91a6aa]">
              {loading
                ? "Loading examples..."
                : `Showing ${samples.length} of ${filteredSamples.length} matching examples`}
            </span>

            <button
              type="button"
              onClick={generateComments}
              disabled={loading || filteredSamples.length === 0}
              className="rounded-lg border border-[#24514e] px-3 py-2 font-semibold text-[#1ce0c8] transition hover:bg-[#102321] disabled:opacity-50"
            >
              Generate Another 5
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="mt-6 animate-pulse rounded-xl border border-[#243439] bg-[#101a1e] p-6 text-center text-sm text-[#91a6aa]">
              Loading examples...
            </div>
          )}

          {/* Random Comments */}
          {!loading && (
            <div className="mt-3 grid gap-3">
              {samples.map((sample) => (
                <div
                  key={sample.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === sample.id}
                  onClick={() => setSelected(sample.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(sample.id);
                    }
                  }}
                  className={`cursor-pointer rounded-2xl border bg-[#101a1e] p-4 text-left transition-colors ${
                    selected === sample.id
                      ? "border-[#1ce0c8] ring-1 ring-[#1ce0c8]"
                      : "border-[#243439] hover:border-[#397a74]"
                  }`}
                >
                  {/* Comment Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-[#20343a] px-2 py-1">
                        Example {String(sample.id).padStart(3, "0")}
                      </span>

                      <span className="rounded-full border border-[#243439] px-2 py-1">
                        {sample.language}
                      </span>
                    </div>

                    <span className="text-xs text-[#91a6aa]">
                      {sample.topic} · {sample.style}
                    </span>
                  </div>

                  {/* Comment Text */}
                  <p className="mt-3 leading-6">{sample.text}</p>

                  {/* Copy Button */}
                  <div className="mt-4 flex items-center justify-end gap-3">
                    {copiedId === sample.id && (
                      <span className="text-xs font-medium text-[#1ce0c8]">
                        ✓ Copied successfully!
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyComment(sample.text, sample.id);
                      }}
                      className="rounded-lg border border-[#1ce0c8]/40 bg-[#102321] px-4 py-2 text-xs font-semibold text-[#1ce0c8] transition hover:bg-[#1ce0c8] hover:text-[#071514]"
                    >
                      {copiedId === sample.id ? "Copied!" : "Copy Example"}
                    </button>
                  </div>
                </div>
              ))}

              {!error && samples.length === 0 && (
                <p className="rounded-xl border border-[#243439] bg-[#101a1e] p-5 text-center text-sm text-[#91a6aa]">
                  No examples found for this selection.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
