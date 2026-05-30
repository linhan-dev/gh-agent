import { readRuntimeConfig } from "./lib/env.mjs";
import { readPrompt } from "./lib/github-context.mjs";
import { exportSession, runAgent } from "./lib/pi-agent.mjs";

async function main() {
  const config = readRuntimeConfig();
  const prompt = readPrompt(config.github);

  console.log(
    `Running agent for ${config.github.repository} with ${config.agent.provider}/${config.agent.model}`,
  );

  const result = await runAgent(prompt, config.agent);
  await exportSession(result.session, config.runnerTemp);

  if (result.error) {
    config.writeOutput("success", "false");
    config.writeOutput("response", result.error.message ?? String(result.error));
    if (result.error.code === "GH_AGENT_TIMEOUT") {
      console.error(result.error);
      process.exit(124);
    }
    throw result.error;
  }

  if (!result.response) {
    config.writeOutput("success", "false");
    config.writeOutput("response", "Agent returned empty response");
    throw new Error("Agent returned empty response");
  }

  config.writeOutput("success", "true");
  config.writeOutput("response", result.response);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
