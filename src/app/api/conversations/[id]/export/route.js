import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateUser } from "@/lib/auth";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const user = await authenticateUser(req);

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "md";

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const lines = [];

    if (format === "md" || format === "txt") {
      lines.push(`# ${conversation.title}`);
      lines.push("");

      for (const message of conversation.messages) {
        const roleLabel = message.role === "user" ? "User" : "Assistant";
        if (format === "md") {
          lines.push(`**${roleLabel}**: ${message.content}`);
        } else {
          lines.push(`${roleLabel}: ${message.content}`);
        }
        lines.push("");
      }
    }

    const contentType = format === "txt" ? "text/plain" : "text/markdown";

    return new NextResponse(lines.join("\n"), {
      headers: { "Content-Type": `${contentType}; charset=utf-8` },
    });
  } catch (error) {
    console.error("Export Conversation error:", error);
    return NextResponse.json({ error: "Unauthorized / Server error" }, { status: 401 });
  }
}
