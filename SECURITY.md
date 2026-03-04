# Security Policy

## Scope

JobPilot is a **local-only** tool. It runs entirely on your machine:
- No data is sent to any external server
- No API keys are required
- All job data, profile data, and uploaded files are stored in `server/data/` on your local disk

## Reporting a Vulnerability

If you discover a security issue (e.g. a path traversal in the file upload, XSS in the dashboard, or a way the tool could be tricked into submitting a form automatically), please:

1. **Do not open a public GitHub issue**
2. Email a description to the maintainer, or open a [GitHub Security Advisory](https://github.com/vivek-krishnagiri/jobpilot/security/advisories/new)

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

## What We Will Do

- Acknowledge receipt within 7 days
- Investigate and, if confirmed, release a fix
- Credit you in the release notes (unless you prefer to remain anonymous)

## Known Non-Issues

- **Cross-origin iframes:** JobPilot intentionally cannot access cross-origin iframes. This is a browser security boundary, not a bug.
- **No auth on localhost ports:** The server (`:3001`) and runner (`:3002`) bind to `localhost` only and have no authentication. This is by design for a local-only tool. Do not expose these ports publicly.
