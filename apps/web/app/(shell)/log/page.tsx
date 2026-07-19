import { redirect } from "next/navigation";

// The Daily log page was a placeholder with no real persistence of its own. Its intent - quick
// free-text logging - now lives as the "Athlete notes" section directly on the Endurance
// Dashboard, so this route just redirects there instead of keeping a near-empty page and a
// separate nav entry.
export default function LogPage() {
  redirect("/dashboard");
}
