<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Bump rationale: Amended Principle II (Testing Standards) to a pragmatic, project-scoped
  approach — unit tests are not required and there is no coverage gate. The principle is
  refined and relaxed rather than removed, so this is a MINOR revision.
- Modified principles:
  - II. Testing Standards — reframed from "automated tests required + 80% coverage gate"
    to "unit tests not required; concentrate limited effort on critical security flows"
- Added sections: none
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (Constitution Check references constitution generically)
  - .specify/templates/spec-template.md ✅ aligned (scope/requirements consistent)
  - .specify/templates/tasks-template.md ✅ updated (no unit-test tasks; optional critical-flow checks only)
  - .github/copilot-instructions.md ✅ updated (project context + MERN/TypeScript coding standards added)
- Follow-up TODOs: none
-->

# vii-pass Constitution

## Core Principles

### I. Code Quality

- All code MUST pass automated linting and formatting checks before merge; suppressed
  warnings MUST include a documented, code-adjacent justification.
- Every module and function MUST have a single, clear responsibility; excessive
  complexity and deep nesting MUST be refactored rather than shipped.
- All changes MUST be reviewed and approved by at least one other engineer before
  merging to the main branch.
- Public APIs, exported functions, and non-obvious logic MUST be documented; dead code,
  commented-out blocks, and unused dependencies MUST be removed.
- **Rationale**: Consistent, reviewable, well-documented code reduces defects,
  accelerates onboarding, and keeps long-term maintenance cost low.

### II. Testing Standards

- Unit tests are NOT required for this project; contributors MUST NOT invest significant
  effort writing or maintaining unit-test suites.
- Limited verification effort SHOULD be reserved for critical, security-sensitive flows
  (e.g., authentication, vault encryption/decryption) via manual checks or a small number
  of integration/end-to-end checks where they add clear value.
- There is NO minimum code-coverage gate; coverage metrics MUST NOT block merges.
- Whatever automated tests do exist MUST pass in CI before merge; broken tests MUST be
  fixed or removed, never left failing.
- **Rationale**: This project optimizes for delivery speed on a focused feature set;
  concentrating scarce verification effort on critical security paths yields better return
  than broad unit-test coverage.

### III. User Experience Consistency

- All user-facing surfaces MUST follow a single shared design system (components,
  spacing, typography, color tokens, iconography); one-off styles are prohibited.
- Interaction patterns, terminology, and empty/loading/error states MUST be consistent
  across the product.
- Interfaces MUST meet WCAG 2.1 AA accessibility criteria, including keyboard
  navigation, sufficient color contrast, and semantic labels.
- User-facing errors MUST be actionable and human-readable; raw stack traces or internal
  error codes MUST NOT be shown to end users.
- **Rationale**: A predictable, accessible experience builds user trust, lowers support
  burden, and scales cleanly across teams and features.

### IV. Performance Requirements

- Every user-facing feature MUST define measurable performance budgets before
  implementation (e.g., API latency, page load time, memory footprint).
- Unless a feature explicitly documents different targets, defaults are: API responses
  p95 < 200ms and primary page interactive < 2s on baseline hardware and network.
- Performance-sensitive paths MUST be validated with benchmarks or profiling;
  regressions beyond budget MUST block release until resolved.
- Optimization MUST be driven by measurement, not speculation; premature optimization
  that harms readability without evidence is prohibited.
- **Rationale**: Explicit, measured performance budgets prevent gradual degradation and
  protect the user experience as the system grows.

### V. Scalability & Maintainability

- Architecture MUST favor modular, loosely coupled components with well-defined
  interfaces so parts can evolve and scale independently.
- Services MUST be designed to scale horizontally: prefer stateless request handling and
  externalize shared state to appropriate data stores or caches.
- Configuration MUST be environment-driven with no hardcoded secrets or environment
  assumptions; systems MUST degrade gracefully under load.
- Solutions MUST match current, well-understood requirements (YAGNI) while preserving
  clear extension points; added complexity MUST be justified in review.
- **Rationale**: Designing for modular growth keeps the system adaptable and
  cost-effective as usage, data volume, and team size increase.

## Quality Gates & Standards

The following measurable gates MUST be enforced in CI/CD and during code review, and a
build MUST NOT be releasable if any gate fails:

- **Static analysis**: Linting and formatting produce zero errors; all warnings are
  triaged.
- **Testing**: No coverage gate. Any existing automated tests MUST pass, and critical
  security flows SHOULD be manually verified before release.
- **Performance**: Per-feature budgets are defined and automatically checked on critical
  paths.
- **Accessibility**: Automated a11y checks pass; new primary flows receive a manual
  audit against WCAG 2.1 AA.
- **Security**: Dependency vulnerability scanning runs on each build; no known
  high/critical CVEs are shipped and secrets are never committed.

## Development Workflow

- All work MUST land via pull requests with at least one approving review and green CI.
- Each PR description MUST state how the change complies with the affected principles and
  explicitly note any deviations.
- The main branch MUST remain releasable at all times; incomplete work SHOULD be gated
  behind feature flags.
- Reviewers MUST verify code quality, appropriate verification of critical flows, UX
  consistency, and performance impact before approving.

## Governance

- This Constitution supersedes all other development practices; where conflicts arise,
  the Constitution prevails.
- Amendments MUST be proposed via pull request, documented with rationale, reviewed, and
  approved by project maintainers before taking effect.
- Versioning follows semantic rules: MAJOR for backward-incompatible governance or
  principle removals/redefinitions, MINOR for new or materially expanded
  principles/sections, and PATCH for clarifications and non-semantic refinements.
- Compliance MUST be verified on every PR review; unjustified violations block merge, and
  justified exceptions MUST be recorded in the PR and, if lasting, tracked in a
  deviations log.
- Runtime development guidance for agents lives in `.github/copilot-instructions.md` and
  MUST remain consistent with this Constitution.

**Version**: 1.1.0 | **Ratified**: 2026-07-06 | **Last Amended**: 2026-07-06
