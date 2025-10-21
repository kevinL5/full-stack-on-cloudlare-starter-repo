import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router";
import { createContext } from "@/worker/trpc/context";

export const app = new Hono<{ Bindings: ServiceBindings }>();

app.all("/trpc/*", (c) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createContext({ req: c.req.raw, env: c.env, workerCtx: c.executionCtx }),
  });
});

app.get("/click-socket", async (c) => {
  const headers = new Headers(c.req.raw.headers);
  headers.set("account-id", "1234567890"); // FIXME: remove this
  const proxiedRequest = new Request(c.req.raw, { headers });
  return c.env.DATA_SERVICE.fetch(proxiedRequest);
});
