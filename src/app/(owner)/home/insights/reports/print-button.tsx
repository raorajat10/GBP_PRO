"use client";

/** Opens the browser's print dialog, where "Save as PDF" downloads the report. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-primary text-primary-ink rounded-lg px-4 py-2 font-semibold print:hidden"
    >
      Download PDF
    </button>
  );
}
