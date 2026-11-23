import { googleOAuthConfig } from "./google/test-connection";
import { GoogleGbpProvider } from "./google/provider";
import { MockGbpProvider } from "./mock/provider";
import { GbpError, type GbpProvider, type GbpProviderKind } from "./types";

let mock: MockGbpProvider | undefined;
let google: GoogleGbpProvider | undefined;

/**
 * The only way the app reaches Google Business Profile data. Each stored connection says
 * which provider it uses, so sample-data clients keep working after the switch to Google.
 */
export function getGbpProvider(kind: GbpProviderKind): GbpProvider {
  if (kind === "mock") {
    mock ??= new MockGbpProvider();
    return mock;
  }
  const cfg = googleOAuthConfig();
  if (!cfg) {
    throw new GbpError(
      "The Google connection isn't set up: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing.",
      "not_enabled",
    );
  }
  google ??= new GoogleGbpProvider(cfg);
  return google;
}
