
import { initDatabase } from "@repo/data-ops/database";
import { app } from "./hono/app";

export default {
  fetch(request, env, ctx) {
    initDatabase(env.DB);
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<ServiceBindings>;
