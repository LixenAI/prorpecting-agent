import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import handler from "../api/route-prospect";

type CapturedResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
};

function makeReq(
  method: string,
  body?: unknown,
  preParsed = false
): IncomingMessage & { body?: unknown } {
  const payload = body == null ? "" : JSON.stringify(body);
  const stream = Readable.from(payload ? [Buffer.from(payload)] : []);
  const req = Object.assign(stream, {
    method,
    url: "/api/route-prospect",
    headers: { "content-type": "application/json" }
  }) as unknown as IncomingMessage & { body?: unknown };
  if (preParsed && body !== undefined) {
    (req as { body?: unknown }).body = body;
  }
  return req;
}

function makeRes(): { res: ServerResponse; captured: Promise<CapturedResponse> } {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  const chunks: Buffer[] = [];
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  res.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return originalWrite(chunk as never, ...(rest as []));
  }) as typeof res.write;
  const captured = new Promise<CapturedResponse>((resolve) => {
    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      const result = originalEnd(chunk as never, ...(rest as []));
      const body = Buffer.concat(chunks).toString("utf8");
      const headers: Record<string, string> = {};
      for (const name of res.getHeaderNames()) {
        const value = res.getHeader(name);
        if (value != null) headers[name] = String(value);
      }
      resolve({
        statusCode: res.statusCode,
        headers,
        body,
        json: () => (body ? JSON.parse(body) : null)
      });
      return result;
    }) as typeof res.end;
  });
  return { res, captured };
}

async function invoke(
  method: string,
  body?: unknown,
  preParsed = false
): Promise<CapturedResponse> {
  const req = makeReq(method, body, preParsed);
  const { res, captured } = makeRes();
  await handler(req, res);
  return captured;
}

describe("api/route-prospect serverless handler", () => {
  it("routes a Hot lead with score>=60 to Outreach Caller via streamed JSON body", async () => {
    const response = await invoke("POST", {
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example",
      leadScore: 82
    });
    expect(response.statusCode).toBe(200);
    const decision = response.json() as { route: string; tags: string[] };
    expect(decision.route).toBe("Outreach Caller");
    expect(decision.tags).toContain("medspa_ai_call_queued");
  });

  it("returns needs_enrichment_data when required fields are missing", async () => {
    const response = await invoke("POST", {});
    expect(response.statusCode).toBe(200);
    const decision = response.json() as { route: string; tags: string[]; missingFields: string[] };
    expect(decision.route).toBe("General/Status Alignment");
    expect(decision.tags).toContain("needs_enrichment_data");
    expect(decision.missingFields).toEqual(["businessName", "city", "website"]);
  });

  it("accepts a pre-parsed body (as Vercel provides for JSON requests)", async () => {
    const response = await invoke(
      "POST",
      { businessName: "Glow", city: "Irvine", website: "https://glow.example", qualificationStatus: "Hot" },
      true
    );
    expect(response.statusCode).toBe(200);
    expect((response.json() as { route: string }).route).toBe("Outreach Caller");
  });

  it("answers OPTIONS preflight with 204 and CORS headers", async () => {
    const response = await invoke("OPTIONS");
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("rejects non-POST methods with 405", async () => {
    const response = await invoke("GET");
    expect(response.statusCode).toBe(405);
  });

  it("matches the production smoke-test body that previously returned 500", async () => {
    const response = await invoke(
      "POST",
      {
        businessName: "Glow Med Spa",
        city: "Irvine",
        website: "https://glow.example",
        leadScore: 82
      },
      true
    );
    expect(response.statusCode).toBe(200);
    const decision = response.json() as { route: string; tags: string[] };
    expect(decision.route).toBe("Outreach Caller");
    expect(decision.tags).toContain("medspa_ai_call_queued");
  });

  it("matches the production smoke-test body with empty strings (previously 500)", async () => {
    const response = await invoke(
      "POST",
      { businessName: "Glow Med Spa", city: "", website: "" },
      true
    );
    expect(response.statusCode).toBe(200);
    const decision = response.json() as {
      route: string;
      tags: string[];
      missingFields: string[];
    };
    expect(decision.route).toBe("General/Status Alignment");
    expect(decision.tags).toContain("needs_enrichment_data");
    expect(decision.missingFields).toEqual(["city", "website"]);
  });

  it("returns a JSON error (not FUNCTION_INVOCATION_FAILED) if the body stream throws", async () => {
    const broken = Readable.from(
      (function* () {
        throw new Error("boom: simulated upstream stream failure");
        // eslint-disable-next-line no-unreachable
        yield Buffer.from("");
      })()
    );
    const req = Object.assign(broken, {
      method: "POST",
      url: "/api/route-prospect",
      headers: { "content-type": "application/json" }
    }) as unknown as IncomingMessage & { body?: unknown };
    const { res, captured } = makeRes();
    await handler(req, res);
    const response = await captured;
    expect(response.statusCode).toBe(500);
    const payload = response.json() as { message: string; error: string };
    expect(payload.message).toMatch(/Unexpected error/);
    expect(payload.error).toMatch(/boom/);
  });
});

describe("api/route-prospect deploy-safe layout", () => {
  it("only imports from within the api/ tree so Vercel bundles all deps", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "..", "api");
    const visited = new Set<string>();
    const queue: string[] = [path.join(root, "route-prospect.ts")];
    const importRe = /from\s+["']([^"']+)["']/g;
    while (queue.length) {
      const file = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);
      const src = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(src))) {
        const spec = m[1];
        if (!spec.startsWith(".")) continue;
        expect(
          spec.endsWith(".js"),
          `relative import in ${path.relative(root, file)} must use .js extension for Node ESM: "${spec}"`
        ).toBe(true);
        const resolvedDir = path.dirname(file);
        const candidate = path.resolve(resolvedDir, spec.replace(/\.js$/, ".ts"));
        expect(
          candidate.startsWith(root + path.sep) || candidate === root,
          `api/ handler imports must live under api/ (got ${candidate})`
        ).toBe(true);
        queue.push(candidate);
      }
    }
    expect(visited.size).toBeGreaterThan(1);
  });
});
