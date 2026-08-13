import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { tavily } from "@tavily/core";

const AgentState = Annotation.Root({
  topic: Annotation<string>(),
  subtopics: Annotation<string[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  researchResults: Annotation<{ subtopic: string; findings: string }[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  report: Annotation<string>({
    reducer: (_, b) => b,
    default: () => "",
  }),
});

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");
  return tavily({ apiKey });
}

export function buildResearchGraph() {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) throw new Error("GOOGLE_API_KEY is not set");

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.5-flash",
    apiKey: googleApiKey,
    streaming: true,
  });

  async function planSubtopics(state: typeof AgentState.State) {
    const response = await model.invoke([
      new HumanMessage(
        `You are a research planner. Break the following topic into exactly 5 focused, distinct research subtopics.

Topic: "${state.topic}"

Return ONLY a JSON array of 5 subtopic strings. No markdown, no explanation.
Example: ["Subtopic A", "Subtopic B", "Subtopic C", "Subtopic D", "Subtopic E"]`
      ),
    ]);

    const content = typeof response.content === "string" ? response.content : "";
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error("Failed to generate subtopics — LLM returned unexpected format. Please try again.");
    const subtopics: string[] = JSON.parse(match[0]);
    if (!Array.isArray(subtopics) || subtopics.length === 0) {
      throw new Error("Failed to generate subtopics — received empty list. Please try again.");
    }
    return { subtopics };
  }

  async function researchSubtopics(state: typeof AgentState.State) {
    const tvly = getTavilyClient();
    const results = await Promise.all(
      state.subtopics.map(async (subtopic) => {
        try {
          const resp = await tvly.search(`${state.topic}: ${subtopic}`, {
            maxResults: 4,
            searchDepth: "basic",
          });
          const findings = resp.results
            .map((r) => `### ${r.title}\n${r.content}\n*Source: ${r.url}*`)
            .join("\n\n");
          return { subtopic, findings: findings || "No results found." };
        } catch {
          return { subtopic, findings: "Search unavailable for this subtopic." };
        }
      })
    );
    return { researchResults: results };
  }

  async function synthesizeReport(state: typeof AgentState.State) {
    const researchContext = state.researchResults
      .map((r) => `## ${r.subtopic}\n\n${r.findings}`)
      .join("\n\n---\n\n");

    const response = await model.withConfig({ tags: ["synthesis"] }).invoke([
      new HumanMessage(
        `You are an expert researcher and writer. Based on the research below, write a comprehensive markdown report on: **"${state.topic}"**

---
${researchContext}
---

Structure your report as:
1. **Executive Summary** — 2-3 sentence overview
2. **Key Findings** — one section per subtopic with insights
3. **Synthesis & Implications** — cross-cutting themes and what they mean
4. **Conclusion** — actionable takeaways

Use proper markdown: headers, bullet points, bold for key terms. Be thorough and analytical.`
      ),
    ]);

    const content =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .filter((b): b is { type: "text"; text: string } => b.type === "text")
              .map((b) => b.text)
              .join("")
          : "";

    return { report: content };
  }

  const graph = new StateGraph(AgentState)
    .addNode("plan", planSubtopics)
    .addNode("research", researchSubtopics)
    .addNode("synthesize", synthesizeReport)
    .addEdge(START, "plan")
    .addEdge("plan", "research")
    .addEdge("research", "synthesize")
    .addEdge("synthesize", END);

  return graph.compile();
}
