import { NextResponse } from "next/server";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import path from "node:path";
import { authenticateUser, AuthError, requireVerifiedEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 45_000;
const MAX_ZIP_ENTRIES = 80;
const MAX_OCR_BYTES = 3 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 1 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 6 * 1024 * 1024;
const OCR_TIMEOUT_MS = 20_000;

try {
  PDFParse.setWorker(path.join(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs"));
} catch {}

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "jsonl", "js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "php", "rb", "c", "cpp", "h", "hpp", "css", "scss", "html", "xml", "yaml", "yml", "toml", "ini", "env", "sql", "sh", "zsh", "log"]);

function extensionOf(name = "") {
  const cleaned = String(name).toLowerCase().split("?")[0];
  const parts = cleaned.split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function trimText(text) {
  return String(text || "").replace(/\u0000/g, "").replace(/\r\n/g, "\n").slice(0, MAX_TEXT_CHARS);
}

function isTextFile(file, ext) {
  return (file.type || "").startsWith("text/") || TEXT_EXTENSIONS.has(ext);
}

function zipEntrySize(entry) {
  return Number(entry?._data?.uncompressedSize || entry?._data?.compressedSize || 0);
}

async function zipEntryString(entry) {
  const size = zipEntrySize(entry);
  if (size > MAX_ZIP_ENTRY_BYTES) throw new Error(`Archive entry is too large: ${entry.name}`);
  const text = await entry.async("string");
  if (text.length > MAX_ZIP_ENTRY_BYTES) throw new Error(`Archive entry is too large: ${entry.name}`);
  return text;
}

function withTimeout(promise, ms, message) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function decodeXml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function workbookToText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const totalSize = Object.values(zip.files).reduce((sum, entry) => sum + (entry.dir ? 0 : zipEntrySize(entry)), 0);
  if (totalSize > MAX_ZIP_TOTAL_BYTES) throw new Error("Spreadsheet is too large after decompression.");
  const sharedEntry = zip.file("xl/sharedStrings.xml");
  const sharedXml = sharedEntry ? await zipEntryString(sharedEntry).catch(() => "") : "";
  const sharedStrings = [...sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => decodeXml([...match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
  const sheetEntries = Object.values(zip.files).filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name)).slice(0, 20);
  const sheets = [];
  for (const entry of sheetEntries) {
    const xml = await zipEntryString(entry);
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
      return [...rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map((cellMatch) => {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const ref = attrs.match(/\br="([^"]+)"/)?.[1] || "";
        const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
        const formula = body.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1]?.trim();
        const raw = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || "";
        const value = type === "s" ? (sharedStrings[Number(raw)] || "") : decodeXml(raw);
        if (formula) return `${ref || "Cell"}: [formula=${decodeXml(formula)}] => ${value}`;
        return `${ref || "Cell"}: ${value}`;
      }).join(" | ");
    }).filter(Boolean);
    sheets.push(`# Sheet: ${entry.name.replace(/^xl\/worksheets\//, "")}\n${rows.join("\n")}`);
  }
  return sheets.join("\n\n");
}

async function zipToText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir).slice(0, MAX_ZIP_ENTRIES);
  const totalSize = entries.reduce((sum, entry) => sum + zipEntrySize(entry), 0);
  if (totalSize > MAX_ZIP_TOTAL_BYTES) throw new Error("Archive is too large after decompression.");
  const parts = [];
  let chars = 0;
  for (const entry of entries) {
    const ext = extensionOf(entry.name);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const text = await zipEntryString(entry).catch(() => "");
    if (!text.trim()) continue;
    const block = `--- ${entry.name} ---\n${text}`;
    parts.push(block.slice(0, Math.max(0, MAX_TEXT_CHARS - chars)));
    chars += block.length;
    if (chars >= MAX_TEXT_CHARS) break;
  }
  return parts.join("\n\n");
}

async function imageToText(buffer) {
  const worker = await createWorker("eng");
  try {
    const result = await withTimeout(worker.recognize(buffer), OCR_TIMEOUT_MS, "Image OCR timed out.");
    return result.data?.text || "";
  } finally {
    await worker.terminate();
  }
}

async function pdfToText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractText(file) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("No file provided.");
  if (file.size > MAX_FILE_BYTES) throw new Error("File is too large. Max 8MB.");

  const ext = extensionOf(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isTextFile(file, ext)) return trimText(buffer.toString("utf8"));
  if (ext === "pdf" || file.type === "application/pdf") return trimText(await pdfToText(buffer));
  if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return trimText((await mammoth.extractRawText({ buffer })).value);
  if (ext === "xlsx" || file.type.includes("spreadsheet")) return trimText(await workbookToText(buffer));
  if (ext === "xls") throw new Error("Legacy .xls files are not supported yet. Save as .xlsx or CSV.");
  if (ext === "zip" || file.type === "application/zip") return trimText(await zipToText(buffer));
  if ((file.type || "").startsWith("image/")) {
    if (file.size > MAX_OCR_BYTES) throw new Error("Image OCR max size is 3MB.");
    return trimText(await imageToText(buffer));
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, XLSX, ZIP, text/code files, CSV, JSON, logs, or images for OCR.");
}

export async function POST(req) {
  try {
    const user = await authenticateUser(req);
    await requireVerifiedEmail(user);

    const form = await req.formData();
    const file = form.get("file");
    const text = await extractText(file);
    if (!text.trim()) {
      return NextResponse.json({ error: "No readable text found in this file." }, { status: 400 });
    }

    return NextResponse.json({
      name: file.name || "attachment",
      type: file.type || "application/octet-stream",
      size: file.size || 0,
      text,
      truncated: text.length >= MAX_TEXT_CHARS,
    });
  } catch (err) {
    const status = err instanceof AuthError || Number.isInteger(err?.status) ? err.status : 400;
    return NextResponse.json({ error: err.message || "Failed to extract file." }, { status });
  }
}
