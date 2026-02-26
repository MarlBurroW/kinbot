# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Older releases | ❌ |

We only actively support the latest release. Please update before reporting issues.

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

Instead, report them privately:

1. **Email:** Send details to the repository owner via the contact information on their [GitHub profile](https://github.com/MarlBurroW)
2. **GitHub Security Advisories:** Use the [private vulnerability reporting](https://github.com/MarlBurroW/kinbot/security/advisories/new) feature

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to expect

- Acknowledgment within 48 hours
- A fix or mitigation plan within 7 days for critical issues
- Credit in the release notes (unless you prefer anonymity)

## Security Architecture

KinBot takes security seriously:

- **Vault encryption** — All secrets (API keys, tokens) are encrypted at rest using AES-256-GCM
- **Secret redaction** — Vault references are never expanded in prompts or logs; redaction prevents leaking into compacted summaries
- **Authentication** — HTTP-only cookie sessions via Better Auth; admin and member roles
- **Invitation system** — New users can only join via invitation from an admin
- **Self-hosted** — Your data never leaves your server; no telemetry, no external calls except to your configured AI providers
- **No message deletion** — Compacting summarizes but never deletes; audit trail preserved

## Best Practices for Operators

- **Set a strong `ENCRYPTION_KEY`** — Use `openssl rand -hex 32` to generate one. If auto-generated, it's persisted in `data/.encryption-key`; protect this file.
- **Use HTTPS** — Always run behind a reverse proxy with TLS in production
- **Restrict bind address** — Use `HOST=127.0.0.1` (default) behind a reverse proxy; only use `0.0.0.0` if you understand the implications
- **Keep backups** — The SQLite database in `data/` contains everything; back it up regularly
- **Update regularly** — Pull the latest release for security patches
