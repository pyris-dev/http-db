/** Config value types */
type ConfigValueType = string | number | boolean;
type ConfigTypeConstructor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor;

/** Priority levels — lower = higher priority */
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
  envVar: string;
  required: R;
  priority?: ConfigPriority;
  requiredIf?: ConditionalRequirement<C>;
} & (T extends StringConstructor ? { options?: readonly string[] } : object);

/** Map constructor to actual type */
type TypeFromConstructor<T extends ConfigTypeConstructor> =
  T extends StringConstructor
    ? string
    : T extends NumberConstructor
      ? number
      : T extends BooleanConstructor
        ? boolean
        : never;

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

/** Configuration property definitions */
export const ConfigProperties = {
  DEBUG_MODE: {
    type: Boolean,
    envVar: "DEBUG_MODE",
    required: true,
    priority: ConfigPriority.CORE
  },

  // Authentication
  AUTH_ENABLED: {
    type: Boolean,
    envVar: "AUTH_ENABLED",
    required: true,
    priority: ConfigPriority.SYSTEM
  },
  AUTH_KEY: {
    type: String,
    envVar: "AUTH_KEY",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.AUTH_ENABLED === true
  },

  // HTTP
  HOST: {
    type: String,
    envVar: "APP_HOST",
    required: false,
    priority: ConfigPriority.SERVICE
  },
  PORT: {
    type: Number,
    envVar: "APP_PORT",
    required: true,
    priority: ConfigPriority.SYSTEM
  },
  IDLE_TIMEOUT: {
    type: Number,
    envVar: "IDLE_TIMEOUT",
    required: false,
    priority: ConfigPriority.SERVICE
  },
  MAX_REQUEST_BODY_SIZE: {
    type: Number,
    envVar: "MAX_REQUEST_BODY_SIZE",
    required: false,
    priority: ConfigPriority.SERVICE
  },

  // TLS
  TLS_ENABLED: {
    type: Boolean,
    envVar: "TLS_ENABLED",
    required: true,
    priority: ConfigPriority.SYSTEM
  },
  TLS_CERT_PATH: {
    type: String,
    envVar: "TLS_CERT_PATH",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.TLS_ENABLED === true
  },
  TLS_KEY_PATH: {
    type: String,
    envVar: "TLS_KEY_PATH",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.TLS_ENABLED === true
  },

  // Database
  DATABASE_TYPE: {
    type: String,
    envVar: "DATABASE_TYPE",
    required: true,
    priority: ConfigPriority.CORE,
    options: ["embedded", "server"]
  },
  DATABASE_PLATFORM: {
    type: String,
    envVar: "DATABASE_PLATFORM",
    required: true,
    priority: ConfigPriority.SYSTEM,
    options: ["mongodb", "mysql", "sqlite"]
  },
  DATABASE_NAME: {
    type: String,
    envVar: "DATABASE_NAME",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "embedded"
  },
  DATABASE_HOST: {
    type: String,
    envVar: "DATABASE_HOST",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server"
  },
  DATABASE_PORT: {
    type: Number,
    envVar: "DATABASE_PORT",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server"
  },
  DATABASE_USER: {
    type: String,
    envVar: "DATABASE_USER",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server"
  },
  DATABASE_PASSWORD: {
    type: String,
    envVar: "DATABASE_PASSWORD",
    required: false,
    priority: ConfigPriority.FEATURE,
    requiredIf: (cfg) => cfg.DATABASE_TYPE === "server"
  }
} as const satisfies ConfigPropertyRecord;

export type Config = InferConfigType<typeof ConfigProperties>;

function validateDatabaseConfig(config: Config): void {
  const validTypes = ["embedded", "server"];
  const typePlatformCombos: Record<Config["DATABASE_TYPE"], string[]> = {
    embedded: ["sqlite"],
    server: ["mongodb", "mysql"]
  };

  if (!validTypes.includes(config.DATABASE_TYPE!))
    throw new Error(
      `Invalid DATABASE_TYPE: "${config.DATABASE_TYPE}". Supported types are: ${validTypes.join(", ")}`
    );

  if (
    config.DATABASE_TYPE === "embedded" &&
    typePlatformCombos.embedded &&
    !typePlatformCombos.embedded.includes(config.DATABASE_PLATFORM!)
  )
    throw new Error(
      `Invalid database configuration: DATABASE_TYPE='embedded' only supports DATABASE_PLATFORM='sqlite'`
    );

  if (
    config.DATABASE_TYPE === "server" &&
    typePlatformCombos.server &&
    !typePlatformCombos.server.includes(config.DATABASE_PLATFORM!)
  )
    throw new Error(
      `Invalid database configuration: DATABASE_TYPE='server' does not support DATABASE_PLATFORM='sqlite'`
    );

  if (config.DATABASE_TYPE === "embedded" && !config.DATABASE_NAME)
    throw new Error(`Missing required config for sqlite: DATABASE_NAME`);

  if (
    config.DATABASE_TYPE === "server" &&
    (!config.DATABASE_HOST ||
      !config.DATABASE_PORT ||
      !config.DATABASE_USER ||
      !config.DATABASE_PASSWORD)
  )
    throw new Error(
      `Missing required server database config: DATABASE_HOST, DATABASE_PORT, DATABASE_USER, and DATABASE_PASSWORD are required`
    );
}

/** Parse and convert env var string to typed config value */
function parseEnvValue<T extends ConfigValueType>(
  value: string,
  type: ConfigTypeConstructor,
  key: string,
  _envVar: string
): T {
  switch (type) {
    case String:
      return value as T;
    case Number: {
      const num = Number.parseInt(value);
      if (isNaN(num)) throw new Error(`Not a number: "${value}"`);
      return num as T;
    }
    case Boolean:
      if (/^(true|false)$/i.test(value))
        return (value.toLowerCase() === "true") as T;
      throw new Error(`Expected "true" or "false", got "${value}"`);
    default:
      throw new Error(`Unsupported config type for "${key}"`);
  }
}

/** Load and validate configuration */
export function loadConfig(): Config {
  const config: Partial<Config> = {};

  // Sort properties by priority (lower = higher priority)
  const entries = Object.entries(ConfigProperties).sort(
    ([, a], [, b]) =>
      (a.priority ?? ConfigPriority.LOW) - (b.priority ?? ConfigPriority.LOW)
  );

  for (const [key, prop] of entries) {
    const envValue = process.env[prop.envVar];

    // Check unconditional or conditional required
    if (envValue === undefined) {
      const conditionallyRequired =
        "requiredIf" in prop ? (prop.requiredIf(config) ?? false) : false;
      if (prop.required || conditionallyRequired) {
        throw new Error(
          `Missing required config "${key}" (env var: ${prop.envVar})`
        );
      }
      (config as any)[key] = undefined;
      continue;
    }

    const parsedValue = parseEnvValue(envValue, prop.type, key, prop.envVar);

    if (prop.type === String && "options" in prop) {
      const options = (prop as any).options as readonly string[];
      if (options && !options.includes(parsedValue as string)) {
        throw new Error(
          `Invalid value for "${key}" (env var: ${prop.envVar}): "${parsedValue}" is not one of [${options.join(", ")}]`
        );
      }
    }

    (config as any)[key] = parsedValue;
  }

  const finalConfig = config as Config;
  validateDatabaseConfig(finalConfig);
  return finalConfig;
}
