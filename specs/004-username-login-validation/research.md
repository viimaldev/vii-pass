# Phase 0 Research: Username-Based Login Validation

**Feature**: [spec.md](./spec.md) | **Branch**: `topic/vii-1004-username-login-validation` | **Date**: 2026-07-08

This document resolves the design decisions for replacing the **email** login identifier with
a **username** and relaxing the registration password policy to **3–10 characters**. It builds
on feature 002 ([../002-user-auth-session/research.md](../002-user-auth-session/research.md)) —
PBKDF2 hashing, opaque server-side sessions, HttpOnly cookies, Zod boundary validation — and
does not re-litigate those. The spec carried **no [NEEDS CLARIFICATION]** markers; the
interpretive choices below were pre-resolved as documented Assumptions in the spec and are
formalized here.

---

## Decision 1 — Username field: single normalized (lowercased) `username`, unique index

- **Decision**: Rename the `users.email` field to **`username`**. Store it **trimmed and
  lowercased** (normalized), and enforce uniqueness with a **unique index on `username`**
  (replacing the `email` unique index). Look up accounts by the normalized value on both
  registration (duplicate detection) and login. Do **not** add a separate "display-cased"
  username field.
- **Rationale**:
  - Mirrors exactly how `email` already worked (lowercased, unique-indexed), so the change is
    a rename-in-place with minimal risk and no new moving parts (Constitution V, YAGNI).
  - A single normalized field gives **case-insensitive uniqueness and sign-in** for free
    ("Alice" == "alice"), satisfying FR-006 and the case-only-duplicate edge case, without an
    extra column or a case-insensitive collation index.
  - The product already has a dedicated **`displayName`** for presentation, so there is no need
    to preserve the user's original username casing for display — the cosmetic concern is
    already covered.
  - Uniqueness is enforced by the **database index**, not an application `findOne` check, which
    closes the check-then-insert race (two simultaneous registrations of the same name) — the
    duplicate-key error is caught and mapped to `409`.
- **Alternatives considered**:
  - **Store `username` as entered + a separate `usernameLower` unique key**: preserves original
    casing for display. **Rejected** (YAGNI) — `displayName` already covers display; a second
    field and index add complexity for no required behavior.
  - **Case-insensitive collation index on a case-preserving field**: **Rejected** — heavier and
    inconsistent with the existing lowercase-normalization pattern; collation edge cases add
    surface area for no benefit here.
  - **Application-level uniqueness check before insert**: **Rejected** — racy; the unique index
    is the correct, stateless guarantee.

---

## Decision 2 — Username format: strict ASCII `^[A-Za-z0-9]+$`, length 3–30

- **Decision**: A username MUST match **`^[A-Za-z0-9]+$`** (ASCII letters and digits only) with
  a length of **3–30 characters** after trimming. Enforce this in the Zod `registerSchema` at
  the API boundary and mirror it as inline client-side validation on the registration page.
  Validation order: `trim` → length (min 3 / max 30) → regex → `toLowerCase` (normalize for
  storage/lookup).
- **Rationale**:
  - "Any alphanumeric value … No special characters" (user requirement) is interpreted
    unambiguously as the ASCII sets `A–Z`, `a–z`, `0–9` — **no** spaces, punctuation, symbols,
    underscores, hyphens, or accented/non-Latin letters. This keeps the rule simple, testable,
    and predictable (spec Assumptions), and rejects email-style input (`@`, `.`) naturally.
  - The **minimum 3** comes straight from the requirement. A **maximum of 30** is added as a
    sane upper bound (the requirement gives no maximum) to prevent abuse and keep the name
    usable in the UI; it is easily tuned later.
  - An **allowlist** regex (not a denylist) is inherently injection-safe: the value is only ever
    used in an equality filter (`findOne({ username })`) with the native driver, so there is no
    query-injection vector, but the strict allowlist is defense-in-depth.
  - Doing the same check on the client gives immediate, accessible feedback (FR-009) while the
    server check remains the source of truth (never trust the client).
- **Alternatives considered**:
  - **Allow underscores/hyphens/dots** (common username charsets): **Rejected** — contradicts
    "no special characters"; the requirement is explicit.
  - **Unicode letters/digits (`\p{L}\p{N}`)**: **Rejected** — "alphanumeric, no special
    characters" is clearer as ASCII-only; Unicode confusables/normalization would complicate
    uniqueness and are out of scope (spec Assumptions).
  - **No maximum length**: **Rejected** — unbounded input is an abuse vector and breaks UI
    layout; 30 is a documented, adjustable cap.

---

## Decision 3 — Password policy: 3–10 characters (explicit, documented security relaxation)

