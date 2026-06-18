import path from "node:path";
import { fileURLToPath } from "node:url";

export const parityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const repoRoot = process.env.PARITY_REPO_ROOT ? path.resolve(process.env.PARITY_REPO_ROOT) : path.resolve(parityRoot, "..");

export function resolveFromParityRoot(projectPath: string) {
  return path.resolve(parityRoot, projectPath);
}

export function resolveFromRepoRoot(projectPath: string) {
  return path.resolve(repoRoot, projectPath);
}

export function toRepoRelative(filePath: string) {
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}
