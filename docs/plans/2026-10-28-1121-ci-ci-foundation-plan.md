---
title: CI Foundation - Plan
type: ci
date: 2026-10-28
topic: ci-foundation
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# CI Foundation - Plan

## Goal Capsule

- **Objective:** Contributors can identify regressions before their pull requests merge into `main` and reproduce the failed checks locally.
- **Means:** Required GitHub Actions validation using the existing checks, an isolated Bun/Postgres environment, and the existing production-bundle passkey smoke test.
- **Product authority:** The confirmed CI scope recorded in this Product Contract; deployment integration and broader release qualification are not active scope.
- **Open blockers:** None for implementation planning. Repository-settings permissions remain an execution dependency governed by R12.
- **Execution profile:** Smoke-first configuration work; implement, review, and ship through an open PR without merging.
- **Stop conditions:** R13 governs baseline scope expansion; invalidated product decisions or unavailable required verification must be reported rather than hidden.

---

## Product Contract

### Summary

Establish required PR validation with reproducible local verification and an isolated test environment.
Reuse the existing checks, add explicit TypeScript checking, and exercise the emitted production passkey bundle.
Include focused fixes needed for a green initial baseline.

### Problem Frame

The repository has verification commands, but its checked-in GitHub workflow deploys pushes to `main` without validation jobs.
Contributors currently lack a checked-in, consistent pre-merge result covering those commands.
Local environment differences can also make failures difficult to reproduce elsewhere.

The authentication tests depend on disposable Postgres, and the passkey smoke script covers production initialization behavior that source-only tests cannot establish.
A build or a subset of unit tests therefore cannot stand in for the selected validation scope.

### Key Decisions

- **Required merge validation, with deployment integration deferred.** Governs R1, R2, R12. (session-settled: user-directed — chosen over advisory reporting and combined merge/deployment gating: establish pre-merge confidence in this first version.)
- **Fix the selected baseline to green.** Governs R13. (session-settled: user-directed — chosen over staged enforcement and initially requiring only passing checks: the selected gate should be trustworthy from rollout.)
- **Extend the repository's verification capabilities.** Governs R3–R9. (session-settled: user-approved — chosen over introducing another test framework or a broad compatibility matrix: reuse the checks and deployed-runtime assumptions already present.)

### Actors

- A1. **Contributor:** Runs checks locally, opens a PR, and addresses failed validation.
- A2. **CI runner:** Validates the PR revision and reports results without production credentials.
- A3. **Repository administrator:** Configures required checks on `main` when the implementer lacks repository-settings access.

### Requirements

**Merge decision and feedback**

- R1. Run validation for PRs targeting `main` and refresh the result when the PR revision changes.
- R2. A PR must not satisfy the merge gate unless every selected check passes for the revision being evaluated.
- R3. The selected checks are the full existing Vitest suite, explicit TypeScript checking, the production build, icon validation, and the existing production-bundle passkey smoke test.
- R4. Report which selected check failed and retain its actionable output in the CI run.
- R5. Provide a documented local verification entrypoint exercising the same selected checks with equivalent disposable configuration.

**Reproducibility and isolation**

- R6. Validation must work from a clean checkout with pinned Bun matching the current Docker runtime and frozen lockfile dependency resolution.
- R7. Database-backed checks must use explicitly configured disposable Postgres through the existing test-database isolation boundary, with no fallback to the application database.
- R8. PR validation must run using nonproduction configuration without production signing, database, SMTP, or deployment credentials.
- R9. The passkey smoke must exercise the output produced by the current validation build in a fresh Bun process, preserving its clean-process assertion and signature/database checks.

**Rollout and scope control**

- R10. A superseded PR run may be cancelled, but its result must not satisfy the merge gate for a newer revision.
- R11. Missing infrastructure, failed setup, or an unexecuted selected check must not be reported as a successful merge-gate result.
- R12. Configure the selected check result as required on `main` when authorized; otherwise provide an explicit administrator handoff naming the required result and state that enforcement is pending.
- R13. Include focused corrections needed to make the selected baseline pass, and return for scope confirmation if those corrections require a substantial refactor or product-behavior change.

### Key Flows

- F1. **PR validation.** Covers R1–R4, R6–R11.
  - **Trigger:** A contributor opens or updates a PR targeting `main`.
  - **Actors:** A1, A2.
  - **Flow:** Validate the evaluated revision in the isolated environment, run the selected checks, and publish their results.
  - **Outcome:** The merge decision follows R2 and R11; a failing check gives the contributor evidence under R4.

