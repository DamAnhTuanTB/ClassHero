import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distMain = join(rootDir, "dist/main.js");

let apiProcess;
let restartTimer;
let hasStartedOnce = false;
let isShuttingDown = false;

const tscProcess = spawn(
  "pnpm",
  ["exec", "tsc", "-w", "-p", "tsconfig.build.json", "--pretty", "false"],
  {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

tscProcess.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (text.includes("Found 0 errors") && existsSync(distMain)) {
    scheduleRestart();
  }
});

tscProcess.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

tscProcess.on("exit", (code, signal) => {
  stopApi();
  if (isShuttingDown) {
    process.exit(0);
  }
  process.exit(code ?? (signal ? 1 : 0));
});

if (existsSync(join(rootDir, "dist"))) {
  watch(join(rootDir, "dist"), { recursive: true }, (_event, filename) => {
    if (filename?.endsWith(".js")) {
      scheduleRestart();
    }
  });
}

function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(
    () => {
      restartApi();
    },
    hasStartedOnce ? 150 : 0,
  );
}

function restartApi() {
  if (!existsSync(distMain)) {
    return;
  }

  stopApi();
  hasStartedOnce = true;
  apiProcess = spawn("node", [distMain], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function stopApi() {
  if (!apiProcess || apiProcess.killed) {
    return;
  }

  apiProcess.kill("SIGTERM");
  apiProcess = undefined;
}

function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  stopApi();
  tscProcess.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
