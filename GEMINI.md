# Project Mandates: Grocery List App (MVP)

## Technical Foundation
- **Runtime:** Bun (Strict).
- **Framework:** TanStack Start (React).
- **ORM:** Drizzle with `postgres.js` driver.
- **Environment:** Varlock (Strict schema validation via `.env.schema`).
- **Validation:** Zod (Single source of truth for all schemas/types).
- **State/Sync:** TanStack Query with SSE (Server-Sent Events) for real-time signaling.

## Architectural Mandates
- **Thin UI Pattern:** All business logic must live in pure TypeScript domain services, decoupled from TanStack Start server functions.
- **Matrix Categorization:** Items must always support dual-tagging (Category + Preferred Store). No binary toggles.
- **Offline-First:** All list-related queries must use `persistQueryClient` with LocalStorage.

## UI/UX & Design Mandates
- **Design System:** Strict Claymorphism (Large radii, dual inner-shadows, pastel colors).
- **Performance:** Use `TanStack Virtual` for all lists and LOD (Layer of Detail) CSS for shadows.
- **Frictionless Auth:** Sticky sessions (30-90 days) by default.

## Tooling & Expert Intelligence
- **Proactive Skills:** You MUST proactively use relevant skills (`activate_skill`) for every step: `coding-guidelines` for implementation, `react-best-practices` for the frontend, `best-practices` for security, and `web-design-guidelines` for the "squishy" UI audit.
- **MCP Integration:** Always leverage `context7` for up-to-date documentation on TanStack Start, Bun, and Varlock. Use `chrome-devtools` for performance/layout audits and `github` for version control management when requested.

## Implementation Workflow
- **Validation First:** Always define Zod/Varlock schemas before implementing features.
- **Surgical Edits:** Adhere to existing patterns and the "Resiliency" safeguards in SPEC.md.
