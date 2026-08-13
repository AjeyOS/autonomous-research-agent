# Autonomous Research Agent

An intelligent, highly-concurrent web research agent built with Next.js, LangGraph, Google Gemini, and Tavily. Give it a topic, and it will autonomously plan a research strategy, execute parallel web searches, and synthesize a comprehensive report.

## Features

- **Strategic Planning:** Breaks down your research topic into 5 distinct, focused subtopics using Gemini.
- **Parallel Research:** Leverages Tavily Search API to concurrently query the web for each subtopic, gathering high-quality sources and content.
- **Intelligent Synthesis:** Compiles the findings into a cohesive, well-structured markdown report, complete with an Executive Summary, Key Findings, and Actionable Conclusions.
- **Beautiful Modern UI:** A sleek, responsive, and dynamic user interface with progress steppers and live streaming results.
- **Downloadable Reports:** Easily export your generated research as a Markdown (`.md`) file.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Agent Orchestration:** LangGraph & LangChain
- **LLM:** Google Gemini (`gemini-3.5-flash`)
- **Search Engine:** Tavily Search API
- **Styling:** Tailwind CSS

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/AjeyOS/autonomous-research-agent.git
cd autonomous-research-agent
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory (you can copy `.env.local.example`) and add your API keys:

```bash
cp .env.local.example .env.local
```

Inside `.env.local`:
```env
GOOGLE_API_KEY="your_google_gemini_api_key"
TAVILY_API_KEY="your_tavily_api_key"
```

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How It Works

The research agent leverages **LangGraph** to model the research process as a state machine:
1. **Plan Node (`planSubtopics`)**: Prompts Gemini to break the user's topic into 5 targeted subtopics.
2. **Research Node (`researchSubtopics`)**: Executes parallel web searches using Tavily for each identified subtopic.
3. **Synthesize Node (`synthesizeReport`)**: Streams the aggregated findings back to Gemini to draft a comprehensive, markdown-formatted report.

## License

MIT License
