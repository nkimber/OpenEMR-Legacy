import { promises as fs } from "node:fs";
import path from "node:path";
import { readEnvFile } from "./env.js";
import { parityRoot, repoRoot, resolveFromParityRoot } from "./paths.js";
import type { CommandResult } from "../core/command.js";
import { runCommand } from "../core/command.js";

export type TargetStatus = "implemented" | "planned";
export type TargetType = "legacy-openemr" | "modernized-openemr";

export type TargetConfig = {
  id: string;
  name: string;
  status: TargetStatus;
  type: TargetType;
  appId: string;
  publicUrl: string;
  healthUrl: string;
  workingDirectory: string;
  envPath: string;
  sourcePath?: string;
  seedDatasetId: string;
  seedSummaryPath: string;
  defaultCredentials?: {
    username: string;
    password: string;
  };
  database: {
    kind: "mariadb" | "postgres";
    composeService?: string;
    defaultDatabase: string;
    defaultUser: string;
  };
  commands: Record<string, string[] | undefined>;
};

type TargetsFile = {
  targets: TargetConfig[];
};

export type RuntimeTarget = TargetConfig & {
  repoRoot: string;
  parityRoot: string;
  workingDirectoryAbs: string;
  envPathAbs: string;
  seedSummaryPathAbs: string;
  env: Record<string, string>;
  credentials: {
    username: string;
    password: string;
  };
};

export async function loadTargets() {
  const text = await fs.readFile(path.join(parityRoot, "config", "targets.json"), "utf8");
  return JSON.parse(text) as TargetsFile;
}

export async function loadTarget(targetId = process.env.PARITY_TARGET ?? "legacy-openemr"): Promise<RuntimeTarget> {
  const targets = await loadTargets();
  const target = targets.targets.find((candidate) => candidate.id === targetId);
  if (!target) {
    throw new Error(`Unknown parity test target: ${targetId}`);
  }
  if (target.status !== "implemented") {
    throw new Error(`Target ${targetId} is ${target.status}; it cannot run parity tests yet.`);
  }

  const workingDirectoryAbs = resolveFromParityRoot(target.workingDirectory);
  const envPathAbs = resolveFromParityRoot(target.envPath);
  const seedSummaryPathAbs = resolveFromParityRoot(target.seedSummaryPath);
  const env = await readEnvFile(envPathAbs);
  const credentials = {
    username: env.OPENEMR_ADMIN_USER || target.defaultCredentials?.username || "admin",
    password: env.OPENEMR_ADMIN_PASSWORD || target.defaultCredentials?.password || ""
  };

  return {
    ...target,
    repoRoot,
    parityRoot,
    workingDirectoryAbs,
    envPathAbs,
    seedSummaryPathAbs,
    env,
    credentials
  };
}

export function getCommand(target: RuntimeTarget, name: string) {
  const command = target.commands[name];
  if (!command?.length) {
    throw new Error(`Target ${target.id} does not define command '${name}'.`);
  }
  return command;
}

export async function runTargetCommand(target: RuntimeTarget, name: string, timeoutMs = 120_000): Promise<CommandResult> {
  return await runCommand(getCommand(target, name), {
    cwd: target.workingDirectoryAbs,
    timeoutMs,
    env: {
      PARITY_TARGET: target.id,
      PARITY_REPO_ROOT: target.repoRoot
    }
  });
}

export async function resetTarget(target: RuntimeTarget, reason: string) {
  const result = await runTargetCommand(target, "reset", 300_000);
  if (result.exitCode !== 0) {
    throw new Error(`Reset failed before ${reason}.\n${result.stderr || result.stdout}`);
  }
  return result;
}
