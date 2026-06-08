const ANSI_RESET = "\x1b[0m";
const ANSI_BOLD = "\x1b[1m";
const ANSI_SCOPE = "\x1b[94m";

const LEVEL_COLORS: Record<string, string> = {
  INFO: "\x1b[36m",
  WARN: "\x1b[33m",
  ERROR: "\x1b[31m",
  AUDIT: "\x1b[35m",
  DEBUG: "\x1b[90m"
};

const LEVEL_WIDTH = Math.max(...Object.keys(LEVEL_COLORS).map((k) => k.length));
const SCOPE_WIDTH = 12;

/**
 * Determines if debug mode is enabled based on the DEBUG_MODE environment variable.
 * @returns True if debug mode is enabled, false otherwise
 */
function isDebugEnabled(): boolean {
  return (process.env.DEBUG_MODE ?? "").toLowerCase() === "true";
}

/**
 * Determines whether to use color in log output based on environment variables and terminal capabilities.
 * - If NO_COLOR is set, color is disabled.
 * - If FORCE_COLOR is set, color is enabled.
 * Otherwise, color is enabled if the output is a TTY (terminal).
 * @returns True if color should be used, false otherwise
 */
function shouldUseColor(): boolean {
  if ((process.env.NO_COLOR ?? "") !== "") return false;
  if ((process.env.FORCE_COLOR ?? "") !== "") return true;
  return Boolean(process.stdout?.isTTY);
}

/**
 * Prints a formatted log header to the console, showing column titles for scope, level, and message.
 * This is intended to be called once at application startup to provide a clear structure for subsequent log entries.
 */
export function printLogHeader(): void {
  const levelTag = "[LEVEL]".padEnd(LEVEL_WIDTH + 2);
  const scopeTag = "[SCOPE]".padEnd(SCOPE_WIDTH + 2);
  const header = `${scopeTag} ${levelTag} [MESSAGE]`;
  console.log(header);
  console.log("-".repeat(header.length * 1.5));
}

/**
 * Log Level type definition
 */
type LogLevel = "INFO" | "WARN" | "ERROR" | "AUDIT" | "DEBUG";

export class Logger {
  private scope: string;
  private readonly scopeColor: string = ANSI_SCOPE;

  constructor(scope: string, color?: string) {
    this.scope = scope;
    if (color) this.scopeColor = color;
  }

  /**
   * Format a log line with consistent structure and optional colorization
   * @param level The log level (e.g. INFO, WARN, ERROR)
   * @param message The log message content
   * @returns The formatted log line string, ready for output
   */
  private formatLine(level: LogLevel, message: string): string {
    const levelTag = `[${level}]`.padEnd(LEVEL_WIDTH + 2);
    const scopeTag = `[${this.scope}]`.padEnd(SCOPE_WIDTH + 2);
    const plain = `${scopeTag} ${levelTag} ${message}`;
    if (!shouldUseColor()) return plain;

    const levelColor = LEVEL_COLORS[level] ?? "";
    const coloredLevel = `${ANSI_BOLD}${levelColor}${levelTag}${ANSI_RESET}`;
    const coloredScope = `${this.scopeColor}${scopeTag}${ANSI_RESET}`;
    return `${coloredScope} ${coloredLevel} ${message}`;
  }

  /**
   * Internal method to write a log line at a specific level
   * @param level The log level for this message
   * @param message The content of the log message
   */
  private write(level: LogLevel, content: any): void {
    const line = this.formatLine(
      level,
      typeof content === "string" ? content : JSON.stringify(content)
    );
    if (level === "ERROR") return console.error(line);
    console.log(line);
  }

  /**
   * Log an informational message
   * @param content The message content to log, can be a string or any serializable object
   */
  public info(content: any): void {
    this.write("INFO", content);
  }

  /**
   * Log a warning message
   * @param content The message content to log, can be a string or any serializable object
   */
  public warn(content: any): void {
    this.write("WARN", content);
  }

  /**
   * Log an error message
   * @param content The message content to log, can be a string or any serializable object
   */
  public error(content: any): void {
    this.write("ERROR", content);
  }

  /**
   * Log an audit message (important events that should be recorded)
   * @param content The message content to log, can be a string or any serializable object
   */
  public audit(content: any): void {
    this.write("AUDIT", content);
  }

  /**
   * Log a debug message (only shown if debug is enabled)
   * @param content The message content to log, can be a string or any serializable object
   */
  public debug(content: any): void {
    if (!isDebugEnabled()) return;

    this.write("DEBUG", content);
  }
}
