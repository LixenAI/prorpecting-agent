import type { IncomingMessage, ServerResponse } from "node:http";
import { routeProspect, type ProspectRouteInput } from "./_lib/routing.js";

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(
  req: IncomingMessage & { body?: unknown; method?: string },
  res: ServerResponse
): Promise<void> {
  try {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { message: "Method Not Allowed. Use POST." });
      return;
    }

    const body = (await readJsonBody(req)) as ProspectRouteInput;
    const decision = routeProspect(body ?? {});
    sendJson(res, 200, decision);
  } catch (error) {
    console.error("[api:route-prospect] handler error", error);
    sendJson(res, 500, {
      message: "Unexpected error routing prospect.",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
