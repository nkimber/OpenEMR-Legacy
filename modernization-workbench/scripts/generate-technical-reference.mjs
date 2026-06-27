import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workbenchRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(workbenchRoot, "..");
const modernizedRoot = path.join(repoRoot, "modernized-openemr");
const documentPath = path.join(repoRoot, "documents", "MODERNIZED_OPENEMR_TECHNICAL_REFERENCE.md");
const metadataPath = path.join(workbenchRoot, "config", "technical-reference.json");
const ignoredDirectoryNames = new Set([
  ".git",
  ".vs",
  ".vite",
  "artifacts",
  "bin",
  "dist",
  "node_modules",
  "obj",
  "TestResults"
]);

function toProjectPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  if (!(await exists(filePath))) {
    return fallback;
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readText(filePath, fallback = "") {
  if (!(await exists(filePath))) {
    return fallback;
  }
  return fs.readFile(filePath, "utf8");
}

async function walkFiles(root) {
  const results = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          await visit(fullPath);
        }
        continue;
      }
      if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  await visit(root);
  return results.sort((left, right) => toProjectPath(left).localeCompare(toProjectPath(right)));
}

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

async function countLines(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

function formatDependencyList(packageJson) {
  const dependencies = Object.entries(packageJson.dependencies ?? {});
  const devDependencies = Object.entries(packageJson.devDependencies ?? {});
  return {
    dependencies: dependencies.map(([name, version]) => `${name}@${version}`),
    devDependencies: devDependencies.map(([name, version]) => `${name}@${version}`)
  };
}

function parseCsproj(text) {
  const targetFramework = text.match(/<TargetFramework>([^<]+)<\/TargetFramework>/)?.[1] ?? "unknown";
  const packages = [...text.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g)]
    .map((match) => `${match[1]}@${match[2]}`);
  return { targetFramework, packages };
}

function joinRoute(prefix, route) {
  if (!prefix) {
    return route;
  }
  if (route === "/") {
    return prefix;
  }
  return `${prefix.replace(/\/$/, "")}/${route.replace(/^\//, "")}`;
}

function parseBackendEndpoints(programText) {
  const lines = programText.split(/\r?\n/);
  const groups = new Map();
  const endpoints = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const groupMatch = line.match(/var\s+(\w+)\s*=\s*app\.MapGroup\("([^"]+)"\)(?:\.WithTags\("([^"]+)"\))?/);
    if (groupMatch) {
      groups.set(groupMatch[1], {
        prefix: groupMatch[2],
        tag: groupMatch[3] ?? groupMatch[1]
      });
    }

    const endpointMatch = line.match(/\b(\w+|app)\.Map(Get|Post|Put|Delete|Patch)\("([^"]+)"/);
    if (!endpointMatch) {
      continue;
    }

    const [, receiver, verbSuffix, route] = endpointMatch;
    const group = receiver === "app" ? undefined : groups.get(receiver);
    const lookahead = lines.slice(index, Math.min(lines.length, index + 8)).join("\n");
    const name = lookahead.match(/\.WithName\("([^"]+)"\)/)?.[1] ?? "";
    endpoints.push({
      method: verbSuffix.toUpperCase(),
      path: joinRoute(group?.prefix ?? "", route),
      name,
      tag: group?.tag ?? "Application",
      line: index + 1
    });
  }

  return endpoints.sort((left, right) => {
    const tagComparison = left.tag.localeCompare(right.tag);
    return tagComparison !== 0 ? tagComparison : `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`);
  });
}

