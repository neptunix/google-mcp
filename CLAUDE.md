# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) Server providing comprehensive Google Workspace integration. Exposes 65+ tools for AI assistants to interact with Google services: Calendar, Gmail, Drive, Docs, Sheets, Slides, Meet, Chat, Forms, YouTube, Tasks, and Contacts.

**Tech Stack**: TypeScript 5.7, Node.js 18+, ESM modules, googleapis v144, Zod validation, Vitest

## Commands

```bash
pnpm build          # TypeScript compilation to dist/
pnpm dev            # Watch mode with tsx
pnpm test           # Run vitest
pnpm test:coverage  # Coverage report (80% statements, 65% branches, 85% functions)
pnpm lint           # ESLint
pnpm lint:fix       # Auto-fix lint issues
```

## Architecture

```
GoogleWorkspaceMCPServer (src/server.ts)
├── OAuth (src/auth/oauth.ts) - OAuth 2.0 with dynamic port discovery, token refresh
└── Services (src/services/) - 12 Google service classes:
    drive.ts, docs.ts, sheets.ts, calendar.ts, gmail.ts,
    people.ts, youtube.ts, slides.ts, forms.ts, chat.ts, meet.ts, tasks.ts
```

**Entry Point**: `src/index.ts` creates and runs server
**Types**: `src/types/index.ts` contains all interfaces and Zod schemas

### Service Pattern

Each service wraps a Google API client with typed methods:

```typescript
export class DocsService {
  private readonly docs: docs_v1.Docs;
  constructor(authClient: Auth.OAuth2Client) {
    this.docs = google.docs({ version: "v1", auth: authClient });
  }
  public async createDocument(title: string): Promise<DocContent> { ... }
}
```

### Tool Response Format

```typescript
{
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  isError: boolean
}
```

## Conventions

### Git & Commits

- **Branch naming**: `feature/*`, `bugfix/*`, `release/*`, `hotfix/*`
- **Commit format**: `<type>(<scope>): <subject>`
- **Types**: feat, fix, docs, style, refactor, perf, test, chore, ci
- **Scopes**: auth, drive, docs, sheets, calendar, gmail, contacts, youtube, slides, tasks, server, types, forms, chat, meet

### TypeScript

- Avoid `any`, use `unknown`
- Explicit return types required
- Access modifiers mandatory (private/public/protected/readonly)
- Use nullish coalescing (`??`) over logical OR (`||`)
- Catch errors as `unknown` type

### MCP Tools

- Naming: `service_action` format (e.g., `docs_read`, `calendar_create_event`)
- Input validation via Zod schemas
- Authentication checked via `ensureAuthenticated()` before service calls

## Credential Storage Locations

- **Linux**: `~/.config/google-mcp/`
- **macOS**: `~/Library/Application Support/google-mcp/`
- **Windows**: `%APPDATA%\google-mcp\`
