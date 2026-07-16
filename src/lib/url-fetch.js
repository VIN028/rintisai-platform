import dns from "node:dns/promises";
import net from "node:net";

const MAX_URLS = 3;
const MAX_FETCH_CHARS = 12_000;
const FETCH_TIMEOUT_MS = 4_000;
const URL_CONTEXT_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const URL_PATTERN = /https?:\/\/[^\s)\]"'<>]+/gi;
const EXPLICIT_FETCH_PATTERN = /\[\s*(?:fetch_url|Tool:\s*fetch_url)\s*(?:for)?\s*["']([^"']+)["']\s*\]/gi;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 180) : "";
}

export function extractFetchUrlsFromText(text) {
  const source = String(text || "");
  const urls = [];
  for (const match of source.matchAll(EXPLICIT_FETCH_PATTERN)) urls.push(match[1]);
  for (const match of source.matchAll(URL_PATTERN)) urls.push(match[0]);

  const unique = [];
  for (const rawUrl of urls) {
    const cleaned = rawUrl.replace(/[.,;:]+$/g, "");
    if (!unique.includes(cleaned)) unique.push(cleaned);
    if (unique.length >= MAX_URLS) break;
  }
  return unique;
}

async function validatePublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http/https URLs are allowed");
  const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (addresses.some((entry) => isPrivateIp(entry.address))) throw new Error("Private/internal URLs are not allowed");
  return parsed.toString();
}

async function validateResponseUrl(response) {
  if (!response?.url) return;
  await validatePublicHttpUrl(response.url);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let currentUrl = await validatePublicHttpUrl(url);
    let response;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "RintisAI-WebFetcher/1.0",
          Accept: "text/html, text/plain, application/xhtml+xml, application/xml;q=0.9, */*;q=0.5",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) break;
      currentUrl = await validatePublicHttpUrl(new URL(location, currentUrl).toString());
    }
    if ([301, 302, 303, 307, 308].includes(response?.status)) throw new Error("Too many redirects");
    await validateResponseUrl(response);
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = contentType.includes("text/plain") ? body.replace(/\s+/g, " ").trim() : stripHtml(body);
    return { title: contentType.includes("text/html") ? titleFromHtml(body) : "", text };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithFallback(validatedUrl) {
  try {
    return await fetchText(validatedUrl);
  } catch (err) {
    const parsed = new URL(validatedUrl);
    const jinaTarget = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
    const jinaUrl = `https://r.jina.ai/${jinaTarget}`;
    try {
      return await fetchText(jinaUrl);
    } catch {
      const directJinaUrl = `https://r.jina.ai/${jinaTarget}`;
      return await fetchText(directJinaUrl).catch(() => { throw err; });
    }
  }
}

export async function fetchUrlContextsFromText(text) {
  const urls = extractFetchUrlsFromText(text);
  if (urls.length === 0) return [];

  const fetchOne = async (rawUrl) => {
    try {
      const validatedUrl = await validatePublicHttpUrl(rawUrl);
      const fetched = await fetchWithFallback(validatedUrl);
      return {
        url: validatedUrl,
        title: fetched.title,
        text: fetched.text.slice(0, MAX_FETCH_CHARS),
      };
    } catch (err) {
      return { url: rawUrl, error: err.message || "Failed to fetch URL" };
    }
  };

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(urls.map((url) => ({ url, error: "URL fetch timed out" }))), URL_CONTEXT_TIMEOUT_MS);
  });
  return Promise.race([Promise.all(urls.map(fetchOne)), timeout]);
}

export function formatFetchedUrlContext(contexts) {
  if (!contexts?.length) return "";
  return contexts.map((item, index) => {
    if (item.error) return `URL ${index + 1}: ${item.url}\nFetch error: ${item.error}`;
    return `URL ${index + 1}: ${item.url}\nTitle: ${item.title || "Untitled"}\nContent excerpt:\n${item.text}`;
  }).join("\n\n---\n\n");
}

export function appendTextToContent(content, extraText) {
  if (!extraText) return content;
  if (typeof content === "string") return `${content}\n\n${extraText}`;
  if (Array.isArray(content)) return [...content, { type: "text", text: extraText }];
  return `${JSON.stringify(content || "")}\n\n${extraText}`;
}
