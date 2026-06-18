import { test as base } from "@playwright/test";
import { LegacyMariaDbProbe } from "../db/legacyMariaDbProbe.js";
import { loadTarget, resetTarget, type RuntimeTarget } from "../config/targets.js";

type ParityFixtures = {
  target: RuntimeTarget;
  legacyDb: LegacyMariaDbProbe;
  resetPerTest: void;
};

export const test = base.extend<ParityFixtures>({
  target: async ({}, use) => {
    await use(await loadTarget());
  },
  legacyDb: async ({ target }, use) => {
    if (target.type !== "legacy-openemr") {
      throw new Error(`Legacy MariaDB probe cannot run against ${target.type}.`);
    }
    await use(new LegacyMariaDbProbe(target));
  },
  resetPerTest: [
    async ({ target }, use, testInfo) => {
      if (process.env.PARITY_RESET_MODE === "test") {
        await resetTarget(target, testInfo.title);
      }
      await use();
    },
    { auto: true }
  ]
});

export { expect } from "@playwright/test";
