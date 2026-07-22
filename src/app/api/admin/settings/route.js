import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateAdmin } from "@/lib/auth";

const DEFAULT_SETTINGS = {
  gopay_number: "",
  ovo_number: "",
  bank_name: "",
  bank_account: "",
  bank_holder: "",
  crypto_address: "",
  crypto_network: "TRC20",
  payment_gopay_enabled: "true",
  payment_ovo_enabled: "true",
  payment_bank_enabled: "true",
  payment_crypto_enabled: "true",
};

async function getSettings() {
  const rows = await prisma.$queryRawUnsafe('SELECT key, value FROM "Setting"');
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

async function setSetting(key, value) {
  await prisma.$executeRaw`INSERT INTO "Setting" (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = ${value}`;
}

export async function GET(req) {
  try {
    await authenticateAdmin(req);
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PATCH(req) {
  try {
    await authenticateAdmin(req);
    const body = await req.json().catch(() => ({}));

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        await setSetting(key, value);
      }
    }

    const settings = await getSettings();
    return NextResponse.json({ message: "Settings updated.", settings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
