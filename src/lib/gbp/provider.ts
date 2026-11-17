import { MockGbpProvider } from "./mock/provider";
import { GbpError, type GbpProvider, type GbpProviderKind } from "./types";

let mock: MockGbpProvider | undefined;

/**
 * The only way the app reaches Google Business Profile data.
 * "google" (official APIs + OAuth) is added in M13, once Google approves API access.
 */
export function getGbpProvider(kind: GbpProviderKind): GbpProvider {
  if (kind === "mock") {
    mock ??= new MockGbpProvider();
    return mock;
  }
  throw new GbpError(
    "The real Google connection isn't switched on yet. It will be once Google approves our API access.",
    "not_enabled",
  );
}
