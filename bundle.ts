interface PackageJson {
  name?: string;
  version?: string;
}

const LogPrefix = "[BUNDLE]";

const supportsColor = (() => {
  if ((process.env.NO_COLOR ?? "") !== "") return false;
  if ((process.env.FORCE_COLOR ?? "") !== "") return true;
  return Boolean(process.stdout.isTTY);
})();

const Colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
} as const;

function colorize(text: string, color: string): string {
  if (!supportsColor) return text;
  return `${color}${text}${Colors.reset}`;
}

function formatLine(level: string, message: string, color: string): string {
  const prefix = colorize(LogPrefix, Colors.gray);
  const levelTag = colorize(`[${level}]`, color);
  return `${prefix} ${levelTag} ${message}`;
}

function logInfo(message: string): void {
  console.log(formatLine("INFO", message, Colors.cyan));
}

function logStep(message: string): void {
  console.log(formatLine("STEP", message, Colors.blue));
}

function logOk(message: string): void {
  console.log(formatLine(" OK ", message, Colors.green));
}

function logError(message: string): void {
  console.error(formatLine("ERR ", message, Colors.red));
}

async function main() {
  const startedAt = performance.now();
  const packageJson = Bun.file("./package.json");
  if (!(await packageJson.exists())) {
    logError("package.json not found in the current directory");
    process.exit(1);
  }

  logStep("Reading package.json");
  const packageData = JSON.parse(await packageJson.text()) as PackageJson;

  const version = packageData.version ?? "0.0.0";
  const appName = packageData.name ?? "app";
  const outputPath = `./bundle/${appName}-${version}`;
  const artifactPath =
    process.platform === "win32" ? `${outputPath}.exe` : outputPath;

  logInfo(`App: ${appName}`);
  logInfo(`Version: ${version}`);

  logStep("Ensuring output directory exists");
  await Bun.$`mkdir -p ./bundle`;

  logStep("Compiling standalone executable");
  const proc = Bun.spawn(
    ["bun", "build", "--compile", "--outfile", outputPath, "./src/index.ts"],
    {
      stdout: "inherit",
      stderr: "inherit"
    }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    logError(`Build failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  logOk(`Build successful in ${elapsedMs}ms`);
  logOk(`Artifact: ${artifactPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logError(`Build failed: ${message}`);
  process.exit(1);
});
