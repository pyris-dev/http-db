import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { Logger } from "./logger.js";

/** Config value types */
type ConfigValueType = string | number | boolean;
type ConfigTypeConstructor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor;

/** Map constructor to actual type */
type TypeFromConstructor<T extends ConfigTypeConstructor> =
  T extends StringConstructor
    ? string
    : T extends NumberConstructor
      ? number
      : T extends BooleanConstructor
        ? boolean
        : never;

/** Priority levels - lower = higher priority */
export const enum ConfigPriority {
  CORE = 1, // Must be loaded first
  SYSTEM = 2, // System-level configs that others depend on
  SERVICE = 3, // General app settings
  FEATURE = 4, // Optional or dependent settings
  LOW = 100 // Default fallback
}

/** Conditional requirement definition */
type ConditionalRequirement<T> = (config: Partial<T>) => boolean;

/** Configuration property definition */
type ConfigProperty<
  T extends ConfigTypeConstructor,
  R extends boolean,
  C extends Record<string, any> = any
> = {
  type: T;
  required: R;
  defaultValue: TypeFromConstructor<T>;
  section?: string;
  priority?: ConfigPriority;
  requiredIf?: ConditionalRequirement<C>;
  comments?: string[];
} & (T extends StringConstructor ? { options?: readonly string[] } : object);

/** Infer config types from property definitions */
type InferConfigType<T extends Record<string, ConfigProperty<any, boolean>>> = {
  [K in keyof T]: T[K]["required"] extends true
    ? TypeFromConstructor<T[K]["type"]>
    : TypeFromConstructor<T[K]["type"]> | undefined;
};

type ConfigPropertyRecord = Record<
  string,
  ConfigProperty<ConfigTypeConstructor, boolean>
>;

const CONFIG_FILE_NAME = "config.yaml";

/** Configuration property definitions */
export const ConfigProperties = {
  DEBUG_MODE: {
    type: Boolean,
    required: true,
    defaultValue: true,
    priority: ConfigPriority.CORE
  },

  // Authentication
  AUTH_ENABLED: {
    type: Boolean,
    required: true,
    defaultValue: true,
    section: "Authentication Settings",
    comments: ["Enable or disable authentication."],
    priority: ConfigPriority.SYSTEM
  },
  AUTH_KEY: {
    type: String,
    required: false,
    defaultValue: "yoursupersecretkey",
    section: "Authentication Settings",
    comments: ["Bearer token used when authentication is enabled."],
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.AUTH_ENABLED === true
  },

  // HTTP
  HOST: {
    type: String,
    required: false,
    defaultValue: "localhost",
    section: "Http Settings",
    comments: ["Application host."],
    priority: ConfigPriority.SERVICE
  },
  PORT: {
    type: Number,
    required: true,
    defaultValue: 3000,
    section: "Http Settings",
    comments: ["Application port."],
    priority: ConfigPriority.SYSTEM
  },
  IDLE_TIMEOUT: {
    type: Number,
    required: false,
    defaultValue: 15,
    section: "Http Settings",
    comments: ["Connection idle timeout in seconds."],
    priority: ConfigPriority.SERVICE
  },
  MAX_REQUEST_BODY_SIZE: {
    type: Number,
    required: false,
    defaultValue: 10485760,
    section: "Http Settings",
    comments: ["Maximum request body size in bytes (e.g., 10MB)."],
    priority: ConfigPriority.SERVICE
  },

  // TLS
  TLS_ENABLED: {
    type: Boolean,
    required: true,
    defaultValue: false,
    section: "Http Settings",
    comments: ["Enable TLS (true/false)."],
    priority: ConfigPriority.SYSTEM
  },
  TLS_CERT_PATH: {
    type: String,
    required: false,
    defaultValue: "./certs/cert.pem",
    section: "Http Settings",
    comments: ["Path to the TLS certificate file."],
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.TLS_ENABLED === true
  },
  TLS_KEY_PATH: {
    type: String,
    required: false,
    defaultValue: "./certs/key.pem",
    section: "Http Settings",
    comments: ["Path to the TLS private key file."],
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.TLS_ENABLED === true
  },

  // Database
  DATABASE_TYPE: {
    type: String,
    required: true,
    defaultValue: "embedded",
    section: "Database Settings",
    comments: ["Options: embedded, server."],
    priority: ConfigPriority.CORE,
    options: ["embedded", "server"]
  },
  DATABASE_PLATFORM: {
    type: String,
    required: true,
    defaultValue: "sqlite",
    section: "Database Settings",
    comments: [
      "Options:",
      '  (Embedded)  "sqlite"',
      '  (Server)    "mysql", "mongodb"'
    ],
    priority: ConfigPriority.SYSTEM,
    options: ["mongodb", "mysql", "sqlite"]
  },
  DATABASE_NAME: {
    type: String,
    required: false,
    defaultValue: "database.db",
    section: "Database Settings (Embedded)",
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "embedded",
    comments: ["The database name/file path."]
  },
  DATABASE_HOST: {
    type: String,
    required: false,
    defaultValue: "localhost",
    section: "Database Settings (Server)",
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server",
    comments: ["The database host URL or IP address."]
  },
  DATABASE_PORT: {
    type: Number,
    required: false,
    defaultValue: 5432,
    section: "Database Settings (Server)",
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server",
    comments: ["The database port number."]
  },
  DATABASE_USER: {
    type: String,
    required: false,
    defaultValue: "db_user",
    section: "Database Settings (Server)",
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server",
    comments: ["The database user name."]
  },
  DATABASE_PASSWORD: {
    type: String,
    required: false,
    defaultValue: "db_password",
    section: "Database Settings (Server)",
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server",
    comments: ["The database user password."]
  }
} as const satisfies ConfigPropertyRecord;

