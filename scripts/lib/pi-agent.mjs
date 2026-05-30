import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";

// Use a stable code so the GitHub Action wrapper can distinguish graceful agent
// timeouts from ordinary runtime failures.
const TIMEOUT_CODE = "GH_AGENT_TIMEOUT";

// Extensions can load executable code from Pi configuration. This action keeps
// them disabled because the GitHub Action workflow does not need extension UI or
// custom extension hooks.
const NO_EXTENSIONS = true;

// Prompt templates are mainly interactive slash-command resources. The action
// sends a single rendered prompt, so loading templates only adds configuration
// surface without changing the workflow.
const NO_PROMPT_TEMPLATES = true;

// Themes only affect Pi's terminal UI. The action runs headlessly and exports
// artifacts, so themes are intentionally disabled.
const NO_THEMES = true;

class AgentTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "AgentTimeoutError";
    this.code = TIMEOUT_CODE;
  }
}

function registerConfiguredProvider(models, config) {
  models.registerProvider(config.provider, {
    baseUrl: config.baseUrl,
    api: config.providerApi,
    apiKey: config.providerApiKey,
    authHeader: config.providerAuthHeader,
    models: [
      {
        id: config.model,
        name: config.model,
        reasoning: config.modelReasoning,
        input: config.modelInput,
        contextWindow: config.modelContextWindow,
        maxTokens: config.modelMaxTokens,
      },
    ],
  });
}

async function createConfiguredSession(auth, models, model, config) {
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: config.compactionEnabled },
    retry: {
      enabled: config.retryEnabled,
      maxRetries: config.retryMaxRetries,
    },
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    settingsManager,
    noExtensions: NO_EXTENSIONS,
    noSkills: config.noSkills,
    noPromptTemplates: NO_PROMPT_TEMPLATES,
    noThemes: NO_THEMES,
    noContextFiles: config.noContextFiles,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: process.cwd(),
    model,
    thinkingLevel: config.thinkingLevel,
    authStorage: auth,
    modelRegistry: models,
    tools: config.tools,
    sessionManager: SessionManager.create(process.cwd()),
    settingsManager,
    resourceLoader,
  });

  return session;
}

function handleSessionEvent(event, onTextDelta) {
  switch (event.type) {
    case "turn_start":
      console.log("Turn started");
      break;
    case "turn_end":
      console.log("Turn completed");
      break;
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      if (event.toolName === "bash" && event.args?.command) {
        console.log(`  $ ${event.args.command}`);
      } else if (event.args?.path) {
        console.log(`  ${event.args.path}`);
      }
      break;
    case "tool_execution_end":
      if (event.isError) {
        console.log(`Tool error: ${event.toolName}`);
      }
      break;
    case "message_update":
      if (event.assistantMessageEvent?.type === "text_delta") {
        onTextDelta(event.assistantMessageEvent.delta ?? "");
      }
      break;
    default:
      break;
  }
}

export async function exportSession(session, runnerTemp = os.tmpdir()) {
  if (!session) {
    return;
  }

  const artifactDir = path.join(runnerTemp, "gh-agent-session");
  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.mkdirSync(artifactDir, { recursive: true });
  await session.exportToHtml(path.join(artifactDir, "session.html"));
  await session.exportToJsonl(path.join(artifactDir, "session.jsonl"));
  console.log(`Session exported to ${artifactDir}`);
}

export async function runAgent(prompt, config) {
  const auth = AuthStorage.inMemory();
  if (config.apiKey) {
    auth.setRuntimeApiKey(config.provider, config.apiKey);
  }

  const models = ModelRegistry.inMemory(auth);
  registerConfiguredProvider(models, config);

  const model = models.find(config.provider, config.model);
  if (!model) {
    throw new Error(`Model not found: ${config.provider}/${config.model}`);
  }

  const session = await createConfiguredSession(auth, models, model, config);
  let response = "";
  session.subscribe((event) =>
    handleSessionEvent(event, (delta) => {
      response += delta;
    }),
  );

  try {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new AgentTimeoutError(`Timeout after ${config.timeout} seconds`)),
        config.timeout * 1000,
      );
    });
    await Promise.race([session.prompt(prompt), timeoutPromise]).finally(() =>
      clearTimeout(timeout),
    );
    return { session, response: response.trim() };
  } catch (error) {
    return { session, error };
  }
}