function parseFrontendModules(appText) {
  return [...appText.matchAll(/\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)'[^}]*implemented:\s*'([^']+)'/g)]
    .map((match) => ({
      id: match[1],
      label: match[2],
      implemented: match[3]
    }));
}

function parseCreateTables(seedText) {
  return [...seedText.matchAll(/create table\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)]
    .map((match) => match[1])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort((left, right) => left.localeCompare(right));
}

function parseDockerServices(composeText) {
  const servicesSection = composeText.match(/^services:[^\S\r\n]*(?:\r?\n)([\s\S]*?)(?:^volumes:|\r?\n\S|\Z)/m)?.[1] ?? "";
  return [...servicesSection.matchAll(/^  ([a-zA-Z0-9_-]+):\s*$/gm)].map((match) => match[1]);
}

function summarizeByExtension(files) {
  const counts = new Map();
  for (const file of files) {
    const extension = path.extname(file).toLowerCase() || "[none]";
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([extension, count]) => ({ extension, count }))
    .sort((left, right) => right.count - left.count || left.extension.localeCompare(right.extension));
}

function summarizeTopLevel(files) {
  const counts = new Map();
  for (const file of files) {
    const relative = path.relative(modernizedRoot, file).replaceAll("\\", "/");
    const topLevel = relative.split("/")[0] ?? relative;
    counts.set(topLevel, (counts.get(topLevel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function groupEndpointsByTag(endpoints) {
  return endpoints.reduce((groups, endpoint) => {
    const list = groups.get(endpoint.tag) ?? [];
    list.push(endpoint);
    groups.set(endpoint.tag, list);
    return groups;
  }, new Map());
}

function countParityTags(plans) {
  const counts = new Map();
  for (const plan of plans) {
    for (const tag of plan.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function renderList(items, mapper = (item) => String(item), empty = "- None found.") {
  if (!items.length) {
    return empty;
  }
  return items.map((item) => `- ${mapper(item)}`).join("\n");
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderEndpointSection(endpoints) {
  const grouped = groupEndpointsByTag(endpoints);
  const sections = [];
  for (const [tag, tagEndpoints] of grouped.entries()) {
    sections.push(`### ${tag}`);
    sections.push(renderList(
      tagEndpoints,
      (endpoint) => `\`${endpoint.method} ${endpoint.path}\`${endpoint.name ? ` - ${endpoint.name}` : ""} (${toProjectPath(path.join(modernizedRoot, "backend/src/OpenEmr.Modernized.Api/Program.cs"))}:${endpoint.line})`
    ));
  }
  return sections.join("\n\n");
}

async function main() {
  const generatedAt = new Date().toISOString();
  const commitFull = git(["rev-parse", "HEAD"], "unknown");
  const commitShort = git(["rev-parse", "--short=12", "HEAD"], "unknown");
  const status = git(["status", "--short"], "");
  const modernizedFiles = await walkFiles(modernizedRoot);
  const totalLines = (await Promise.all(modernizedFiles.map((file) => countLines(file)))).reduce((sum, count) => sum + count, 0);
  const backendProgramPath = path.join(modernizedRoot, "backend", "src", "OpenEmr.Modernized.Api", "Program.cs");
  const backendProjectPath = path.join(modernizedRoot, "backend", "src", "OpenEmr.Modernized.Api", "OpenEmr.Modernized.Api.csproj");
  const frontendPackagePath = path.join(modernizedRoot, "frontend", "package.json");
  const frontendAppPath = path.join(modernizedRoot, "frontend", "src", "App.tsx");
  const composePath = path.join(modernizedRoot, "docker-compose.yml");
  const seedGeneratorPath = path.join(modernizedRoot, "scripts", "generate-postgres-seed.mjs");
  const parityManifestPath = path.join(repoRoot, "parity-tests", "test-manifest.json");

  const programText = await readText(backendProgramPath);
  const csprojText = await readText(backendProjectPath);
  const frontendAppText = await readText(frontendAppPath);
  const composeText = await readText(composePath);
  const seedGeneratorText = await readText(seedGeneratorPath);
  const frontendPackage = await readJson(frontendPackagePath, {});
  const parityManifest = await readJson(parityManifestPath, { plans: [], suites: [] });

  const endpoints = parseBackendEndpoints(programText);
  const frontendModules = parseFrontendModules(frontendAppText);
  const databaseTables = parseCreateTables(seedGeneratorText);
  const dockerServices = parseDockerServices(composeText);
  const csproj = parseCsproj(csprojText);
  const frontendDependencies = formatDependencyList(frontendPackage);
  const repositoryFiles = modernizedFiles.filter((file) => file.includes(`${path.sep}Data${path.sep}`) && file.endsWith(".cs"));
  const modelFiles = modernizedFiles.filter((file) => file.includes(`${path.sep}Models${path.sep}`) && file.endsWith(".cs"));
  const parityPlans = (parityManifest.plans ?? []).filter((plan) => (plan.targets ?? []).includes("modernized-openemr"));
  const parityTagCounts = countParityTags(parityPlans).slice(0, 20);
  const extensionCounts = summarizeByExtension(modernizedFiles);
  const topLevelCounts = summarizeTopLevel(modernizedFiles);

  const summary = {
    fileCount: modernizedFiles.length,
    lineCount: totalLines,
    endpointCount: endpoints.length,
    frontendModuleCount: frontendModules.length,
    repositoryCount: repositoryFiles.length,
    dtoModelFileCount: modelFiles.length,
    databaseTableCount: databaseTables.length,
    parityPlanCount: parityPlans.length,
    dockerServiceCount: dockerServices.length
  };

  const sections = [
    { id: "how-to-use", title: "How to use this reference" },
    { id: "system-map", title: "System map" },
    { id: "runtime-and-stack", title: "Runtime and stack" },
    { id: "frontend", title: "Frontend modules" },
    { id: "backend-api", title: "Backend API surface" },
    { id: "data-and-schema", title: "Data and schema map" },
    { id: "parity-and-evidence", title: "Parity and evidence map" },
    { id: "source-inventory", title: "Source inventory" },
    { id: "regeneration", title: "Regeneration contract" }
  ];

  const markdown = `# Modernized OpenEMR Technical Reference

Generated at: ${generatedAt}

Source commit: ${commitShort} (${commitFull})

Worktree had uncommitted changes at generation time: ${status ? "yes" : "no"}

Generated by: \`modernization-workbench/scripts/generate-technical-reference.mjs\`

Source root: \`modernized-openemr/\`

This is a generated, DeepWiki-style orientation guide for the modernized OpenEMR target. Treat it as a navigational reference over the current source tree, not as the durable decision record. Durable project decisions remain in \`documents/\`, and parity evidence remains in Workbench test artifacts.

## How to use this reference

- Start here when you need to understand how the modernized target is assembled.
- Use the file paths beside each domain to jump into the concrete source files.
- Use the backend endpoint list to find the API contract owner for a workflow.
- Use the frontend module list to find the operator-facing surface.
- Use the parity plan section to connect implementation to executable behavior checks.
- Regenerate this document after large API, schema, frontend, or parity-plan changes.

## System map

- Modernized target root: \`modernized-openemr/\`
- Backend API: \`modernized-openemr/backend/src/OpenEmr.Modernized.Api/\`
- Frontend SPA: \`modernized-openemr/frontend/\`
- PostgreSQL seed/schema generator: \`modernized-openemr/scripts/generate-postgres-seed.mjs\`
- Runtime compose file: \`modernized-openemr/docker-compose.yml\`
- Side-by-side behavior specification: \`parity-tests/test-manifest.json\`
- Shared Workbench evidence and orchestration: \`modernization-workbench/\`

### Current generated snapshot

- Source files scanned: ${summary.fileCount}
- Source lines scanned: ${summary.lineCount}
- Backend endpoints found: ${summary.endpointCount}
- Frontend modules found: ${summary.frontendModuleCount}
- Repository files found: ${summary.repositoryCount}
- DTO/model files found: ${summary.dtoModelFileCount}
- PostgreSQL tables found in seed generator: ${summary.databaseTableCount}
- Modernized-target parity plans found: ${summary.parityPlanCount}
- Docker Compose services found: ${summary.dockerServiceCount}

## Runtime and stack

### Backend

- Project file: \`${toProjectPath(backendProjectPath)}\`
- Target framework: \`${csproj.targetFramework}\`
- Package references:
${renderList(csproj.packages)}

### Frontend

- Package file: \`${toProjectPath(frontendPackagePath)}\`
- Runtime dependencies:
${renderList(frontendDependencies.dependencies)}
- Development dependencies:
${renderList(frontendDependencies.devDependencies)}

### Docker Compose services

${renderList(dockerServices, (service) => `\`${service}\``)}

## Frontend modules

The staff shell and patient portal entry points are declared in \`${toProjectPath(frontendAppPath)}\`.

${renderList(frontendModules, (module) => `\`${module.implemented}\` - ${module.label} (navigation id \`${module.id}\`)`)}

## Backend API surface

The API surface is declared in \`${toProjectPath(backendProgramPath)}\`.

${renderEndpointSection(endpoints)}

## Data and schema map

### Repository files

${renderList(repositoryFiles, (file) => `\`${toProjectPath(file)}\``)}

### DTO/model files

${renderList(modelFiles, (file) => `\`${toProjectPath(file)}\``)}

### PostgreSQL tables found in seed generator

${renderList(databaseTables, (table) => `\`${table}\``)}

## Parity and evidence map

The parity manifest is \`${toProjectPath(parityManifestPath)}\`. Plans listed here target \`modernized-openemr\` and can be run from the Workbench Test Runs page.

- Modernized-target plans: ${summary.parityPlanCount}
- Common plan tags:
${renderList(parityTagCounts, (item) => `\`${item.tag}\` - ${item.count} plans`)}

### First 40 modernized-target plans

${renderList(parityPlans.slice(0, 40), (plan) => `\`${plan.id}\` - ${plan.name}`)}

## Source inventory

### Top-level source areas

${renderList(topLevelCounts, (item) => `\`${item.name}\` - ${pluralize(item.count, "file")}`)}

### File extension mix

${renderList(extensionCounts, (item) => `\`${item.extension}\` - ${pluralize(item.count, "file")}`)}

## Regeneration contract

Run this from \`modernization-workbench/\` after meaningful modernized-target API, schema, frontend, parity-manifest, or runtime changes:

\`\`\`powershell
npm run generate:technical-reference
\`\`\`

The generator updates this Markdown file and \`modernization-workbench/config/technical-reference.json\`. The Workbench Technical Reference page reads those artifacts and displays their generation metadata so stale references are visible.
`;

  const metadata = {
    version: "1.0",
    title: "Modernized OpenEMR Technical Reference",
    generatedAt,
    generatedBy: "modernization-workbench/scripts/generate-technical-reference.mjs",
    sourceRoot: "modernized-openemr",
    documentPath: toProjectPath(documentPath),
    sourceCommit: {
      full: commitFull,
      short: commitShort,
      dirty: Boolean(status)
    },
    summary,
    sections
  };

  await fs.writeFile(documentPath, markdown, "utf8");
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`Wrote ${toProjectPath(documentPath)}`);
  console.log(`Wrote ${toProjectPath(metadataPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
