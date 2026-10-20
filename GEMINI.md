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
- **Styling:** CSS Modules with component-specific styles and `clay.module.css` for design system. Strictly NO Tailwind or utility-first CSS.
- **Design System:** Strict Claymorphism (Large radii, dual inner-shadows, pastel colors).
- **Performance:** Use `TanStack Virtual` for all lists and LOD (Layer of Detail) CSS for shadows.
- **Frictionless Auth:** Sticky sessions (30-90 days) by default.

## Tooling & Expert Intelligence
- **Proactive Skills:** You MUST proactively use relevant skills (`activate_skill`) for every step: `coding-guidelines` for implementation, `react-best-practices` for the frontend, `best-practices` for security, and `web-design-guidelines` for the "squishy" UI audit.
- **MCP Integration:** Always leverage `context7` for up-to-date documentation on TanStack Start, Bun, and Varlock. Use `chrome-devtools` for performance/layout audits and `github` for version control management when requested.

## Implementation Workflow
- **Validation First:** Always define Zod/Varlock schemas before implementing features.
- **Surgical Edits:** Adhere to existing patterns and the "Resiliency" safeguards in SPEC.md.
- **Knowledge Store:** docs/solutions/ contains documented solutions to past problems, organized by category with YAML frontmatter (module, tags, problem_type), relevant when implementing or debugging in a documented area.
- After a solved, verified problem, automatically invoke the `ce-compound` skill with `mode:non-interactive` at the completion checkpoint only when the work produced durable project reasoning that is not readily recoverable from the final code, tests, types, comments, or existing documentation, and losing it would plausibly cause recurrence, material risk, or substantial rediscovery. Apply this counterfactual: if the learning document disappeared, would a future engineer reading the final implementation still be likely to repeat the mistake or redo substantial investigation? If not, do not invoke it. Completion, effort, and diff size alone are not enough. Capture at the checkpoint so a qualifying learning can ship in the PR that produced it, and only where the repository treats captured learnings as tracked, committed knowledge.
- Write every report, summary, or handoff to the user through the `ce-noslop` skill. This applies when you are the top-level agent writing to the user, not when you are a subagent reporting to its caller. Do not apply it to code, config, verbatim quotes, or text the user asked to post as written.
