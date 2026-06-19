import { test as base } from "@playwright/test";
import { LegacyMariaDbProbe } from "../db/legacyMariaDbProbe.js";
import { ModernizedPostgresProbe } from "../db/modernizedPostgresProbe.js";
import { loadTarget, resetTarget, type RuntimeTarget } from "../config/targets.js";
import { LegacyWorkflowActions } from "../workflows/legacyWorkflowActions.js";

type ParityFixtures = {
  target: RuntimeTarget;
  targetDb: LegacyMariaDbProbe | ModernizedPostgresProbe;
  legacyDb: LegacyMariaDbProbe;
  legacyWorkflow: LegacyWorkflowActions;
  resetPerTest: void;
};

export const test = base.extend<ParityFixtures>({
  target: async ({}, use) => {
    await use(await loadTarget());
  },
  targetDb: async ({ target }, use) => {
    if (target.type === "legacy-openemr") {
      await use(new LegacyMariaDbProbe(target));
      return;
    }
    await use(new ModernizedPostgresProbe(target));
  },
  legacyDb: async ({ target }, use) => {
    if (target.type !== "legacy-openemr") {
      throw new Error(`Legacy MariaDB probe cannot run against ${target.type}.`);
    }
    await use(new LegacyMariaDbProbe(target));
  },
  legacyWorkflow: async ({ legacyDb }, use) => {
    await use(new LegacyWorkflowActions(legacyDb));
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
