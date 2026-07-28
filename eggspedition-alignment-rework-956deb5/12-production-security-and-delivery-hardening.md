# RW-012 — Production Authorization, Privacy, Documentation and Delivery Gates

**Priority:** P0  
**Maps to:** UX-014 and all mutation-related specs  
**Primary outcome:** production cannot deploy code that fails quality gates, server mutations cannot cross household boundaries, and documentation/privacy claims match actual behavior.

## Verified implementation

The revision includes:

- protected server middleware;
- not-found and route-error components;
- compatibility redirects;
- devtools gated to development;
- a product-specific About page;
- GitHub Actions deployment over SSH;
- Docker build and database migration during deployment.

## Critical discrepancy: mutation authorization

`updateGroceryItemFn` and `deleteGroceryItemFn` pass item ID and user ID to the service. The service selects the grocery item by item ID alone, then updates/deletes by item ID alone.

Authentication proves the caller has a session, but the service does not prove the item belongs to the caller’s current household.

A user who obtains or guesses a valid UUID could attempt to update/delete another household’s item. The same audit must be applied to templates, invites, categories, stores, events and restoration endpoints.

## Authorization decision

Every household-owned operation follows:

```ts
where(
  and(
    eq(entity.id, requestedId),
    eq(entity.householdId, context.session.householdId),
  ),
)
```

Server APIs do not accept household ID from the client unless the operation explicitly manages membership and independently verifies permission.

Use capability helpers:

```ts
requireHouseholdMember(session)
requireHouseholdAdmin(session)
requireOwnedGroceryItem(itemId, session.householdId)
requireOwnedTemplate(templateId, session.householdId)
```

Return a generic not-found/forbidden response that does not reveal cross-household existence.

## Database constraints

Add/verify:

- foreign keys on household-owned records;
- membership uniqueness;
- operation ID uniqueness;
- active item identity uniqueness according to product rules;
- invite token hash uniqueness and expiry;
- soft-delete/version columns required by Undo;
- transaction boundaries for compound operations.

Do not rely only on client validation.

## Logging/privacy discrepancies

Current logs include household IDs and item names. Debug output also reports automatic template creation and mutation details.

Production logging should use structured, minimized fields:

```ts
logger.info({
  event: 'grocery.item.updated',
  operationId,
  householdRef: hashOrOpaqueRef(householdId),
  itemId,
  durationMs,
})
```

Avoid:

- item names;
- emails;
- invite tokens;
- raw household IDs where not needed;
- auth tokens;
- full request payloads.

Separate expected validation/conflict logs from genuine server errors.

## About/privacy copy

The About page must not claim the app does not collect personal data if the system stores:

- email addresses for login/membership;
- household relationships;
- grocery content;
- activity records;
- local offline queue data.

Replace broad claims with accurate concise copy and link to a real Privacy page if the app is available beyond private testing.

Document:

- data categories;
- purpose;
- retention;
- sharing;
- deletion/contact path;
- local/offline storage;
- legal basis as applicable to deployment jurisdiction.

This spec is product/engineering guidance, not legal advice; final policy should be reviewed appropriately.

## README discrepancy

`README.md` remains the TanStack starter document.

Replace it with:

- product overview;
- screenshots/architecture summary;
- supported workflows;
- prerequisites;
- environment variables;
- local development;
- database migration;
- tests/type-check/lint/build;
- deployment;
- PWA notes;
- troubleshooting;
- security/privacy notes;
- link to `/SPEC.md` and UX specs.

Remove tutorial sections unrelated to Eggspedition.

## Delivery workflow discrepancy

The workflow deploys directly on every push to `main`. It does not run install, type-check, tests or build before SSH deployment. It writes `RESEND_API_KEY` although the repository previously migrated to Nodemailer/SMTP configuration.

## CI/CD decision

Split workflow into:

1. **quality**
2. **deploy**, dependent on quality

Example:

```yaml
jobs:
  quality:
    steps:
      - checkout
      - setup bun at pinned version
      - bun install --frozen-lockfile
      - bun run typecheck
      - bun run lint
      - bun run test --run
      - bun run build

  deploy:
    needs: quality
    if: github.ref == 'refs/heads/main'
```

Add missing scripts to `package.json`. Pin action versions/tags; avoid `@master`.

Deployment:

- use a deploy user with minimal permissions;
- use `git fetch/reset` or deploy an immutable artifact/image, not an unverified mutable working tree;
- fail on command errors (`set -euo pipefail`);
- use a migration step designed for deployment;
- perform health check after start;
- roll back or keep prior version on failure;
- serialize deployments with concurrency control;
- make env names match the current SMTP implementation;
- never echo secrets into action logs.

Prefer building and publishing a versioned container in CI, then pulling that exact digest on the VPS.

## Quality tooling

Add:

- TypeScript `typecheck`;
- ESLint or equivalent;
- Vitest unit/integration;
- Playwright critical flows;
- migration validation;
- accessibility tests;
- dependency/security scanning appropriate to project size.

The current use of multiple `as any` casts should fail or be tracked through lint rules such as `no-explicit-any` with narrow documented exceptions.

## Route/document hardening

- add route-specific titles/descriptions;
- verify all compatibility redirects preserve validated intent;
- ensure error routes include main landmark and recovery action;
- ensure server errors do not expose stack traces;
- define cache/security headers;
- protect service-worker update behavior and stale asset recovery.

## Observability

Minimum production signals:

- deployment version/commit;
- request/mutation error rate;
- auth delivery/verification outcomes without personal data;
- queue sync failure count;
- database migration status;
- health endpoint;
- frontend error boundary reporting with redaction.

Attach `operationId` to client mutation, server log and activity event for traceability.

## File-level plan

### Modify

- every household-owned service query;
- protected API handlers;
- DB schema/migrations;
- `README.md`;
- `package.json`;
- `.github/workflows/deploy.yml`;
- environment schema/example;
- About page/privacy copy;
- logger configuration.

### Add

- authorization helper module;
- structured logger/redaction tests;
- CI workflow;
- health endpoint;
- route metadata;
- privacy page/document as appropriate;
- security-focused integration tests.

## Acceptance criteria

### Authorization

- Cross-household item update/delete returns not found/forbidden and changes nothing.
- The same is true for templates, invites, events, categories/stores and restore operations.
- Admin-only operations are enforced server-side.
- Compound mutation and activity event commit atomically.

### Delivery

- Main cannot deploy unless install, type-check, lint, tests and build pass.
- Actions and Bun versions are pinned.
- Deployment uses current SMTP env names; legacy `RESEND_API_KEY` is removed unless still genuinely required.
- Migration failure prevents unhealthy release.
- Health check verifies the new version.
- Concurrent pushes cannot race deployments.
- Deployed version is traceable to commit/image digest.

### Privacy/docs

- README describes Eggspedition rather than the starter.
- Production logs contain no item names, emails, tokens or unnecessary household IDs.
- About/privacy wording accurately reflects stored data.
- Route titles are specific.
- Error responses are safe for production.

## Tests

- cross-household authorization for every entity/action;
- admin/member permission matrix;
- operation idempotency;
- transaction rollback;
- log-redaction snapshot;
- workflow YAML validation;
- build in clean checkout;
- migration dry run against representative schema;
- health-check/deploy failure path;
- open-redirect and error-response security;
- service-worker version/update smoke test.
