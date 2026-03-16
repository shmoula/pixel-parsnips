<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)

Principles established:
  [PRINCIPLE_1_NAME] → I. Code Quality
  [PRINCIPLE_2_NAME] → II. Testing Standards
  [PRINCIPLE_3_NAME] → III. UX Consistency
  [PRINCIPLE_4_NAME] → IV. Performance Requirements
  (PRINCIPLE_5 slot removed — user specified 4 principles)

Sections established:
  [SECTION_2_NAME] → Development Workflow
  [SECTION_3_NAME] → Quality Gates

Templates requiring updates:
  ✅ .specify/memory/constitution.md — this file (written now)
  ⚠ .specify/templates/plan-template.md — Constitution Check section refers to
      generic "[Gates determined based on constitution file]"; no principle
      names hardcoded, so no structural change needed. Agents filling plan.md
      MUST reference the four principles by name when evaluating gates.
  ✅ .specify/templates/spec-template.md — Success Criteria section already
      includes measurable performance metrics (SC-002). No structural change
      needed; agents MUST ensure at least one SC maps to each active principle.
  ✅ .specify/templates/tasks-template.md — Phase N (Polish) already contains
      "Performance optimization" and "Security hardening" task slots consistent
      with the new principles. No structural change needed.

Deferred TODOs:
  None — all placeholders resolved.
-->

# Pixel Parsnips Constitution

## Core Principles

### I. Code Quality

Every line of code MUST be readable, reviewable, and maintainable by any
contributor to the project.

- Code MUST pass automated linting and static analysis checks before merging.
- Functions and modules MUST have a single, well-defined responsibility
  (Single Responsibility Principle).
- Cyclomatic complexity per function MUST NOT exceed 10 without documented
  justification.
- Magic numbers and unexplained constants MUST NOT appear in production code;
  use named constants or configuration.
- Pull requests MUST be small enough to review in under 30 minutes; large
  changes MUST be split into independently reviewable commits.
- Dead code MUST be deleted, not commented out.

**Rationale**: Unreadable code accumulates hidden cost. Every review cycle
spent deciphering intent is engineering time that does not ship value.

### II. Testing Standards

Automated tests are a first-class deliverable — not an optional afterthought.

- Unit tests MUST be written for all non-trivial business logic before
  implementation (TDD Red-Green-Refactor cycle).
- Integration tests MUST cover every public API contract and every cross-service
  boundary.
- Test coverage for new code MUST NOT fall below 80% line coverage; critical
  paths (auth, payments, data mutations) MUST reach 95%.
- Tests MUST be deterministic: flaky tests MUST be fixed or quarantined within
  one sprint of detection.
- Tests MUST run in under 5 minutes on a standard CI runner; long-running
  suites MUST be split into fast (< 1 min) and slow tiers.
- Mocking external services is permitted in unit tests; integration tests MUST
  hit real or contract-verified test doubles.

**Rationale**: Tests are the only reliable specification of system behaviour
over time. A codebase without tests is a codebase that cannot be safely changed.

### III. UX Consistency

Users MUST encounter coherent, predictable experiences across every surface of
the product.

- All UI components MUST conform to the established design system; ad-hoc
  styling MUST NOT be introduced without design review.
- Interaction patterns (navigation, feedback, error states) MUST be consistent
  across flows — no feature may invent its own idiom without cross-team approval.
- Error messages presented to users MUST be written in plain language, state
  what went wrong, and offer a recovery action.
- Accessibility: all user-facing interfaces MUST meet WCAG 2.1 AA as a
  minimum; AA compliance is verified via automated tooling on every build.
- Feature work that touches multiple screens MUST include a UX review checkpoint
  before implementation begins (as part of the spec/plan phase).

**Rationale**: Inconsistency erodes user trust and increases support burden.
Users who cannot predict the product's behaviour stop using it.

### IV. Performance Requirements

The product MUST remain fast under realistic load; performance is a feature, not
a post-launch concern.

