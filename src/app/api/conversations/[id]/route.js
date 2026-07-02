import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser } from "@/lib/auth";
import { getActivePlan } from "../../auth/me/route";
import { ALLOWED_MODELS, getMaxContextTokens, getMaxOutputTokens } from "@/lib/models";
import { compactMessagesForContext } from "@/lib/context";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const user = await authenticateUser(req);
    const userId = user.id;
    const url = new URL(req.url);
    const requestedModel = url.searchParams.get("model") || "gpt-5.4-mini";
    const selectedModel = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "gpt-5.4-mini";
    const plan = getActivePlan(user.subscription);

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const maxContextTokens = getMaxContextTokens(selectedModel, plan);
    const maxOutputTokens = getMaxOutputTokens(selectedModel, plan);
    const contextPlan = compactMessagesForContext({
      messages: conversation.messages.map((message) => ({ role: message.role, content: message.content })),
      maxContextTokens,
      maxOutputTokens,
    });

    return NextResponse.json({
      ...conversation,
      contextUsage: {
        used: contextPlan.contextUsed,
        displayUsed: contextPlan.displayTokens,
        limit: maxContextTokens,
        percent: maxContextTokens && contextPlan.displayTokens > 0 ? Math.max(1, Math.min(100, Math.round((contextPlan.displayTokens / maxContextTokens) * 100))) : 0,
        compacted: contextPlan.compacted,
        omittedMessages: contextPlan.omittedMessages,
      },
    });
  } catch (error) {
    console.error("GET Conversation Detail error:", error);
    return NextResponse.json({ error: "Unauthorized / Server error" }, { status: 401 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const user = await authenticateUser(req);
    const userId = user.id;
    const { title, shared } = await req.json();

    if (!title || title.trim() === "") {
      return NextResponse.json({ error: "Judul tidak boleh kosong" }, { status: 400 });
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existingConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const data = { title: title.trim() };
    if (typeof shared === "boolean") data.shared = shared;

    const updated = await prisma.conversation.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH Conversation error:", error);
    return NextResponse.json({ error: "Unauthorized / Server error" }, { status: 401 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const user = await authenticateUser(req);
    const userId = user.id;

    const existingConversation = await prisma.conversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existingConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("DELETE Conversation error:", error);
    return NextResponse.json({ error: "Unauthorized / Server error" }, { status: 401 });
  }
}
