import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated smoke coverage, not a substitute for a full manual audit with assistive tech - but
// it catches the categories of defect (missing labels, contrast, landmark structure, focus
// order) that regress silently as pages change, across every primary route in one CI run.
const ROUTES = [
  "/dashboard",
  "/capability",
  "/timeline",
  // /nutrition is a redirect-only stub (kept for old bookmarks) that immediately forwards to
  // /planner - auditing it races the redirect and just re-tests /planner under a different URL,
  // which is already covered below.
  "/cooking",
  "/shopping",
  "/planner",
  "/ask",
  "/settings",
  "/settings/setup"
];

test.describe("accessibility smoke", () => {
  for (const route of ROUTES) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(route);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );

      expect(
        seriousOrCritical,
        seriousOrCritical.map((v) => `${v.id}: ${v.description}`).join("\n")
      ).toEqual([]);
    });
  }
});

test.describe("responsive smoke", () => {
  for (const route of ROUTES) {
    test(`${route} has no horizontal overflow at mobile width`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(route);

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );

      expect(hasOverflow, `${route} overflows horizontally at 375px width`).toBe(false);
    });
  }
});