- Page/screen load time (Time to Interactive) MUST NOT exceed 2 seconds on a
  median mobile connection (4G, ~20 Mbps).
- API endpoints MUST respond within 200 ms at the 95th percentile under expected
  peak load.
- Background jobs and batch operations MUST define explicit SLAs in their
  feature specification; SLAs MUST be validated in load tests before release.
- Performance regressions detected in CI (> 10% degradation vs. baseline) MUST
  block merges until resolved or explicitly accepted with a documented trade-off.
- Memory and CPU budgets MUST be defined per service/module and reviewed at plan
  time; unbounded resource consumption MUST NOT reach production.

**Rationale**: Performance problems compound over time and are expensive to
retrofit. Treating latency and throughput as explicit requirements from day one
prevents the "it was fast before" trap.

## Development Workflow

Every feature follows a structured lifecycle aligned to the principle gates
above.

1. **Specify** — author a `spec.md` capturing user stories, functional
   requirements, and measurable success criteria (including performance SLAs and
   UX consistency checkpoints).
2. **Plan** — produce a `plan.md` completing the Constitution Check gate against
   all four principles before implementation begins.
3. **Tasks** — generate a dependency-ordered `tasks.md`; tests MUST appear as
   tasks and MUST be scheduled before the implementation tasks they cover.
4. **Implement** — execute tasks in order; no task is marked complete until its
   acceptance criteria (including test passage) are verified.
5. **Review** — every PR must be reviewed by at least one peer; the reviewer is
   responsible for checking principle compliance, not just correctness.
6. **Release** — features are only eligible for release after all automated
   quality gates pass (tests, linting, performance, accessibility).

Hotfixes may compress steps 1–3 but MUST NOT skip the review or quality gate
steps.

## Quality Gates

The following automated gates MUST pass on every pull request. Bypassing a gate
requires explicit written justification in the PR description and sign-off from
a project maintainer.

| Gate | Tool / Signal | Threshold |
|------|--------------|-----------|
| Linting & static analysis | Project linter | Zero errors |
| Unit test suite | Test runner | All passing, ≥ 80% line coverage |
| Integration test suite | Test runner | All passing |
| Performance benchmark | CI perf job | No regression > 10% vs. baseline |
| Accessibility scan | Automated a11y tool | Zero WCAG 2.1 AA violations |
| Complexity check | Static analysis | Cyclomatic complexity ≤ 10 per function |

A failing gate with no documented justification constitutes a block on merge.
Justifications are time-limited: a gate bypass accepted for one PR does not
carry forward to subsequent PRs.

## Governance

This constitution is the highest-ranking technical authority in the project.
In any conflict between this document and other practices, policies, or
conventions, the constitution prevails.

**Amendment procedure**:

1. Open a dedicated PR modifying only `.specify/memory/constitution.md` and any
   directly impacted template files.
2. State the motivation, the version bump type (MAJOR / MINOR / PATCH), and the
   impact on existing work in the PR description.
3. Obtain approval from at least two maintainers before merging.
4. Update `LAST_AMENDED_DATE` and `CONSTITUTION_VERSION` in the footer.
5. Run `/speckit.analyze` after merging to surface any downstream spec/plan
   inconsistencies introduced by the amendment.

**Versioning policy** (semantic):

- **MAJOR** — a principle is removed, renamed with incompatible meaning, or its
  non-negotiable rules are materially weakened.
- **MINOR** — a new principle or section is added, or existing guidance is
  materially expanded without removing anything.
- **PATCH** — clarifications, wording improvements, typo fixes, or
  non-semantic refinements.

**Compliance review**:

- All PR reviewers are responsible for verifying that implementation tasks do
  not violate any principle.
- The plan.md Constitution Check section MUST be completed (not left as a
  placeholder) before a feature moves to implementation.
- Quarterly: maintainers review whether thresholds (coverage %, latency targets,
  etc.) remain appropriate and initiate amendments where needed.

**Version**: 1.0.0 | **Ratified**: 2026-03-16 | **Last Amended**: 2026-03-16
