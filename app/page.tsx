"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Phase = "idle" | "planning" | "researching" | "synthesizing" | "done" | "error";

const STEPS: { key: Phase; label: string; icon: string }[] = [
  { key: "planning",     label: "Plan",       icon: "◈" },
  { key: "researching",  label: "Search",     icon: "⊙" },
  { key: "synthesizing", label: "Synthesize", icon: "◎" },
  { key: "done",         label: "Done",       icon: "✦" },
];

const EXAMPLE_TOPICS = [
  "The future of AI in healthcare",
  "How quantum computing will break encryption",
  "Climate tech startups and carbon capture",
  "The psychology of social media addiction",
];

function stepIndex(p: Phase) {
  return STEPS.findIndex((s) => s.key === p);
}

export default function Home() {
  const [topic, setTopic]               = useState("");
  const [phase, setPhase]               = useState<Phase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [subtopics, setSubtopics]       = useState<string[]>([]);
  const [report, setReport]             = useState("");
  const [error, setError]               = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRunning  = phase !== "idle" && phase !== "done" && phase !== "error";
  const currentIdx = stepIndex(phase);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setPhase("planning");
    setPhaseMessage("Breaking your topic into research subtopics…");
    setSubtopics([]);
    setReport("");
    setError("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: Record<string, unknown>;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "phase") {
            setPhase(event.phase as Phase);
            setPhaseMessage(event.message as string);
          } else if (event.type === "subtopics") {
            setSubtopics(event.subtopics as string[]);
          } else if (event.type === "token") {
            setReport((prev) => prev + (event.token as string));
          } else if (event.type === "done") {
            setPhase("done");
            setPhaseMessage("Report ready.");
            if (event.report) setReport(event.report as string);
          } else if (event.type === "error") {
            throw new Error(event.message as string);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Something went wrong.");
      setPhase("error");
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setPhase("idle");
    setPhaseMessage("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleDownload() {
    const blob = new Blob([report], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${topic.slice(0, 40).replace(/\s+/g, "-")}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {/* Skip nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Dot-grid background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-dot-grid opacity-40" />

      {/* Ambient glow blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-700/20 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none fixed -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-700/15 blur-[120px]" />

      <main id="main-content" aria-busy={isRunning} className="relative mx-auto max-w-3xl px-5 pb-24 pt-16">

        {/* ── Header ─────────────────────────────────── */}
        <header className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse motion-reduce:animate-none" />
            LangGraph · AI Research · Tavily Search
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="gradient-text">Autonomous</span>
            <br />
            <span className="text-zinc-100">Research Agent</span>
          </h1>
          <p className="mt-4 text-zinc-400 text-base max-w-md mx-auto leading-relaxed">
            Enter a topic — the agent plans subtopics, searches the web in parallel, and synthesizes a full report.
          </p>
        </header>

        {/* ── Search form ────────────────────────────── */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="glass rounded-2xl p-1.5">
            <div className="flex gap-2">
              <label htmlFor="research-topic" className="sr-only">Research topic</label>
              <input
                id="research-topic"
                ref={inputRef}
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. The impact of quantum computing on cryptography"
                disabled={isRunning}
                className="glow-ring flex-1 rounded-xl bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
              />
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="shrink-0 rounded-xl bg-red-500/20 border border-red-500/30 px-5 py-3 text-sm font-medium text-red-400 transition-all hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!topic.trim()}
                  className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  Research <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Example topics */}
        {phase === "idle" && (
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {EXAMPLE_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className="min-h-[44px] rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs text-zinc-400 transition-all hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* ── Progress stepper ───────────────────────── */}
        {phase !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Research progress"
            className="animate-fade-up glass mb-6 rounded-2xl p-5"
          >
            <div className="flex items-center">
              {STEPS.map((step, i) => {
                const isDone   = phase === "done" || currentIdx > i;
                const isActive = currentIdx === i && phase !== "done";
                const isPast   = currentIdx > i;
                return (
                  <div key={step.key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        aria-hidden="true"
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-500 ${
                          isDone
                            ? "bg-green-500/20 text-green-400 border border-green-500/40"
                            : isActive
                              ? "bg-violet-600/30 text-violet-300 border border-violet-500/50 shadow-lg shadow-violet-500/20 animate-pulse motion-reduce:animate-none"
                              : "bg-zinc-800 text-zinc-600 border border-zinc-700"
                        }`}
                      >
                        {isDone ? "✓" : step.icon}
                      </div>
                      <span className={`text-xs font-medium transition-colors duration-300 ${
                        isDone ? "text-green-400" : isActive ? "text-violet-300" : "text-zinc-400"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div aria-hidden="true" className={`step-line mx-2 mb-5 ${isPast || phase === "done" ? "active" : ""}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {phaseMessage && (
              <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                {isRunning && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-ping motion-reduce:animate-none shrink-0" />}
                {phaseMessage}
              </p>
            )}

            {isRunning && (
              <div aria-hidden="true" className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="shimmer h-full w-full" />
              </div>
            )}
          </div>
        )}

        {/* ── Subtopics ──────────────────────────────── */}
        {subtopics.length > 0 && (
          <div className="animate-fade-up mb-6">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Research subtopics
            </p>
            <div className="flex flex-wrap gap-2">
              {subtopics.map((st, i) => (
                <span
                  key={i}
                  className="animate-fade-up rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1 text-xs font-medium text-violet-300"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span aria-hidden="true" className="mr-1.5 text-violet-500">◆</span>
                  {st}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────── */}
        {error && (
          <div role="alert" className="animate-fade-up mb-6 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-400">
            <span className="font-semibold">Error — </span>{error}
          </div>
        )}

        {/* ── Report ─────────────────────────────────── */}
        {report && (
          <div className="animate-fade-up glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                <span className="text-sm font-semibold text-zinc-200">Research Report</span>
              </div>
              <div className="flex items-center gap-2">
                {phase === "synthesizing" && (
                  <span className="text-xs text-violet-400 animate-pulse motion-reduce:animate-none">Generating…</span>
                )}
                {phase === "done" && (
                  <>
                    <span className="text-xs text-zinc-400">
                      ~{Math.round(report.split(/\s+/).length)} words
                    </span>
                    <button
                      onClick={handleDownload}
                      className="ml-1 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                    >
                      <span aria-hidden="true">↓</span> Download .md
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-6">
              <div className={`prose dark-prose prose-sm max-w-none ${phase === "synthesizing" ? "cursor-blink" : ""}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* ── Idle empty state ───────────────────────── */}
        {phase === "idle" && !report && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center text-zinc-400">
            <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-3xl">
              🔬
            </div>
            <p className="text-sm">Enter a topic above to start a research session</p>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="relative border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-400">
        Built with{" "}
        <span className="text-violet-500">LangGraph</span>,{" "}
        <span className="text-violet-500">AI</span>, &{" "}
        <span className="text-violet-500">Tavily</span>
      </footer>
    </div>
  );
}
