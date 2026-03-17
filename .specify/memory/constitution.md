<!--
## Sync Impact Report

**Version change**: N/A (template placeholders) → 1.0.0
**Bump rationale**: MAJOR — initial ratification; all placeholder tokens replaced with concrete values.

### Modified Principles
- N/A (first ratification; no prior principles existed)

### Added Sections
- Core Principles (I–V)
- Development Standards
- Review & Quality
- Governance

### Removed Sections
- None

### Templates Reviewed
- `.specify/templates/plan-template.md` ✅ — Constitution Check section references constitution gates; aligns with Principle III gates below.
- `.specify/templates/spec-template.md` ✅ — No constitution-specific references; structure compatible.
- `.specify/templates/tasks-template.md` ✅ — Tests marked OPTIONAL; aligns with Principle III (tests required when declared in spec, optional otherwise).
- `.claude/commands/speckit.plan.md` ✅ — Reads `constitution.md` for gates; no outdated agent-specific language.
- `.claude/commands/speckit.tasks.md` ✅ — Optional tests rule does not contradict constitution.
- `.claude/commands/speckit.specify.md` — Not read; no constitution references expected.
- `.claude/commands/speckit.implement.md` — Not read; no constitution references expected.
- `.claude/commands/speckit.analyze.md` — Not read; no constitution references expected.

### Deferred TODOs
- TODO(RATIFICATION_DATE): Date set to 2026-03-16 (first authoring). If a prior decision date exists, update manually.
- TODO(PROJECT_PURPOSE): Project purpose inferred from name only — no README or source code available yet. Revise principles once project domain is established.
-->

# pixel-parsnips Constitution

## Core Principles

### I. Specification-First

Every feature MUST begin with a written specification (`spec.md`) before any implementation work starts.
Specifications MUST include user stories with explicit priorities (P1, P2, P3…) and independently
testable acceptance scenarios. Implementation without an approved spec is a constitution violation.

**Rationale**: Unspecified features accumulate hidden assumptions that compound into rework. A spec
forces alignment before code is written.

### II. Incremental & Independent Delivery

Each user story MUST be independently implementable, testable, and demonstrable without requiring
other stories to be complete. Stories MUST be ordered by priority and delivered as successive MVP
increments. No story may introduce a breaking dependency on an incomplete story.

**Rationale**: Incremental delivery reduces integration risk and allows the project to ship value
at every checkpoint rather than waiting for a "big bang" release.

### III. Quality Gates

All features MUST pass a Constitution Check in the implementation plan before Phase 0 research
begins, and again after Phase 1 design. When a feature spec explicitly requests tests, those tests
MUST be written and confirmed to fail before the corresponding implementation is written
(Red–Green–Refactor). Gate violations MUST be documented with justification in the Complexity
Tracking table; unjustified violations block merge.

**Rationale**: Explicit gates prevent quality debt from accumulating silently across features.

### IV. Simplicity (YAGNI)

Code MUST solve the stated requirement and nothing more. Abstractions, helpers, and generalization
MUST NOT be introduced unless a second concrete use case already exists in the codebase. Complexity
MUST be justified; if a simpler alternative exists it MUST be used. Over-engineering a solution
when three similar lines would suffice is a violation of this principle.

**Rationale**: Premature abstractions are harder to remove than they were to add. Keeping code
simple keeps it maintainable and reviewable.

### V. Observability

All user-facing operations and external integrations MUST emit structured log entries sufficient to
diagnose failures without attaching a debugger. Log levels (DEBUG / INFO / WARN / ERROR) MUST be
used consistently. Silent failures — operations that return success without producing any
observable signal — are prohibited.

**Rationale**: Code that cannot be observed in production cannot be maintained reliably.

## Development Standards

- **Language & toolchain**: Determined per feature in `plan.md` Technical Context. Unknowns MUST
  be resolved in `research.md` before Phase 1 design begins.
- **Project structure**: Follows the layout declared in `plan.md`. Deviations require an updated
  plan before implementation proceeds.
- **Dependencies**: Third-party dependencies MUST be justified in `research.md` with alternatives
  considered. Unused dependencies MUST be removed.
- **Documentation**: Public interfaces and non-obvious logic MUST be documented inline. A
  `quickstart.md` MUST be produced in Phase 1 for any feature that exposes an external interface.

## Review & Quality

- Every pull request MUST reference its corresponding `spec.md` and `plan.md`.
- The Constitution Check section of `plan.md` MUST be completed and passing before review.
- Reviewers MUST verify that no new complexity was introduced without justification in the
  Complexity Tracking table.
- All checklist items generated by `/speckit.checklist` for the feature MUST be resolved before
  merge.

## Governance

This constitution supersedes all other development practices within the pixel-parsnips project.
Where a practice conflicts with a principle stated here, the constitution takes precedence.

**Amendment procedure**: Amendments MUST be proposed as a pull request updating this file.
The PR description MUST state: (a) the principle(s) affected, (b) motivation for the change,
and (c) impact on existing features or in-flight specs. The `LAST_AMENDED_DATE` and
`CONSTITUTION_VERSION` MUST be updated in the same commit.

**Versioning policy**:
- MAJOR: Removal or backward-incompatible redefinition of a principle.
- MINOR: New principle or section added; material expansion of existing guidance.
- PATCH: Clarification, wording improvement, or typo fix with no semantic change.

**Compliance review**: Constitution Check gates in `plan.md` serve as the primary compliance
mechanism. The `/speckit.analyze` command SHOULD be run after each feature's tasks are generated
to catch cross-artifact drift.

**Version**: 1.0.0 | **Ratified**: 2026-03-16 | **Last Amended**: 2026-03-16
