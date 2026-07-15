# Implementation Plan: Loading Spinner Indicator

**Branch**: `topic/vii-1017-loading-spinner` (spec dir `016-loading-spinner`) | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-loading-spinner/spec.md`

## Summary

Replace every text-only loading/busy state in the SPA with a single reusable
circular dotted spinner matching the motif in the supplied
`frontend/public/backgrounds/loading.svg` artwork (a ring of round dots with
graduated shading). Page-level waits (session bootstrap, vault load) show a
large spinner centered in the visible viewport; button busy states show a small
spinner beside their existing progress text. The spinner is recreated as a tiny
inline-SVG React component (`Spinner`) animated with CSS rotation — **frontend
only, zero new dependencies, zero backend/API/shared changes**. Accessibility is
preserved: the existing textual announcements stay (visually hidden on pages),
the SVG is decorative (`aria-hidden`), rotation stops under
`prefers-reduced-motion`, and the dots use `currentColor` so both themes and
forced-colors mode keep it visible.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) — React 18 frontend only; backend untouched

**Primary Dependencies**: React 18, Vite, Bootstrap 5.3 (CSS only), existing design tokens (`frontend/src/styles/tokens.css`). **No new dependencies.**

**Storage**: N/A (no data changes; purely visual)

**Testing**: No unit tests (Constitution Principle II). Manual browser verification via quickstart.

**Target Platform**: Modern evergreen browsers (SPA served by Cloudflare Worker); mobile ~320px → desktop

**Project Type**: Web application (frontend-only change within the existing monorepo)

**Performance Goals**: No measurable impact — spinner is a ~1 KB inline SVG + one CSS keyframe; no network requests, no re-render loops (pure CSS animation)

**Constraints**: WCAG 2.1 AA (status announcements preserved, decorative graphic hidden); `prefers-reduced-motion` honored; forced-colors/print safe; no layout shift or horizontal scroll at 320px; one motif reused everywhere (Constitution III — no one-off styles)

**Scale/Scope**: 1 new component + 1 tokens.css block; ~9 call sites edited (2 page-level waits, 7 busy-button surfaces); ~4 spec-era loading texts replaced

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | One reusable `Spinner` component with TSDoc; call sites edited minimally; dead loading-text styles removed if orphaned; lint/typecheck gates run | PASS |
| II. Testing Standards | No unit tests added; manual quickstart verification only | PASS |
| III. UX Consistency | Single shared spinner motif (no one-off styles) integrated with design tokens; loading states made MORE consistent app-wide; WCAG AA preserved (role=status text kept, decorative SVG `aria-hidden`, reduced-motion honored); responsive 320px→desktop verified in-story | PASS |
| IV. Performance | Pure CSS animation on a tiny inline SVG; zero requests; no budget change | PASS |
| V. Scalability & Maintainability | One component + one CSS block = single point of change; YAGNI (no spinner-size prop explosion — exactly two sizes needed) | PASS |

**Post-Phase-1 re-check**: PASS — design introduces one component, one CSS block, no new deps, no API surface. Complexity table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/016-loading-spinner/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — no persistent data)
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── spinner-ui.md    # UI contract: spinner anatomy, placement, a11y, degradation
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── public/backgrounds/loading.svg      # Supplied artwork (REFERENCE ONLY — not loaded at runtime)
└── src/
    ├── components/
    │   ├── Spinner.tsx                 # NEW: reusable dotted-ring spinner (inline SVG, aria-hidden)
    │   ├── ProtectedRoute.tsx          # EDIT: centered page spinner replaces "Loading…" text
    │   ├── AddChordDialog.tsx          # EDIT: spinner beside "Saving…" / "Deleting…"
    │   ├── SectionDialog.tsx           # EDIT: spinner beside "Saving…" / "Deleting…"
    │   └── UserMenu.tsx                # EDIT: spinner beside "Signing out…"
    ├── pages/
    │   ├── HomePage.tsx                # EDIT: centered page spinner for vault load; spinner beside "Unlocking…"
    │   ├── LoginPage.tsx               # EDIT: spinner beside "Signing in…"
    │   ├── RegisterPage.tsx            # EDIT: spinner beside "Creating account…"
    │   └── ResetPasswordPage.tsx       # EDIT: spinner beside "Checking…"/"Verifying…"/"Resetting…"
    └── styles/
        └── tokens.css                  # EDIT: .spinner block (keyframes, sizes, page-centering,
                                        #        reduced-motion, forced-colors/print guards)
```

**Structure Decision**: Frontend-only feature inside the existing monorepo web
layout. One new component in `frontend/src/components/`, one CSS block appended
to the existing design-token stylesheet, and mechanical edits to the nine
existing loading/busy call sites. `backend/` and `shared/` are untouched.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