- F2. **Local reproduction.** Covers R5–R9.
  - **Trigger:** A contributor wants to validate a change or reproduce a CI failure.
  - **Actors:** A1.
  - **Flow:** Follow the documented disposable setup and run the local verification entrypoint.
  - **Outcome:** Local verification exercises the same selected scope without relying on the contributor's production configuration.

- F3. **Initial enforcement.** Covers R12, R13.
  - **Trigger:** The initial baseline is evaluated for rollout.
  - **Actors:** A1, A3.
  - **Flow:** Resolve baseline failures within the agreed scope and apply the required-check setting or deliver its administrator handoff.
  - **Outcome:** The enforcement state is explicit; a workflow file alone is not presented as proof that merges are blocked.

### Acceptance Examples

- AE1. **All selected checks pass.** Covers R1–R3, R6–R9.
  - **Given:** A clean PR checkout with the disposable CI configuration.
  - **When:** Every selected check passes for the evaluated revision.
  - **Then:** The CI merge-gate result succeeds for that revision.

- AE2. **One check fails.** Covers R2–R4.
  - **Given:** The build and tests pass, but TypeScript checking fails.
  - **When:** The run reports its results.
  - **Then:** The merge gate fails and the typecheck output identifies the problem.

- AE3. **Disposable database is unavailable.** Covers R7, R11.
  - **Given:** The test-database URL is absent or Postgres cannot be reached.
  - **When:** Validation attempts the database-backed checks.
  - **Then:** Validation fails rather than skipping those checks or using an application database.

- AE4. **Production initialization regresses.** Covers R2, R9.
  - **Given:** Source tests and the production build pass, but the emitted passkey service fails to initialize in a fresh process.
  - **When:** The production-bundle smoke runs.
  - **Then:** The smoke and merge gate fail without masking the problem through a preloaded polyfill.

- AE5. **No production credentials are supplied.** Covers R6–R8.
  - **Given:** A runner has only repository contents, dependency access, and disposable configuration.
  - **When:** It performs validation.
  - **Then:** No selected check requires production credentials or real SMTP delivery.

- AE6. **PR revision is superseded.** Covers R1, R10.
  - **Given:** An older PR revision has a passing or cancelled run.
  - **When:** A contributor pushes a newer revision.
  - **Then:** The older result cannot fulfill the newer revision's required result.

- AE7. **Settings access is unavailable.** Covers R12.
  - **Given:** The workflow is verified but the implementer cannot configure repository rules.
  - **When:** The work is handed over.
  - **Then:** The administrator receives the exact required-check identity and configuration instructions, and merge enforcement is explicitly reported as pending.

- AE8. **Baseline correction exceeds scope.** Covers R13.
  - **Given:** A selected check exposes a defect requiring a substantial refactor or a change to product behavior.
  - **When:** The implementer assesses the correction.
  - **Then:** Work pauses for scope confirmation rather than weakening the check or silently expanding the feature.

### Scope Boundaries

- Deployment integration, validation of direct pushes before deployment, and exact-revision deployment are deferred.
- Production-container startup qualification and schema-push data-preservation rehearsals are deferred.
- Physical iPhone/iPad acceptance and real SMTP delivery remain separate release evidence.
- New test frameworks, broad compatibility matrices, global coverage targets, and repository-wide formatting adoption are outside this foundation.
- Dependency caching, selective test routing, preview environments, and CI dashboards are not prerequisites for this work.

### Dependencies and Assumptions

- GitHub Actions and suitable hosted-runner resources are available to this repository; availability and repository rules have not been inspected remotely.
- The current Docker runtime is Bun 1.3.11. Confirm that reference during implementation planning before selecting the CI pin.
- The disposable Postgres role needs permission to create and remove the isolated schemas used by the existing helper.
- The existing schema and import-time environment behavior can be satisfied with nonproduction values; exact values and command ordering belong to implementation planning.
- No green baseline is claimed by this document; tests and builds were not executed during requirements discovery.

### Outstanding Questions

**Deferred to Planning**

The implementation mechanisms are resolved in KTD1–KTD5. Execution-time baseline failures remain governed by R13.

### Sources and Research

- [CI ideation](../ideation/2026-10-28-ci-process-ideation.html), ideas 1–3: the selected foundation and tradeoffs.
- `package.json:8–17`: current Varlock-wrapped build/test commands and icon validation; no explicit typecheck command.
- `tsconfig.json:2–27`: broad TS/TSX inclusion and strict compiler checks.
- `Dockerfile:2–8`: Bun 1.3.11 and frozen dependency installation.
- `.env.schema`: environment-validation surface for disposable configuration.
- `src/test/auth-db.ts:7–18`: explicit disposable database URL, isolated schemas, and cleanup.
- `scripts/auth-passkey-smoke.ts:9–25,35–53`: clean-process production import and signature/database smoke behavior.
- `vite.config.ts:14–17` and `README.md:64–71`: emitted passkey metadata side effects and production-smoke rationale.
- `.github/workflows/deploy.yml:1–28`: existing push-to-main deployment path, separate from the selected PR gate.
- `README.md:31–40`: limits of automated evidence for physical-device acceptance.

