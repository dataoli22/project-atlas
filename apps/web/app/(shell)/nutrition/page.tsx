import { redirect } from "next/navigation";

// The nutrition module no longer has a separate "Dashboard" page distinct from Planner - its
// unique content (ingredient/product lookup) moved into /planner, and Planner is now the
// module's landing page. This route stays only so old links/bookmarks to /nutrition keep working.
export default function NutritionPage() {
  redirect("/planner");
}
