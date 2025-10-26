import type { RouteHandlerMap } from '../index.js';
import { TestWebRouteHandler } from './test.js';

export enum WebRoutes {
    TEST = '/',
}

export const WebRouteHandlers: RouteHandlerMap<WebRoutes> = {
    [WebRoutes.TEST]: TestWebRouteHandler.toRoute(),
};
