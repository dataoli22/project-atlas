import { redirect } from "next/navigation";

// The old standalone "Overview" placeholder page never had real content (dashed "shell
// placeholder" boxes) and isn't a nav item anymore - nutrition is the higher-usage module day to
// day, so "/" now sends straight to its dashboard instead of a dead scaffold page.
export default function HomePage() {
  redirect("/nutrition");
}
