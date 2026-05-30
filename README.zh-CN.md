[English](./README.md) | 简体中文

# gh-agent

`gh-agent` 让 solo 开发者可以直接在 GitHub 里召唤 Pi agent，帮你讨论需求、修改代码。

- 无需触发词：你发出的每条 Issue / PR 内容都会召唤 agent；默认先讨论，明确需要时才修改代码
- 基于 GitHub Actions 运行，无需部署服务器，也没有运维负担
- 支持自定义模型服务

## 快速开始

- 在目标仓库里创建 `.github/workflows/gh-agent.yml`
- 把示例里的用户名占位符 `'your-github-username'` 替换成允许触发 agent 的 GitHub 用户名
- 并在仓库设置里配置 Repository secret `GH_AGENT_LLM_KEY` 模型 API key
- 把模型服务配置替换成你的 provider 参数

```yaml
name: gh-agent

on:
  # 新 Issue 创建时触发
  issues:
    types: [opened]
  # Issue / PR 普通评论创建时触发
  issue_comment:
    types: [created]
  # PR diff 行评论创建时触发
  pull_request_review_comment:
    types: [created]

jobs:
  agent:
    # 只允许指定用户触发
    if: github.event.sender.login == 'your-github-username'
    runs-on: ubuntu-latest

    permissions:
      contents: write
      issues: write
      pull-requests: write

    steps:
      - uses: linhan-dev/gh-agent@v0.1.0
        with:
          base_url: https://api.example.com/v1
          llm_key: ${{ secrets.GH_AGENT_LLM_KEY }}
          provider: pi-openai-responses
          provider_api: openai-responses
          provider_auth_header: "true"
          model: your-model-name
          model_context_window: "128000"
          model_input: text
          model_max_tokens: "16384"
          model_reasoning: "true"
          thinking_level: "medium"

          # 自动压缩长会话上下文。
          compaction_enabled: "true"

          # 允许 agent 使用的工具。
          tools: "read,edit,write,bash"

          # 是否禁用 AGENTS.md / CLAUDE.md 等上下文文件
          no_context_files: "false"

          # 是否禁用 Pi-compatible skills
          no_skills: "false"

          # 模型请求失败时自动重试。
          retry_enabled: "true"
          retry_max_retries: "2"

          # 单次 agent run 的最长时间，单位是秒。
          timeout: "1800"
```

建议给默认分支配置 GitHub Ruleset，避免 agent 或自己误改 `main` / `master`：

- Target branches：Default branch
- Enforcement status：Active
- Rules：开启 `Restrict updates`、`Require a pull request before merging`、`Restrict deletions`
- Bypass list：只添加 Repository admins，并选择 `For pull requests only`

这样默认分支不能被直接 push，agent 只能创建分支和 Pull Request，最后由管理员在 GitHub 上手动合并。

## 致谢

这个项目受到 [`cv/pi-action`](https://github.com/cv/pi-action) 的启发。

## License

MIT License，见 [LICENSE](LICENSE)。
