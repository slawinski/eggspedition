# Eggspedition Requirements Alignment Report

**Audited revision:** `956deb5a6a35a7d9573fe7b1b86d4ed4944ab413` (`main`, 28 July 2026)  
**Compared against:** UX-001 through UX-014 in `eggspedition-ux-audit`  
**Audit type:** static source review of the pinned revision. The application was not built or exercised on physical devices during this pass.

## Executive assessment

The implementation is a meaningful product rework, not a superficial restyle. It introduces:

- household onboarding and invite routes;
- a URL-controlled Add Item sheet;
- Quick Add accumulation and repeat-to-increment feedback;
- a command/Undo provider;
- shopping mode;
- a rewritten activity feed;
- mobile template cards and a template editor;
- shared loading, empty and error primitives;
- offline/mutation-queue foundations;
- not-found and route-error components.

The largest remaining risk is that several foundations are **present but not connected to the actual domain operation**. This creates interfaces that appear complete while their guarantees are weaker than the UI communicates.

The highest-priority gaps are:

1. Undo does not execute a real inverse grocery mutation for list operations.
2. Item editing is still a placeholder.
3. Update and delete operations are not scoped to the authenticated household in the service layer.
4. Quick Add increments are not atomic or idempotent.
5. The mutation queue and sync UI are scaffolding rather than an active offline workflow.
6. Responsive list columns still depend on `window.innerWidth`.
7. Several accessibility contracts are broken by duplicate IDs and nested interactive elements.
8. The deployment workflow deploys without build, test or type-check gates and still writes a legacy email secret.

## Alignment by original requirement

| Original spec | Alignment | What is implemented | Remaining discrepancy | Rework |
|---|---|---|---|---|
| UX-001 Household onboarding | Partial | Explicit create/join paths, invite acceptance, preserved add intent, no hard reload | Create failure is not shown in the create state; no optional household name; settings do not load the current name; mutation errors are not surfaced consistently | RW-007 |
| UX-002 Add composer | Partial | Adaptive sheet, URL entry, deep-link fields, parser, suggestions | Inline and sheet composers can coexist; duplicate fixed input IDs; closing removes only `add`; suggestion controls are not a complete combobox; no explicit retry; decorative drag handle suggests unsupported behavior | RW-003 |
| UX-003 Quick Add | Partial | Local accumulator, visible quantity, one-second repeat window, stable-key utility, batched synchronization | Server matches by name only; increment is read-modify-write; operation IDs are generated but not sent; failed item is disabled despite “tap to retry”; standalone filtering remains name-based | RW-004 |
| UX-004 Safe interactions and Undo | Major discrepancy | Command types, provider, toast, expiry and aggregation exist | SmartView does not optimistically patch caches; commands are built after success; complete command captures the already-updated state; default rollback only invalidates; delete/complete Undo does not reverse server state | RW-001 |
| UX-005 Item editing | Missing core behavior | Row exposes an edit entry point and update API exists | `handleEdit` is explicitly a placeholder; no editor, merge policy, quantity semantics or conflict handling | RW-002 |
| UX-006 Shopping mode | Partial | Store picker, store-scoped mode, progress, completed items, remembered store | URL changes use replacement so browser Back is not the mode exit; invalid stores are not normalized; offline/Undo guarantees are missing; planning group preference is not persisted | RW-006, RW-001, RW-005 |
| UX-007 Responsive list | Major discrepancy | Responsive presentation exists visually | React calculates 1/2/3 columns from `window.innerWidth` and redistributes groups in JavaScript; this is the behavior the specification asked to remove | RW-006 |
| UX-008 Navigation/account/brand | Partial | Account menu, household settings link, logout cleanup, bottom navigation | Header owns the global `h1`; page heading hierarchy is inconsistent; authenticated brand still uses a generic basket icon; settings information architecture is incomplete | RW-011 |
| UX-009 Activity/recovery | Partial | Natural-language feed, date groups, loading/empty/error states, “new activity” indicator | Entries are reversed inside groups; email local-part is used as identity fallback; restore re-adds only a name/quantity; event model has no entity/snapshot/operation metadata | RW-009 |
| UX-010 Template management | Partial | Mobile cards, desktop table, create/edit sheet, metadata fields | Mobile card is a button containing another button; error copy promises pull-to-refresh without implementing it; delete Undo is registered before success; backend auto-creates permanent templates for every added item | RW-010 |
| UX-011 Magic-link auth | Partial | Return-intent helpers, expired/invalid state, rate limiting, dedicated verification route | Login lacks pending/resend/change-email states; duplicate submits are possible; rate limit is process-local/email-only; verification recovery uses hard navigation; single-use behavior must be enforced and tested | RW-008 |
| UX-012 Async/offline/sync | Major discrepancy | Offline banner, online hook, queue manager and sync button exist | Header passes empty queues and no-op callbacks; mutations do not enqueue; operation IDs have no server contract; retry does not trigger a flush; no end-to-end offline reconciliation | RW-005 |
| UX-013 Visual/accessibility | Partial | Skip link, focus styles, shared primitives, dialog labels, motion work | Duplicate IDs, nested buttons, inconsistent page headings, unsupported drag affordance, incomplete menu/form error semantics and remaining `any` casts | RW-003, RW-010, RW-011 |
| UX-014 Production hardening | Partial | Legacy redirects, not-found/error components, gated devtools, product About page | README is still starter content; server logs include item/household data; mutation authorization is incomplete; deploy has no CI gates and writes `RESEND_API_KEY` despite SMTP migration; About privacy copy needs verification | RW-012 |

