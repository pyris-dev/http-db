import { dbManager } from "../../index.js";
import { checkAuth } from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

/** 
 * Table API Route Handler
 * This handler manages API requests related to a database table.
*/
class TableApiRouteHandler extends RouteHandler {
    static type = RouteType.METHOD;

    static onGet(req: Request): Promise<Response> | Response {
        if (checkAuth(req) === false)
            return new Response('Unauthorized', { status: 401 });

        if (!dbManager.isConnected())
            return new Response('Database not connected', { status: 500 });

        const params = (req as any).params || {};
        const tableName = params.table as string;
        const table = dbManager.getTable(tableName);
        if (!table)
            return new Response('Table not found', { status: 404 });

        return new Response(JSON.stringify(table.getFullData()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async onDelete(req: Request): Promise<Response> {
        if (checkAuth(req) === false)
            return new Response('Unauthorized', { status: 401 });

        if (!dbManager.isConnected())
            return new Response('Database not connected', { status: 500 });

        const params = (req as any).params || {};
        const tableName = params.table as string;
        const table = dbManager.getTable(tableName);
        if (!table)
            return new Response('Table not found', { status: 404 });

        dbManager.deleteTable(tableName);
        return new Response('Table deleted', { status: 200 });
    }
}

export { TableApiRouteHandler };