import { expect, test } from "@playwright/test";

test.describe("setup modules", () => {
  test("jump menu switches between connector, pairing, and AI modules", async ({ page }) => {
    await page.goto("/settings/setup");

    await expect(page.getByRole("heading", { name: "Setup" })).toBeVisible();

    await page.getByRole("button", { name: "Pair your device", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pair your device" })).toBeVisible();

    await page.getByRole("button", { name: "Strava", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Connect Strava" })).toBeVisible();

    await page.getByRole("button", { name: "Samsung Health", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Connect Samsung Health" })).toBeVisible();

    await page.getByRole("button", { name: "Health Connect", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Connect Health Connect" })).toBeVisible();

    await page.getByRole("button", { name: "AI setup", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Set up AI" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check Ollama connection" })).toBeVisible();
  });
});
