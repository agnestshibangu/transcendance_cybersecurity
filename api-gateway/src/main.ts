import Fastify from "fastify";
import { loadEnv } from "./env";
import { registerProxy } from "./proxy";
const env = loadEnv();

const fastify = Fastify({
  logger: true,
  trustProxy: true, 
});

fastify.addHook("onRequest", async (req, reply) => {
  if (env.frontendUrl) {
    reply.header("access-control-allow-origin", env.frontendUrl);
    reply.header("access-control-allow-credentials", "true");
    reply.header("access-control-allow-headers", "authorization,content-type");
    reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS") return reply.code(204).send();
});

fastify.get("/health", async () => ({
  status: "ok",
  service: "api-gateway",
}));

registerProxy(fastify, [
  { prefix: "/auth", upstream: env.authServiceUrl },
  { prefix: "/db", upstream: env.dbWriterUrl },
]); //! !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ajoute ''api'' sur les deux lignes

async function start() {
  await fastify.listen({ port: env.port, host: "0.0.0.0" });
  fastify.log.info(`api-gateway listening on 0.0.0.0:${env.port}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
