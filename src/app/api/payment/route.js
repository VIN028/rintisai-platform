import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError } from "@/lib/auth";

const PAYMENT_KEYS = ["gopay_number", "ovo_number", "bank_name", "bank_account", "bank_holder", "crypto_address", "crypto_network", "payment_gopay_enabled", "payment_ovo_enabled", "payment_bank_enabled", "payment_crypto_enabled"];

export async function GET(req) {
  try {
    await authenticateUser(req);
    const rows = await prisma.$queryRawUnsafe('SELECT key, value FROM "Setting"');
    const map = {};
    for (const row of rows) {
      if (PAYMENT_KEYS.includes(row.key)) {
        map[row.key] = row.value;
      }
    }
    return NextResponse.json({ paymentDetails: map });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ paymentDetails: {} });
  }
}
