import { expect, test } from "@playwright/test";

test.describe("nutrition page", () => {
  test("shows the weekly nutrition snapshot", async ({ page }) => {
    await page.goto("/nutrition");

    await expect(page.getByRole("heading", { name: "Nutrition and cooking snapshot" })).toBeVisible();
    await expect(page.getByText("Weekly frame", { exact: true })).toBeVisible();
    await expect(page.getByText("Budget and shopping", { exact: true })).toBeVisible();
    await expect(page.getByText("Nutrition targets", { exact: true })).toBeVisible();
    await expect(page.getByText("Cooking handoff", { exact: true })).toBeVisible();
    await expect(page.getByText("Substitution logic", { exact: true })).toBeVisible();
    await expect(page.getByText("Ingredient data", { exact: true })).toBeVisible();
  });
});
