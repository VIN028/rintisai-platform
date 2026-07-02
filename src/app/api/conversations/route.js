import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser, AuthError } from "@/lib/auth";

export async function GET(req) {
  try {
    const user = await authenticateUser(req);
    const userId = user.id;

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: { messages: { take: 1, orderBy: { createdAt: "desc" }, select: { content: true } } },
      orderBy: { updatedAt: "desc" },
    });

    const result = conversations.map((c) => ({
      ...c,
      latestPreview: c.messages?.[0]?.content?.replace(/\\n/g, " ").replace(/\n/g, " ").slice(0, 60) || "",
      messages: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET Conversations error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
