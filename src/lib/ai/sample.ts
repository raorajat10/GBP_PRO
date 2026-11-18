import {
  AiError,
  sanitizePostDrafts,
  type AiWriter,
  type AuditFixResult,
  type PostDraftRequest,
  type PostDraftResult,
} from "./writer";

/**
 * Stand-in writer used when no Anthropic API key is set, so the whole post flow can be
 * tried. Drafts are simple templates around the manager's note and are labelled "sample"
 * everywhere they appear. Like the mock Google provider, it is replaced by the real thing
 * just by adding a key.
 */
export class SampleWriter implements AiWriter {
  readonly model = "sample";

  async writeAuditFixes(): Promise<AuditFixResult> {
    throw new AiError("AI writing isn't switched on (no ANTHROPIC_API_KEY).", "not_configured");
  }

  async writePostDrafts(input: PostDraftRequest): Promise<PostDraftResult> {
    const b = input.business;
    const where = [b.area, b.city].filter(Boolean).join(", ");
    const note = input.note.trim().replace(/[.।]+$/, "");
    const drafts =
      input.language === "hi"
        ? [
            {
              angle: "Informative",
              body: `${b.title}${where ? `, ${where}` : ""} से एक खबर: ${note}।\n\nज़्यादा जानकारी के लिए हमारी दुकान पर आइए या नीचे दिए गए बटन से हमें कॉल कीजिए।`,
            },
            {
              angle: "Friendly",
              body: `नमस्ते! ${note}।\n\n${b.title} में हमारी टीम आपकी मदद के लिए हमेशा तैयार है। आज ही संपर्क कीजिए।`,
            },
            {
              angle: "Short",
              body: `${note}। ${b.title}${b.area ? `, ${b.area}` : ""}। अभी कॉल कीजिए।`,
            },
          ]
        : input.language === "hinglish"
          ? [
              {
                angle: "Informative",
                body: `${b.title}${where ? `, ${where}` : ""} se ek update: ${note}.\n\nZyada jaankari ke liye shop par aaiye ya neeche diye button se call kijiye.`,
              },
              {
                angle: "Friendly",
                body: `Namaste! ${note}.\n\n${b.title} ki team aapki help ke liye hamesha ready hai. Aaj hi contact kijiye.`,
              },
              {
                angle: "Short",
                body: `${note}. ${b.title}${b.area ? `, ${b.area}` : ""}. Abhi call kijiye.`,
              },
            ]
          : [
              {
                angle: "Informative",
                body: `News from ${b.title}${where ? ` in ${where}` : ""}: ${note}.\n\nVisit our shop or tap the button below to call us and know more.`,
              },
              {
                angle: "Friendly",
                body: `Namaste! ${note}.\n\nOur team at ${b.title} is always happy to help. Get in touch today.`,
              },
              {
                angle: "Short",
                body: `${note}. ${b.title}${b.area ? `, ${b.area}` : ""}. Call us now.`,
              },
            ];
    // Same rules as real drafts, except the script check (the note may be in another language).
    return sanitizePostDrafts(input, { drafts }, this.model, { checkScript: false });
  }
}
