import { NextResponse } from "next/server";

const rateLimitMap = new Map();

const rateLimit = (ip) => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 15;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap.get(ip).filter((t) => now - t < windowMs);
  rateLimitMap.set(ip, timestamps);

  if (timestamps.length >= maxRequests) {
    return false;
  }

  timestamps.push(now);
  return true;
};

const parseList = (value) => (value || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const getClientIp = (request) => {
  const headers = request.headers;
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")?.[0]?.trim(),
  ];

  return candidates.find(Boolean) || "";
};

const ipToNumber = (ip) => {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts.reduce((total, part) => (total << 8) + part, 0) >>> 0;
};

const matchesCidr = (ip, cidr) => {
  const [range, bitsText] = cidr.split("/");
  const bits = Number(bitsText);
  const ipNumber = ipToNumber(ip);
  const rangeNumber = ipToNumber(range);

  if (ipNumber === null || rangeNumber === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipNumber & mask) === (rangeNumber & mask);
};

const isLocalNetwork = (ip) => (
  ip === "127.0.0.1" ||
  ip === "::1" ||
  ip.startsWith("10.") ||
  ip.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
);

const isAllowedIp = (ip) => {
  const allowedIps = parseList(process.env.ADMIN_ALLOWED_IPS);

  // Direct `next start` on a LAN IP may not provide x-forwarded-for/x-real-ip.
  // In that mode, rely on authenticated admin routes instead of hard-blocking.
  if (!ip && allowedIps.length === 0) return true;
  if (isLocalNetwork(ip)) return true;
  if (allowedIps.length === 0) return false;

  return allowedIps.some((rule) => {
    if (rule.includes("/")) return matchesCidr(ip, rule);
    return ip === rule;
  });
};

const getAllowedOrigins = (request) => {
  const headers = request.headers;
  const allowed = new Set([request.nextUrl.origin]);
  const proto = headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const forwardedHost = headers.get("x-forwarded-host") || headers.get("host");

  if (forwardedHost) allowed.add(`${proto}://${forwardedHost}`);
  if (process.env.NEXT_PUBLIC_URL) allowed.add(process.env.NEXT_PUBLIC_URL.replace(/\/$/, ""));

  return allowed;
};

export function proxy(request) {
  const clientIp = getClientIp(request);
  const pathname = request.nextUrl?.pathname || "";
  const method = request.method || "GET";

  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = request.headers.get("origin");
    if (origin && !getAllowedOrigins(request).has(origin.replace(/\/$/, ""))) {
      return new NextResponse(JSON.stringify({ error: "Cross-origin request blocked." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if ((pathname === "/api/chat" || pathname === "/api/v1/chat/completions") && !rateLimit(clientIp)) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const requiresIpAllowlist = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (requiresIpAllowlist && !isAllowedIp(clientIp)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
  // Note: /admin/login is intentionally NOT protected to allow admin sign-in
};