---

## Planning Contract

**Product Contract preservation:** Product Contract unchanged in scope; planning-owned questions resolved below.

### Key Technical Decisions

- KTD1. **One stable required job, `CI / Verify`.** Implement a PR workflow with one job named `Verify`, running the shared verification entrypoint without path filters; a single job avoids skipped dependency aggregation and keeps every selected check under one result. Governs R1–R5, R10–R12. Use PR-scoped cancellation and a bounded job timeout. Parallel jobs and a matrix are unnecessary at this scale and cheap to add later, so no bake-off is warranted.
- KTD2. **Pinned Bun and disposable Postgres 16.** Match `Dockerfile`'s Bun 1.3.11 and `docker-compose.yml`'s Postgres 16 family; install from `bun.lock` without changes. Governs R6, R7. The Actions service uses readiness checking and only nonproduction credentials.
- KTD3. **An isolated verification wrapper.** Add `scripts/verify.ts` with a documented `verify` package entrypoint and an explicit disposable `AUTH_TEST_DATABASE_URL`. Construct child environments from essential OS variables plus disposable application values, rather than inheriting the caller's application credentials. Give Varlock an isolated temporary directory containing the existing schema and disposable configuration so it does not read the checkout's dotenv files. Disable automatic Bun dotenv loading in verification children. Governs R5–R9. Keep database selection explicit and remove temporary configuration after completion.
- KTD4. **Validate generated routes before checking types.** Run the production build before typechecking because TanStack route types are generated; then execute all selected checks, with the production smoke in a clean process against that build. Governs R3, R9, R11. A failed command exits the verification entrypoint nonzero; later commands need not run after failure, but the gate must not pass.
- KTD5. **Use actual check identity for branch protection.** Confirm the job's check-run name and GitHub Actions app identity after a real PR run, then require that result on `main`; use R12's administrator handoff if settings cannot be applied. Existing protection and rulesets were queried and are absent as of planning. Avoid introducing review-count or direct-push policies beyond the selected required-check setting.

### Assumptions

- A single Linux job should offer adequate initial feedback speed; no runtime target was requested.
- Restrict typechecking to maintained application, scripts, test, and configuration paths if the broad current include reaches generated output or historical audit folders; do not exclude active code to hide errors.
- Frozen dependency installation should remain compatible with Bun 1.3.11; actual installation and baseline results are execution-time evidence, not planning claims.

### High-Level Technical Design

The sequential check flow keeps the tested build and production smoke in one workspace (KTD1, KTD4):

| Stage | Input | Output or failure evidence |
| --- | --- | --- |
| Runner setup | PR revision, pinned Bun, Postgres 16 | Frozen dependency installation and service readiness |
| Isolated entrypoint | Explicit disposable DB URL, repository schema | Controlled child environment and temporary Varlock root |
| Production build | Controlled environment and source | Emitted server bundle and generated route types |
| Static and behavioral checks | Current checkout and generated types | Typecheck, full Vitest, and icon results |
| Production smoke | Current build and fresh Bun process | Signature/database round-trip or initialization failure |
| Merge decision | Entrypoint exit result | `Verify` succeeds only on completion |

### Risks and Dependencies

- Local `.env` loading can compromise reproducibility; KTD3 owns isolation, and U1's tests must prove caller credentials do not reach child commands.
- Current TypeScript errors are unknown until execution; R13 limits corrections without turning failures into exclusions or advisory results.
- This PR introduces a new workflow; the first real Actions run provides Linux/service evidence beyond local verification.
- Deployment still runs independently on pushes to `main`, per the existing Scope Boundaries.

