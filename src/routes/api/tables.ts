import { dbManager } from "../../index.js";
import { checkAuth, parseJsonBody } from "../../util.js";
import { RouteHandler, RouteType } from "../index.js";

/** 
 * Tables API Route Handler
 * This handler manages API requests related to database tables.
*/
class TablesApiRouteHandler extends RouteHandler {
    static type = RouteType.METHOD;

    static onGet(req: Request): Promise<Response> | Response {
        if (checkAuth(req) === false)
            return new Response('Unauthorized', { status: 401 });

        if (!dbManager.isConnected())
            return new Response('Database not connected', { status: 500 });

        const url = new URL(req.url);
        const params = url.searchParams;
        const queryResult = dbManager.listTables(params.toJSON());

        return new Response(JSON.stringify(queryResult), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static async onPost(req: Request): Promise<Response> {
        if (checkAuth(req) === false)
            return new Response('Unauthorized', { status: 401 });

        const parsedBody = await parseJsonBody<{ tableName: string }>(req, ['tableName']);
        if (!parsedBody.successful)
            return new Response(parsedBody.error!, { status: 400 });

        const { tableName } = parsedBody.data!;

        if (!dbManager.isConnected())
            return new Response('Database not connected', { status: 500 });

        if (dbManager.getTable(tableName))
            return new Response('Table already exists', { status: 400 });

        const table = dbManager.createTable(tableName);
        return new Response(JSON.stringify(table.getShortData()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export { TablesApiRouteHandler };