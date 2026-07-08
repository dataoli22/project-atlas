import { expect, test } from "@playwright/test";

test.describe("integrations page", () => {
  test("shows AI runtime and connector scaffolding", async ({ page }) => {
    await page.goto("/settings/integrations");

    await expect(page.getByRole("heading", { name: "On-device AI and connector runtime" })).toBeVisible();
    await expect(page.getByText("Runtime posture", { exact: true })).toBeVisible();
    await expect(page.getByText("On-device AI runtime", { exact: true })).toBeVisible();
    await expect(page.getByText("Health account wiring", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Strava", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Health Connect", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Samsung Health", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test Ollama connection" })).toBeVisible();
  });
});
