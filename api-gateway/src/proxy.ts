import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { URL } from "node:url";

type ProxyTarget = Readonly<{
  prefix: string;
  upstream: string; 
}>;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function joinPath(a: string, b: string): string {
  const left = a.endsWith("/") ? a.slice(0, -1) : a;
  const right = b.startsWith("/") ? b : `/${b}`;
  return `${left}${right}`;
}

function cleanHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key)) continue;

    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(", ");
  }

  return out;
}

async function forward(
  req: FastifyRequest,
  reply: FastifyReply,
  upstreamBase: string,
  prefix: string,
) {
  const rawUrl = req.raw.url ?? req.url; 
  const incoming = new URL(rawUrl, "http://gateway.local");

  const rewrittenPath = incoming.pathname.startsWith(prefix)
    ? incoming.pathname.slice(prefix.length) || "/"
    : incoming.pathname;

  const upstream = new URL(upstreamBase);
  const targetUrl = new URL(upstream.toString());
  targetUrl.pathname = joinPath(upstream.pathname || "/", rewrittenPath);
  targetUrl.search = incoming.search;

  const headers = cleanHeaders(req.headers as unknown as Record<string, unknown>);

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });

    reply.code(res.status);

    res.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      reply.header(key, value);
    });

    if (!res.body) return reply.send();

    const webStream = res.body as unknown as NodeWebReadableStream<Uint8Array>;
    const nodeStream = Readable.fromWeb(webStream);

    return reply.send(nodeStream);
  } catch (e) {
    req.log.error({ err: e, target: targetUrl.toString() }, "Upstream fetch failed");
    return reply.code(502).send({ error: "Bad Gateway", target: prefix });
  } finally {
    clearTimeout(timeout);
  }
}

export function registerProxy(fastify: FastifyInstance, targets: readonly ProxyTarget[]) {
  for (const t of targets) {
    fastify.all(`${t.prefix}/*`, async (req, reply) => forward(req, reply, t.upstream, t.prefix));
    fastify.all(t.prefix, async (req, reply) => forward(req, reply, t.upstream, t.prefix));
  }
}
