import { expect, test } from "@playwright/test";

test.describe("cooking page", () => {
  test("shows the cooking execution flow", async ({ page }) => {
    await page.goto("/cooking");

    await expect(page.getByRole("heading", { name: "Cooking flow" })).toBeVisible();
    await expect(page.getByText("Prep sequence", { exact: true })).toBeVisible();
    await expect(page.getByText("Daily cook cadence", { exact: true })).toBeVisible();
    await expect(page.getByText("Ingredient reuse", { exact: true })).toBeVisible();
    await expect(page.getByText("Leftover handoff", { exact: true })).toBeVisible();
    await expect(page.getByText("Substitution fallback", { exact: true })).toBeVisible();
  });
});
