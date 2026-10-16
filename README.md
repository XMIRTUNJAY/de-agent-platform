# de-agent

Install data-engineering agent skills from the [DE//AGENT registry](https://emanisha.in/de-agent/) into your coding CLI.

```sh
npx de-agent-platform add sql-review --agent all
```

One skill, every agent: `opencode`, `claude-code`, `codex`, `cursor`, `amp`, `gemini-cli`, `antigravity`. Skills install to each agent's native skills directory (project-local by default, `--global` for user-level). Hermes prints copy guidance — it has no verified user-level install path, so the installer says so instead of guessing.

```sh
npx de-agent-platform add sql-review --agent claude-code --global
npx de-agent-platform add sql-review --dry-run
```

Every `SKILL.md` served by the registry is assembled verbatim from its reviewed record — description, learning objectives, rules, install command — with a link back to the source record. Ratings and popularity at [emanisha.in/de-agent](https://emanisha.in/de-agent/).

License: Apache-2.0.
