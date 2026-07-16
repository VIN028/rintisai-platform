import { NextResponse } from "next/server";
import { API_PAYG_MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

const models = [
  ...API_PAYG_MODELS,
  "claude-haiku-4-5",
  "claude-sonnet-5",
  "claude-opus-4-8",
].map((id) => ({ id, owned_by: "rintisai" }));

export async function GET() {
  return NextResponse.json({
    object: "list",
    data: models.map((model) => ({
      id: model.id,
      object: "model",
      created: 0,
      owned_by: model.owned_by,
    })),
  });
}
