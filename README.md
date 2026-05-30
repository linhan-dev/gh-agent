English | [简体中文](./README.zh-CN.md)

# gh-agent

`gh-agent` lets solo developers summon a Pi agent directly from GitHub to discuss requirements and modify code.

- No trigger phrase required: every Issue / PR message you send can summon the agent; by default it starts with discussion and only changes code when the need is clear
- Runs on GitHub Actions, so there is no server to deploy or operate
- Supports custom model services

## Quick Start

- Create `.github/workflows/gh-agent.yml` in the target repository
- Replace the username placeholder `'your-github-username'` in the example with the GitHub username allowed to trigger the agent
- Configure the Repository secret `GH_AGENT_LLM_KEY` with your model API key
- Replace the model service settings with your provider's values

```yaml
name: gh-agent

on:
  # Trigger when a new Issue is created.
  issues:
    types: [opened]
  # Trigger when a regular Issue / PR comment is created.
  issue_comment:
    types: [created]
  # Trigger when a PR diff line comment is created.
  pull_request_review_comment:
    types: [created]

jobs:
  agent:
    # Only allow the specified user to trigger the agent.
    if: github.event.sender.login == 'your-github-username'
    runs-on: ubuntu-latest

    permissions:
      contents: write
      issues: write
      pull-requests: write

    steps:
      - uses: linhan-dev/gh-agent@v0.1.2
        with:
          base_url: https://api.example.com/v1
          llm_key: ${{ secrets.GH_AGENT_LLM_KEY }}
          provider_api: openai-responses
          provider_auth_header: "true"
          model: your-model-name
          model_context_window: "128000"
          model_input: text
          model_max_tokens: "16384"
          model_reasoning: "true"
          thinking_level: "medium"

          # Automatically compact long conversation context.
          compaction_enabled: "true"

          # Tools the agent is allowed to use.
          tools: "read,edit,write,bash"

          # Whether to disable context files such as AGENTS.md / CLAUDE.md.
          no_context_files: "false"

          # Whether to disable Pi-compatible skills.
          no_skills: "false"

          # Automatically retry failed model requests.
          retry_enabled: "true"
          retry_max_retries: "2"

          # Maximum duration of a single agent run, in seconds.
          timeout: "1800"
```

It is recommended to configure a GitHub Ruleset for the default branch so neither the agent nor you can accidentally modify `main` / `master` directly:

- Target branches: Default branch
- Enforcement status: Active
- Rules: enable `Restrict updates`, `Require a pull request before merging`, and `Restrict deletions`
- Bypass list: add only Repository admins and choose `For pull requests only`

With this setup, the default branch cannot be pushed to directly. The agent can only create branches and Pull Requests, and an administrator merges changes manually on GitHub.

## Acknowledgements

This project was inspired by [`cv/pi-action`](https://github.com/cv/pi-action).

## License

MIT License. See [LICENSE](LICENSE).