- **Decision**: Change the registration password rule from **min 12** to a **3–10 character**
  range (inclusive) in `registerSchema`, and mirror the range in the registration page's inline
  validation and hint text. Login continues to require only a **non-empty** password (no
  format/length check — verification decides correctness). Storage remains **PBKDF2 + per-user
  salt**; nothing about hashing changes.
- **Rationale**:
  - Directly implements the explicit user requirement ("Password: Length 3-10"). The product
    owner sets the policy for their own application.
  - Keeping validation **at the boundary only** (Zod) and leaving hashing untouched means the
    change is isolated to two length numbers plus UI copy — low risk, easy to revert.
  - Login stays lenient (non-empty) so a wrong password yields the generic
    invalid-credentials error rather than a format error that could leak the policy or hint
    which field was wrong (preserves FR-012 non-enumeration).
- **Security trade-off (flagged, not hidden)**:
  - For a **password manager**, a 3-character minimum is materially weaker than the prior
    12-character floor and is **below OWASP** Authentication guidance (A07). Short passwords are
    trivially brute-forced offline if the hash store is ever exposed — the PBKDF2 work factor
    mitigates but does not eliminate this for a 3-char keyspace.
  - This is recorded as a **justified, documented deviation** in [plan.md](./plan.md) Complexity
    Tracking and the spec Assumptions. **Recommendation**: revisit and raise the minimum (e.g.,
    to ≥ 8, ideally back toward 12) in a follow-up once the immediate requirement is satisfied.
    No silent override is made either way — the requested policy ships, the risk is visible.
- **Alternatives considered**:
  - **Keep the 12-character minimum**: **Rejected** — contradicts the explicit requirement.
  - **Compromise floor (e.g., 8–10)**: **Rejected for now** — not requested; would silently
    override the user's decision. Called out as the recommended future change instead.

---

## Decision 4 — Remove email from the login identity entirely

- **Decision**: Remove `email` from the account's login identity end to end: it is no longer
  collected on the registration form, no longer part of `registerSchema`/`loginSchema`, no
  longer stored on new `users` documents as an identifier, and no longer present in the public
  `PublicUser` shape (replaced by `username`). No email-dependent feature (verification,
  password-reset-by-email) exists today, so nothing breaks.
- **Rationale**:
  - The requirement is explicit: "I don't want username should be email." Retaining a hidden
    email field would be dead data and contradict the intent (Constitution I: no dead code).
  - `PublicUser` is the single shared contract between SPA and API; swapping `email → username`
    there keeps both sides in lockstep and updates the user-menu identity line automatically.
- **Alternatives considered**:
  - **Keep an optional email for future account recovery**: **Rejected** (YAGNI + explicit
    "don't want email") — no recovery feature is in scope; it can be reintroduced deliberately
    later if/when such a feature is specified.

---

## Decision 5 — No data migration (early lifecycle assumption)

- **Decision**: Do **not** build a migration for pre-existing email-based accounts. Assume the
  `users` collection has no production data under the old scheme (accounts were introduced only
  in the immediately preceding feature). In **development**, existing seed users and the old
  `email_1` unique index should be dropped/recreated.
- **Rationale**:
  - Matches the spec Assumption and the repo's early-lifecycle reality. Building a
    backfill/rename migration for data that does not exist would be wasted effort (YAGNI).
  - The application creates the new `username_1` unique index on first use but does **not** drop
    the legacy `email_1` index automatically (safer than issuing destructive index drops from
    app code). In dev this is a one-time manual cleanup, documented in
    [quickstart.md](./quickstart.md).
- **Operational note**: If any real accounts ever did exist under the old scheme, a separate
  migration (rename `email → username`, backfill, swap indexes) would be required — explicitly
  out of scope here.
- **Alternatives considered**:
  - **Auto-drop the old index / auto-rename fields on startup**: **Rejected** — destructive
    schema changes from runtime code are risky and surprising; a documented manual step is safer
    for a dev-only concern.

---

## Summary of changes vs. feature 002

| Aspect | Feature 002 (current) | This feature (004) |
|--------|-----------------------|--------------------|
| Login identifier | `email` (valid email, lowercased) | `username` (`^[A-Za-z0-9]+$`, 3–30, lowercased) |
| Uniqueness | unique index on `email` | unique index on `username` |
| Password (register) | min 12, max 200 | **min 3, max 10** |
| Password (login) | non-empty | non-empty (unchanged) |
| Public shape | `PublicUser { id, email, displayName }` | `PublicUser { id, username, displayName }` |
| Duplicate error | `409 email_taken` | `409 username_taken` |
| Generic login error | "Incorrect email or password." | "Incorrect username or password." |
| Email in identity | present | **removed entirely** |
| Sessions / hashing / cookies / gate | — | **unchanged** |

**All decisions resolved — no open [NEEDS CLARIFICATION].**