export type Config = InferConfigType<typeof ConfigProperties>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfigValue<T extends ConfigValueType>(
  value: unknown,
  type: ConfigTypeConstructor,
  key: string
): T {
  switch (type) {
    case String:
      if (typeof value === "string") return value as T;
      throw new Error(`Invalid config value for "${key}": expected string`);
    case Number:
      if (typeof value === "number" && Number.isFinite(value))
        return value as T;
      if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return parsed as T;
      }
      throw new Error(`Invalid config value for "${key}": expected number`);
    case Boolean:
      if (typeof value === "boolean") return value as T;
      if (typeof value === "string" && /^(true|false)$/i.test(value))
        return (value.toLowerCase() === "true") as T;
      throw new Error(`Invalid config value for "${key}": expected boolean`);
    default:
      throw new Error(`Unsupported config type for "${key}"`);
  }
}

function buildDefaultConfigYaml(
  defaults: Record<string, ConfigValueType>
): string {
  const ROOT_SECTION = "__root__";
  const lines: string[] = [
    "# Auto-generated config file",
    "# Edit values as needed and restart the server",
    ""
  ];

  const groupedEntries = new Map<
    string,
    Array<[string, (typeof ConfigProperties)[keyof typeof ConfigProperties]]>
  >();

  for (const entry of Object.entries(ConfigProperties)) {
    const [key, prop] = entry;
    const section =
      "section" in prop && prop.section ? prop.section : ROOT_SECTION;
    const existing = groupedEntries.get(section);
    if (existing) {
      existing.push([key, prop]);
      continue;
    }
    groupedEntries.set(section, [[key, prop]]);
  }

  for (const [section, entries] of groupedEntries) {
    if (section !== ROOT_SECTION) {
      if (lines[lines.length - 1] !== "") lines.push("");
      lines.push("# ----------------------------");
      lines.push(`#   ${section}`);
      lines.push("# ----------------------------");
      lines.push("");
    }

    for (const [key, prop] of entries) {
      if ("comments" in prop && prop.comments?.length)
        for (const commentLine of prop.comments) lines.push(`# ${commentLine}`);

      const yamlLine = stringify({ [key]: defaults[key] }).trimEnd();
      lines.push(yamlLine);
    }
  }

  return `${lines.join("\n")}\n`;
}

