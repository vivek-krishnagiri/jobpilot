# Contributing to JobPilot

Thanks for your interest in contributing! JobPilot is a personal tool, but pull requests and issues are welcome.

---

## Getting Started

1. Fork the repo and clone your fork
2. Follow the [Quick Start](README.md#quick-start) in the README to get it running locally
3. Create a branch: `git checkout -b feature/your-feature` or `fix/your-bug`

---

## Development Guidelines

- **TypeScript everywhere.** All three workspaces are strict TypeScript. Before opening a PR, run:
  ```bash
  pnpm -r exec tsc --noEmit
  ```
  All workspaces must pass with zero errors.

- **No auto-submit.** JobPilot must never automatically submit a form on behalf of the user. This is a hard constraint — do not remove or bypass the human-in-the-loop step.

- **Local-first.** The app must run without any external API keys or cloud services. If you add a feature that contacts an external service, make it opt-in and clearly documented.

- **Keep it simple.** Prefer editing existing files over creating new ones. Prefer minimal dependencies. Don't add abstractions for one-off use cases.

---

## Commit Style

Use a short imperative prefix:

```
feat: add LinkedIn autofill support
fix: handle missing label text in detectFields
chore: upgrade Playwright to 1.51
docs: update troubleshooting section
```

---

## Pull Requests

- Target the `main` branch
- Include a short description of what and why
- If you change the autofill heuristics, describe what form types you tested against

---

## Reporting Bugs

Open a GitHub Issue with:
- Node.js version (`node --version`)
- pnpm version (`pnpm --version`)
- OS
- Steps to reproduce
- What you expected vs. what happened

---

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
