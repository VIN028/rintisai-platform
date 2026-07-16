import { NextResponse } from "next/server";
import { API_ENDPOINT_STATUS, API_INCIDENTS, API_MODEL_GROUPS } from "@/lib/api-products";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const models = API_MODEL_GROUPS.map((group) => ({
    ...group,
    modelCount: (group.models?.length || 0) + (group.anthropicModels?.length || 0),
  }));
  const degraded = [...models, ...API_ENDPOINT_STATUS].some((item) => !["operational", "available"].includes(item.status));

  return NextResponse.json({
    status: degraded ? "degraded" : "operational",
    checkedAt: new Date().toISOString(),
    responseMs: Date.now() - startedAt,
    checkType: "route-and-configuration",
    note: "Model group availability means the product route is configured. Live upstream health is verified by actual chat/API requests.",
    endpoints: API_ENDPOINT_STATUS,
    modelGroups: models,
    incidents: API_INCIDENTS,
    docsUrl: "https://rintisai.site/docs/api",
  });
}
