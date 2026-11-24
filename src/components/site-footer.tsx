import Link from "next/link";
import { brand } from "@/config/brand";

/** Footer for public pages: who runs the service and the legal links Google and Meta check. */
export function SiteFooter() {
  return (
    <footer className="border-line text-ink-muted mt-auto border-t">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm sm:px-8">
        <p>
          {brand.name} is run by {brand.legal.name}, {brand.legal.city}.
        </p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/privacy" className="hover:text-primary">
            Privacy policy
          </Link>
          <Link href="/terms" className="hover:text-primary">
            Terms of service
          </Link>
          <a href={`mailto:${brand.legal.contactEmail}`} className="hover:text-primary">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
