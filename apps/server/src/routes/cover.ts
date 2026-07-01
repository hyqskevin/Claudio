import type { FastifyInstance } from "fastify";

const NCM_COOKIE = process.env.NCM_COOKIE ?? "";

const ALLOWED_COVER_HOSTS = [
  "p1.music.126.net",
  "p2.music.126.net",
  "p3.music.126.net",
  "p4.music.126.net",
  "p1.music.126.com",
  "p2.music.126.com",
  "p3.music.126.com",
  "p4.music.126.com",
];

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isPrivateIp(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
}

export function isAllowedCoverUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (isPrivateIp(parsed.hostname)) return false;
  if (parsed.hostname === "169.254.169.254") return false;
  return ALLOWED_COVER_HOSTS.includes(parsed.hostname.toLowerCase());
}

export async function coverRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url: string } }>("/api/cover", async (request, reply) => {
    const { url } = request.query;
    if (!isAllowedCoverUrl(url)) {
      reply.code(403);
      return { error: "cover url not allowed" };
    }

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://music.163.com/",
        },
      });
      if (!res.ok) {
        reply.code(res.status);
        return { error: `upstream ${res.status}` };
      }

      reply.header("Content-Type", res.headers.get("content-type") || "image/jpeg");
      reply.header("Cache-Control", "public, max-age=86400");
      reply.header("Access-Control-Allow-Origin", "*");

      const buffer = Buffer.from(await res.arrayBuffer());
      return reply.send(buffer);
    } catch (e: any) {
      reply.code(500);
      return { error: e.message };
    }
  });
}
