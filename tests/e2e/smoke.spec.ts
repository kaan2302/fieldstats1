import { expect, test } from "@playwright/test";

const VIEWS = ["start", "analyse", "kader", "statistiken", "spiele", "gegner"];

test("öffentliche Ansicht lädt und alle Bereiche funktionieren", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));

  await page.goto("./?team=sc-binningen");
  await expect(page.locator("#v-start")).toBeVisible();
  await expect(page.locator("#kpisUs, #usBody, #v-start .panel").first()).not.toBeEmpty({ timeout: 15_000 });

  for (const v of VIEWS) {
    await page.locator(`nav a[data-v="${v}"]`).first().click();
    await expect(page.locator(`#v-${v}`)).toBeVisible();
    await expect(page.locator(`#v-${v}`)).not.toBeEmpty();
  }
  await expect(page.locator("#navSet")).toBeHidden(); // ohne Login kein Admin-Bereich
  expect(errors).toEqual([]);
});
