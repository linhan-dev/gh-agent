import fs from "node:fs";
import os from "node:os";

// Pi requires an apiKey field when registering a custom provider. The real
// secret is supplied through AuthStorage.setRuntimeApiKey(), so this value is
// only a non-empty placeholder for provider validation and should not resolve.
const PROVIDER_API_KEY_PLACEHOLDER = "<runtime-api-key>";

function env(name, fallback = "") {
  return process.env[name] ?? fallback;
}

function requiredEnv(name) {
  const value = env(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseCsv(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(name, value) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  throw new Error(`${name} must be a boolean`);
}

function parsePositiveInteger(name, value) {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseModelInput(name, value) {
  const modes = parseCsv(value);
  if (modes.length === 0) {
    throw new Error(`${name} is required`);
  }
  const invalidMode = modes.find((mode) => !["text", "image"].includes(mode));
  if (invalidMode) {
    throw new Error(`${name} contains unsupported mode: ${invalidMode}`);
  }
  return modes;
}

function parseRequiredCsv(name, value) {
  const entries = parseCsv(value);
  if (entries.length === 0) {
    throw new Error(`${name} is required`);
  }
  return entries;
}

function writeOutput(name, value) {
  const outputPath = env("GITHUB_OUTPUT");
  if (!outputPath) {
    return;
  }
  const delimiter = `GH_AGENT_OUTPUT_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
  fs.appendFileSync(
    outputPath,
    `${name}<<${delimiter}\n${value ?? ""}\n${delimiter}\n`,
  );
}

export function readRuntimeConfig() {
  return {
    runnerTemp: env("RUNNER_TEMP", os.tmpdir()),
    github: {
      repository: requiredEnv("GITHUB_REPOSITORY"),
      eventPath: requiredEnv("GITHUB_EVENT_PATH"),
      promptPath: requiredEnv("GH_AGENT_PROMPT_PATH"),
    },
    agent: {
      provider: requiredEnv("GH_AGENT_PROVIDER"),
      providerApi: requiredEnv("GH_AGENT_PROVIDER_API"),
      providerApiKey: PROVIDER_API_KEY_PLACEHOLDER,
      providerAuthHeader: parseBoolean(
        "GH_AGENT_PROVIDER_AUTH_HEADER",
        requiredEnv("GH_AGENT_PROVIDER_AUTH_HEADER"),
      ),
      model: requiredEnv("GH_AGENT_MODEL"),
      modelReasoning: parseBoolean(
        "GH_AGENT_MODEL_REASONING",
        requiredEnv("GH_AGENT_MODEL_REASONING"),
      ),
      modelInput: parseModelInput(
        "GH_AGENT_MODEL_INPUT",
        requiredEnv("GH_AGENT_MODEL_INPUT"),
      ),
      modelContextWindow: parsePositiveInteger(
        "GH_AGENT_MODEL_CONTEXT_WINDOW",
        requiredEnv("GH_AGENT_MODEL_CONTEXT_WINDOW"),
      ),
      modelMaxTokens: parsePositiveInteger(
        "GH_AGENT_MODEL_MAX_TOKENS",
        requiredEnv("GH_AGENT_MODEL_MAX_TOKENS"),
      ),
      thinkingLevel: requiredEnv("GH_AGENT_THINKING_LEVEL"),
      tools: parseRequiredCsv("GH_AGENT_TOOLS", requiredEnv("GH_AGENT_TOOLS")),
      compactionEnabled: parseBoolean(
        "GH_AGENT_COMPACTION_ENABLED",
        requiredEnv("GH_AGENT_COMPACTION_ENABLED"),
      ),
      retryEnabled: parseBoolean(
        "GH_AGENT_RETRY_ENABLED",
        requiredEnv("GH_AGENT_RETRY_ENABLED"),
      ),
      retryMaxRetries: parsePositiveInteger(
        "GH_AGENT_RETRY_MAX_RETRIES",
        requiredEnv("GH_AGENT_RETRY_MAX_RETRIES"),
      ),
      noSkills: parseBoolean(
        "GH_AGENT_NO_SKILLS",
        requiredEnv("GH_AGENT_NO_SKILLS"),
      ),
      noContextFiles: parseBoolean(
        "GH_AGENT_NO_CONTEXT_FILES",
        requiredEnv("GH_AGENT_NO_CONTEXT_FILES"),
      ),
      apiKey: requiredEnv("GH_AGENT_LLM_KEY"),
      baseUrl: requiredEnv("GH_AGENT_BASE_URL"),
      timeout: parsePositiveInteger(
        "GH_AGENT_TIMEOUT",
        requiredEnv("GH_AGENT_TIMEOUT"),
      ),
    },
    writeOutput,
  };
}