function loadRawConfig(): {
  rawConfig: Record<string, unknown>;
  created: boolean;
} {
  const configPath = resolve(CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
    const defaults: Record<string, ConfigValueType> = {};
    for (const [key, prop] of Object.entries(ConfigProperties))
      defaults[key] = prop.defaultValue;

    writeFileSync(configPath, buildDefaultConfigYaml(defaults), "utf8");
    return { rawConfig: defaults, created: true };
  }

  const parsed = parse(readFileSync(configPath, "utf8"));
  if (!isPlainObject(parsed))
    throw new Error(`Invalid ${CONFIG_FILE_NAME}: expected a YAML object`);

  return { rawConfig: parsed, created: false };
}

function getDatabaseConfigErrors(config: Partial<Config>): string[] {
  const errors: string[] = [];
  const validTypes = ["embedded", "server"];
  const typePlatformCombos: Record<Config["DATABASE_TYPE"], string[]> = {
    embedded: ["sqlite"],
    server: ["mongodb", "mysql"]
  };

  if (config.DATABASE_TYPE && !validTypes.includes(config.DATABASE_TYPE))
    errors.push(
      `Invalid DATABASE_TYPE: "${config.DATABASE_TYPE}". Supported types are: ${validTypes.join(", ")}`
    );

  if (config.DATABASE_TYPE && config.DATABASE_PLATFORM) {
    const allowedPlatforms = typePlatformCombos[config.DATABASE_TYPE];
    if (
      !allowedPlatforms ||
      !allowedPlatforms.includes(config.DATABASE_PLATFORM)
    )
      errors.push(
        `Invalid database configuration: DATABASE_TYPE='${config.DATABASE_TYPE}' does not support DATABASE_PLATFORM='${config.DATABASE_PLATFORM}'`
      );
  }

  if (config.DATABASE_TYPE === "embedded" && !config.DATABASE_NAME)
    errors.push("Missing required config for sqlite: DATABASE_NAME");

  if (
    config.DATABASE_TYPE === "server" &&
    (!config.DATABASE_HOST ||
      !config.DATABASE_PORT ||
      !config.DATABASE_USER ||
      !config.DATABASE_PASSWORD)
  )
    errors.push(
      "Missing required server database config: DATABASE_HOST, DATABASE_PORT, DATABASE_USER, and DATABASE_PASSWORD are required"
    );

  return errors;
}

const ConfigLogger = new Logger("CONFIG", "\x1b[35m");

/** Load and validate configuration */
export function loadConfig(): Config | null {
  let rawConfig: Record<string, unknown>;
  let created = false;

  try {
    ({ rawConfig, created } = loadRawConfig());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ConfigLogger.error(message);
    return null;
  }

  if (created) {
    ConfigLogger.warn(`"${CONFIG_FILE_NAME}" was missing.`);
    ConfigLogger.warn(
      `Generated a default file in "${resolve(CONFIG_FILE_NAME)}"\n`
    );
  }

  const config: Partial<Config> = {};
  const errors: string[] = [];

  const entries = Object.entries(ConfigProperties).sort(
    ([, a], [, b]) =>
      (a.priority ?? ConfigPriority.LOW) - (b.priority ?? ConfigPriority.LOW)
  );

  for (const [key, prop] of entries) {
    const rawValue = rawConfig[key];

    if (rawValue === undefined || rawValue === null) {
      const conditionallyRequired =
        "requiredIf" in prop ? (prop.requiredIf(config) ?? false) : false;

      if (prop.required || conditionallyRequired)
        errors.push(
          `Missing required config key "${key}" in ${CONFIG_FILE_NAME}`
        );

      (config as any)[key] = undefined;
      continue;
    }

    let parsedValue: ConfigValueType;
    try {
      parsedValue = parseConfigValue(rawValue, prop.type, key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      (config as any)[key] = undefined;
      continue;
    }

    if (prop.type === String && "options" in prop) {
      const options = (prop as any).options as readonly string[] | undefined;
      if (options && !options.includes(parsedValue as string))
        errors.push(
          `Invalid value for "${key}": "${parsedValue}" is not one of [${options.join(", ")}]`
        );
    }

    (config as any)[key] = parsedValue;
  }

  errors.push(...getDatabaseConfigErrors(config));

  if (errors.length > 0) {
    ConfigLogger.error(`Found ${errors.length} configuration error(s):`);
    for (const error of errors) ConfigLogger.error(`- ${error}`);
    return null;
  }

  return config as Config;
}
