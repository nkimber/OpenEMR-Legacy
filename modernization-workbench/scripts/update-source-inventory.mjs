import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workbenchRoot = path.resolve(scriptDirectory, "..");
const repoRoot = process.env.WORKBENCH_REPO_ROOT ? path.resolve(process.env.WORKBENCH_REPO_ROOT) : path.resolve(workbenchRoot, "..");
const configPath = path.join(workbenchRoot, "config", "source-inventory.json");
const snapshotPath = path.join(workbenchRoot, "config", "source-inventory.snapshot.json");
const maxConcurrentReads = Number(process.env.SOURCE_INVENTORY_CONCURRENCY ?? "32");

function resolveRepoPath(projectPath) {
  const resolved = path.resolve(repoRoot, projectPath);
  const normalized = resolved.toLowerCase();
  const normalizedRoot = repoRoot.toLowerCase();
  if (normalized !== normalizedRoot && !normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Path escapes repository root: ${projectPath}`);
  }
  return resolved;
}

function normalizeInventoryPath(resolvedPath) {
  return `/${path.relative(repoRoot, resolvedPath).replaceAll("\\", "/")}`;
}

function normalizeExtension(extension) {
  return extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}

function mergeInventoryExclusions(config, rule) {
  return {
    directoryNames: new Set([...(config.excludeDirectoryNames ?? []), ...(rule.excludeDirectoryNames ?? [])].map((item) => item.toLowerCase())),
    pathIncludes: [...(config.excludePathIncludes ?? []), ...(rule.excludePathIncludes ?? [])].map((item) => item.replaceAll("\\", "/").toLowerCase())
  };
}

function pathHasExcludedSegment(resolvedPath, pathIncludes) {
  const normalized = normalizeInventoryPath(resolvedPath).toLowerCase();
  return pathIncludes.some((item) => item && normalized.includes(item));
}

function matchesInventoryFile(resolvedPath, rule) {
  const extensions = new Set((rule.extensions ?? []).map(normalizeExtension));
  const fileNames = new Set((rule.fileNames ?? []).map((item) => item.toLowerCase()));
  const fileName = path.basename(resolvedPath).toLowerCase();
  return extensions.has(path.extname(resolvedPath).toLowerCase()) || fileNames.has(fileName);
}

async function collectInventoryFiles(config, rule) {
  const files = new Set();
  const warnings = [];
  const exclusions = mergeInventoryExclusions(config, rule);

  async function walk(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      warnings.push(`${normalizeInventoryPath(directory)}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (pathHasExcludedSegment(entryPath, exclusions.pathIncludes)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!exclusions.directoryNames.has(entry.name.toLowerCase())) {
          await walk(entryPath);
        }
        continue;
      }

      if (entry.isFile() && matchesInventoryFile(entryPath, rule)) {
        files.add(entryPath);
      }
    }
  }

  for (const root of rule.roots) {
    await walk(resolveRepoPath(root));
  }

  return { files: [...files].sort(), warnings };
}

function isWhitespaceByte(byte) {
  return byte === 9 || byte === 10 || byte === 11 || byte === 12 || byte === 13 || byte === 32;
}

function countSourceBuffer(buffer) {
  if (buffer.length === 0) {
    return { totalLines: 0, nonBlankLines: 0, blankLines: 0 };
  }

  let totalLines = 0;
  let nonBlankLines = 0;
  let lineHasContent = false;

  for (const byte of buffer) {
    if (byte === 10) {
      totalLines++;
      if (lineHasContent) {
        nonBlankLines++;
      }
      lineHasContent = false;
      continue;
    }

    if (!isWhitespaceByte(byte)) {
      lineHasContent = true;
    }
  }

  if (buffer[buffer.length - 1] !== 10) {
    totalLines++;
    if (lineHasContent) {
      nonBlankLines++;
    }
  }

  return { totalLines, nonBlankLines, blankLines: totalLines - nonBlankLines };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function sumTotals(items) {
  return items.reduce(
    (total, item) => ({
      files: total.files + item.files,
      totalLines: total.totalLines + item.totalLines,
      nonBlankLines: total.nonBlankLines + item.nonBlankLines,
      blankLines: total.blankLines + item.blankLines
    }),
    { files: 0, totalLines: 0, nonBlankLines: 0, blankLines: 0 }
  );
}

async function countInventoryFiles(files) {
  const fileTotals = await mapLimit(files, maxConcurrentReads, async (file) => countSourceBuffer(await fs.readFile(file)));
  return { ...sumTotals(fileTotals.map((item) => ({ files: 0, ...item }))), files: files.length };
}

function countPatternMatches(text, pattern, flags = "gi") {
  const normalizedFlags = flags.includes("g") ? flags : `${flags}g`;
  const expression = new RegExp(pattern, normalizedFlags);
  return [...text.matchAll(expression)].length;
}

async function countInventoryMetric(config, rule) {
  const { files, warnings } = await collectInventoryFiles(config, rule);
  const counts = await mapLimit(files, maxConcurrentReads, async (file) => countPatternMatches(await fs.readFile(file, "utf8"), rule.pattern, rule.flags));
  return {
    id: rule.id,
    label: rule.label,
    detail: rule.detail,
    value: counts.reduce((total, value) => total + value, 0),
    files: files.length,
    warnings
  };
}

async function buildSourceInventorySystem(config, systemRule) {
  const components = [];

  for (const componentRule of systemRule.components) {
    const { files, warnings } = await collectInventoryFiles(config, componentRule);
    const totals = await countInventoryFiles(files);
    components.push({
      ...componentRule,
      ...totals,
      samplePaths: files.slice(0, 4).map(normalizeInventoryPath),
      warnings
    });
  }

  const metrics = [];
  for (const metricRule of systemRule.metricRules) {
    metrics.push(await countInventoryMetric(config, metricRule));
  }

  return {
    systemId: systemRule.systemId,
    summary: systemRule.summary,
    totals: sumTotals(components),
    components,
    metrics,
    warnings: [...components.flatMap((component) => component.warnings), ...metrics.flatMap((metric) => metric.warnings)]
  };
}

async function main() {
  const startedAt = Date.now();
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const systems = [];
  const warnings = [];

  for (const systemRule of config.systems) {
    try {
      systems.push(await buildSourceInventorySystem(config, systemRule));
    } catch (error) {
      warnings.push(`${systemRule.systemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const snapshot = {
    version: config.version,
    lastUpdated: config.lastUpdated,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    method: config.method,
    systems,
    warnings
  };

  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Source inventory snapshot written to ${path.relative(repoRoot, snapshotPath).replaceAll("\\", "/")}`);
  console.log(`Tracked ${systems.length} systems in ${(snapshot.durationMs / 1000).toFixed(1)}s.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
