import { expect, test } from "@playwright/test";

test.describe("nutrition page", () => {
  test("redirects to the weekly planner", async ({ page }) => {
    await page.goto("/nutrition");
    await page.waitForURL("**/planner");

    await expect(page.getByRole("heading", { name: "Weekly planner" })).toBeVisible();
    await expect(page.getByText("Plan status", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Substitutions", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Seven-day calendar", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ingredient data", { exact: true })).toBeVisible();
  });
});