### Research

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions): use `pull_request`, read-only contents permission, immutable action references, and explicit job results for KTD1.
- [Postgres service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers): readiness checks and localhost service mapping inform KTD2.
- [Bun environment variables](https://github.com/oven-sh/bun/blob/main/docs/runtime/environment-variables.mdx): `--no-env-file` prevents default dotenv loading in KTD3's children.
- [Varlock CLI](https://github.com/dmno-dev/varlock/blob/main/packages/varlock-website/src/content/docs/reference/cli/load-and-run.mdx): `--path` selects an isolated environment root for KTD3.

---

## Implementation Units

### U1. Reproducible local verification and a green baseline

- **Goal:** Deliver the shared verification entrypoint with the selected baseline passing.
- **Requirements:** R3–R9, R11, R13; F2.
- **Dependencies:** None.
- **Files:** `scripts/verify.ts`, `scripts/verify.test.ts`, `package.json`, `tsconfig.json`, and only focused existing code/test corrections justified by observed baseline failures.
- **Approach:** Apply KTD2–KTD4, keeping orchestration small and separating environment construction from command execution so isolation and exit propagation can be tested without running the application recursively.
- **Patterns to follow:** Existing disposable database helper and production smoke; use Vitest for wrapper behavior tests.
- **Execution note:** Inspect the initial baseline with disposable configuration before making corrections; do not alter auth policy to satisfy CI.
- **Test scenarios:**
  - Covers AE3. An absent disposable URL fails before any application command is launched.
  - Covers AE5. Parent production database, signing, and SMTP values are replaced or omitted from validation children.
  - Covers AE2. A child command failure propagates a nonzero result and identifies the failed stage.
  - Covers AE4. The smoke command targets the emitted bundle in a fresh process after build, and a real full run exercises it.
- **Verification:** The shared command passes locally against disposable Postgres, and its wrapper tests demonstrate the isolation/failure boundary.

### U2. Required-check workflow

- **Goal:** Run U1 automatically for evaluated PR revisions under a stable check identity.
- **Requirements:** R1, R2, R4, R6–R11; F1.
- **Dependencies:** U1.
- **Files:** `.github/workflows/ci.yml`.
- **Approach:** Apply KTD1 and KTD2 with immutable checkout/setup action references, read-only contents permission, and no production secrets. Use a Postgres service, frozen install, and the same local entrypoint.
- **Test expectation:** No synthetic workflow unit tests; syntax validation and actual PR execution supply integration evidence.
- **Verification scenarios:** Covers AE1/AE5 with a real green run; inspect failure propagation per AE2/AE3 and revision identity/cancellation per AE6 without publishing intentionally broken product code.
- **Verification:** GitHub reports `Verify` on the PR and all selected checks execute successfully in its log.

### U3. Contributor documentation and enforcement

- **Goal:** Make local reproduction and required-check rollout actionable.
- **Requirements:** R5, R12, R13; F3.
- **Dependencies:** U1, U2.
- **Files:** `README.md`; GitHub branch-protection settings when authorized.
- **Approach:** Document pinned runtime, disposable Postgres setup, the shared command, failure diagnosis, and the deployment boundary. Apply KTD5 only after observing the real check identity.
- **Test expectation:** Documentation/settings work needs command smoke evidence and settings readback, not prose unit tests.
- **Verification scenarios:** Covers AE7 through explicit administrator instructions when needed; verify the allowed R12 outcome using settings readback or the handoff.
- **Verification:** A reader can reproduce selected validation from the instructions, and enforcement is either verified or clearly pending.

---

## Verification Contract

| Check | Evidence | Applies to |
| --- | --- | --- |
| Dependency baseline | `bun install --frozen-lockfile` with pinned Bun, no lockfile churn | U1, U2 |
| Shared entrypoint | `bun run verify` with explicit disposable `AUTH_TEST_DATABASE_URL` | U1–U3 |
| Full tests | Existing Vitest suite, including `scripts/verify.test.ts` and `public/sw.test.ts`, under the isolated environment | U1, U2 |
| Type safety | Explicit `tsc --noEmit` over maintained code after route generation | U1, U2 |
| Build and assets | Existing production build and `icons:check` through the shared entrypoint | U1, U2 |
| Emitted service | Existing `scripts/auth-passkey-smoke.ts --production` with Bun dotenv loading disabled | U1, U2 |
| Workflow | Syntax inspection and real GitHub Actions PR run | U2 |
| Enforcement | Required-check settings readback or exact administrator handoff per R12 | U3 |

No `release:validate` command exists in the current package manifest. Full browser/device QA is not evidence required for this CI-only change; any baseline UI behavior correction needs its affected regression test.

---

## Definition of Done

- U1–U3 meet their verification outcomes and R1–R13 are accounted for in the code, CI result, or explicit R12 handoff.
- Current-revision local and GitHub checks pass without skipped database coverage or production credentials.
- Product scope is preserved and any permitted baseline corrections are explained in the PR.
- Required-check enforcement is verified or its remaining administrator action is clearly reported.
- Temporary fixtures and abandoned implementation attempts are removed; no credentials or local environment files enter the diff.
- The reviewed branch is pushed with an open PR and CI decided; merging remains with the user.
