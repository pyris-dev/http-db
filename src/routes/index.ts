// Re-export base route types and API route handlers
export * from "./base.js";
export * from "./api/index.js";
export * from "./home.js";

import { ApiRouteHandlers } from "./api/index.js";
import { WebRouteHandlers } from "./home.js";

export const AppRouteHandlers = {
  ...WebRouteHandlers,
  ...ApiRouteHandlers
};
