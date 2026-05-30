import fs from "node:fs";

function getEventContext(payload) {
  const issue = payload.issue;
  const pullRequest = payload.pull_request;
  const isPullRequest = Boolean(pullRequest || issue?.pull_request);
  const number = issue?.number ?? pullRequest?.number;

  if (!number) {
    throw new Error(
      "Unsupported GitHub event payload: no issue or pull_request number found",
    );
  }

  return {
    number,
    typeDisplay: isPullRequest ? "Pull Request" : "Issue",
  };
}

function renderPrompt(template, context, repository) {
  return template
    .replaceAll("${{ github.repository }}", repository)
    .replaceAll("{{type_display}}", context.typeDisplay)
    .replaceAll("{{number}}", String(context.number));
}

export function readPrompt(config) {
  const payload = JSON.parse(fs.readFileSync(config.eventPath, "utf8"));

  const template = fs.readFileSync(config.promptPath, "utf8");
  return renderPrompt(template, getEventContext(payload), config.repository);
}
