import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@langchain/google-genai",
    "@langchain/langgraph",
    "@langchain/core",
    "@tavily/core",
    "langsmith",
  ],
};

export default nextConfig;
