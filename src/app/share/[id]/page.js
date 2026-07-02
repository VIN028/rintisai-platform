import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import Link from "next/link";

async function getConversation(id) {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conv || !conv.shared) return null;
  return conv;
}

export default async function SharePage({ params }) {
  const { id } = await params;
  const conv = await getConversation(id);
  if (!conv) notFound();

  return (
    <main className="min-h-screen bg-main text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-xl font-bold">{conv.title}</h1>
            <p className="text-xs text-gray-500 mt-1">{conv.messages.length} messages</p>
          </div>
          <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300">
            Powered by RintisAI
          </Link>
        </div>

        <div className="space-y-6">
          {conv.messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v1H6a3 3 0 00-3 3v8a3 3 0 003 3h12a3 3 0 003-3V9a3 3 0 00-3-3h-3V5a3 3 0 00-3-3zM6 8h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V9a1 1 0 011-1z"/></svg>
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-md" : "bg-white/[0.04] border border-white/5 rounded-bl-md"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
