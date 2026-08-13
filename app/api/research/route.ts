import { NextRequest } from "next/server";
import { buildResearchGraph } from "@/app/lib/research-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let topic: unknown;
  try {
    ({ topic } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return new Response(JSON.stringify({ error: "Topic must be at least 3 characters." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const graph = buildResearchGraph();

        send({ type: "phase", phase: "planning", message: "Breaking your topic into research subtopics…" });

        let reportChunks = "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventStream = (graph as any).streamEvents(
          { topic: topic.trim() },
          { version: "v2" }
        ) as AsyncIterable<any>;

        for await (const rawEvent of eventStream) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const event = rawEvent as { event: string; name?: string; tags?: string[]; data?: any };
          if (
            event.event === "on_chain_end" &&
            event.name === "plan" &&
            event.data?.output?.subtopics
          ) {
            const subtopics: string[] = event.data.output.subtopics;
            send({ type: "subtopics", subtopics });
            send({ type: "phase", phase: "researching", message: "Searching the web in parallel…" });
          }

          if (event.event === "on_chain_end" && event.name === "research") {
            send({ type: "phase", phase: "synthesizing", message: "Synthesizing findings into a report…" });
          }

          if (
            event.event === "on_chat_model_stream" &&
            event.tags?.includes("synthesis")
          ) {
            const chunk = event.data?.chunk;
            if (chunk?.content) {
              const text =
                typeof chunk.content === "string"
                  ? chunk.content
                  : Array.isArray(chunk.content)
                    ? chunk.content
                        .filter((b: { type: string }) => b.type === "text")
                        .map((b: { text: string }) => b.text)
                        .join("")
                    : "";
              if (text) {
                reportChunks += text;
                send({ type: "token", token: text });
              }
            }
          }
        }

        send({ type: "done", report: reportChunks });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
