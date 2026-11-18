import type { Metadata } from "next";
import { ReviewDemo } from "./review";

export const metadata: Metadata = { title: "Review page preview" };

export default function ReviewDemoPage() {
  return <ReviewDemo />;
}