## Recommended implementation order

### Release A — Correctness and authorization

1. **RW-012** — scope every server mutation to the authenticated household and add CI gates.
2. **RW-004** — make Quick Add identity, increments and retries idempotent.
3. **RW-001** — implement actual inverse mutations and optimistic cache patches.
4. **RW-002** — ship item editing on top of the corrected mutation contract.

### Release B — Resilience and layout

5. **RW-005** — connect the offline queue and sync status end to end.
6. **RW-006** — remove JavaScript breakpoints and normalize shopping URL state.
7. **RW-009** — introduce a recoverable activity-event model.

### Release C — Flow and accessibility completion

8. **RW-003** — finish the Add composer contract.
9. **RW-007** — close onboarding/settings failure-state gaps.
10. **RW-008** — finish the authentication state machine.
11. **RW-010** — repair template semantics and generation policy.
12. **RW-011** — complete document semantics, navigation hierarchy and accessibility.

## Cross-spec architectural decisions

The following decisions should be shared rather than reimplemented independently:

- **One item identity function:** normalized name plus category/store identity before an item ID exists; item ID afterward.
- **One mutation envelope:** `operationId`, `householdId` derived server-side, mutation type, entity ID, expected version and payload.
- **One command executor:** every undoable command has `execute`, `rollback`, optimistic patches and reconciliation metadata.
- **One offline queue provider:** components use a mutation facade; they do not instantiate queues themselves.
- **One event schema:** activity, Undo and conflict recovery consume the same before/after snapshots.
- **One page-heading rule:** the brand is not the document `h1`; every route renders its own unique `h1`.

## Deliverables

- `01-real-undo-and-optimistic-list-mutations.md`
- `02-item-editor-and-quantity-conflicts.md`
- `03-add-composer-contract-and-accessibility.md`
- `04-quick-add-server-integrity-and-recovery.md`
- `05-offline-queue-and-sync-integration.md`
- `06-responsive-list-and-shopping-state.md`
- `07-household-onboarding-and-settings-hardening.md`
- `08-auth-flow-completion.md`
- `09-activity-event-model-and-recovery.md`
- `10-quick-add-template-manager-hardening.md`
- `11-navigation-accessibility-and-document-semantics.md`
- `12-production-security-and-delivery-hardening.md`
