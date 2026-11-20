/** No-AI fallback for the review page: tidy spacing and capitalise sentences, nothing else. */
export function tidyOwnWords(notes: string) {
  return notes
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase())
    .replace(/([^.!?।])$/, "$1.");
}
