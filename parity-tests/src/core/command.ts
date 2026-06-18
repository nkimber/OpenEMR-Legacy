import { spawn } from "node:child_process";

export type CommandResult = {
  command: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export async function runCommand(command: string[], options: { cwd: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }): Promise<CommandResult> {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error("Cannot run an empty command.");
  }

  const startedAt = new Date();
  const timeoutMs = options.timeoutMs ?? 120_000;

  return await new Promise<CommandResult>((resolve) => {
    const spawnCommand = normalizeSpawnCommand(command);
    const child = spawn(spawnCommand.command, spawnCommand.args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        ...options.env
      }
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      stderr += `\nCommand timed out after ${timeoutMs} ms.`;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const finishedAt = new Date();
      resolve({
        command,
        cwd: options.cwd,
        exitCode,
        stdout,
        stderr,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime()
      });
    });
  });
}

export function preview(text: string, maxLength = 2400) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n... truncated ...`;
}

function normalizeSpawnCommand(command: string[]) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(command[0])) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command.map(quoteWindowsArg).join(" ")]
    };
  }

  return {
    command: command[0],
    args: command.slice(1)
  };
}

function quoteWindowsArg(value: string) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}
