import { connection } from "next/server";
import { brand } from "@/config/brand";
import { serverEnv } from "@/lib/env";

/** Liveness check for uptime monitoring and the e2e smoke test. Never returns secrets. */
export async function GET() {
  await connection(); // always evaluate at request time, never prerender
  const env = serverEnv();
  return Response.json({
    status: "ok",
    app: brand.name,
    providers: { gbp: env.GBP_PROVIDER, messaging: env.MESSAGING_PROVIDER },
  });
}
