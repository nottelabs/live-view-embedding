import type { NextConfig } from "next";
// Stop `next dev` from writing its AI-agent instructions into AGENTS.md.
const config: NextConfig = { agentRules: false };
export default config;
