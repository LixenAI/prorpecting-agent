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
});
