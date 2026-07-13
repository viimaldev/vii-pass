# Research: Two-Level Credential Encryption

**Feature**: specs/010-credential-encryption | **Date**: 2026-07-13

All decisions below resolve the open technical questions from the plan's Technical
Context. No NEEDS CLARIFICATION markers remain.

---

## Decision 1 — Crypto primitives: Web Crypto AES-256-GCM + PBKDF2/HKDF, zero dependencies

**Decision**: Use the Web Crypto API (`crypto.subtle`) exclusively, on both sides:

- **Encryption (both levels)**: AES-256-GCM with a random 12-byte IV per value.
  GCM provides confidentiality **and** integrity in one primitive — any tampering or
  corruption makes `decrypt()` throw, which directly satisfies FR-007/SC-006 without a
  separate MAC.
- **Client KDF**: PBKDF2-HMAC-SHA-256 (Web Crypto native) to stretch the login password,
  then HKDF-SHA-256 to split the stretched output into two independent keys (see
  Decision 3).
- **Server KDF**: none needed — the Level-2 key is a random 256-bit secret provided via
  environment, imported directly as an AES key.

**Rationale**: Web Crypto is native to both evergreen browsers and Cloudflare Workers —
zero new npm dependencies (repo precedent: `password.ts` already uses it). AES-GCM is
the NIST-recommended AEAD; authenticated encryption is mandatory for a password manager
(OWASP A02: Cryptographic Failures). PBKDF2 is the only password-stretching KDF Web
Crypto supports natively; Argon2 would require a WASM dependency, rejected for scope.

**Alternatives considered**:
- `libsodium-wrappers` / `tweetnacl` (XChaCha20-Poly1305, Argon2id): better primitives on
  paper, but adds a dependency + WASM loading complexity; AES-GCM via Web Crypto is
  hardware-accelerated and entirely sufficient at this threat model.
- AES-CBC + HMAC: two primitives, easy to compose wrongly (padding oracles, MAC-then-
  encrypt mistakes); GCM does both in one API call.
- Deriving keys with plain SHA-256 (no stretch): rejected — offers no brute-force
  resistance at all for the password-derived key.

---

## Decision 2 — Key hierarchy: password-derived master key wraps a random vault key (Bitwarden model)

**Decision**: The data-encryption key is **not** derived from the password directly.
Instead:

1. At **registration**, the client generates a random 256-bit **vault key** (VK).
2. The client derives a **master key** (MK) from the password + a random per-user
   **KDF salt** (PBKDF2, 600,000 iterations — client-side, so the Workers 100k cap does
   not apply).
3. The client encrypts VK under a wrapping key derived from MK (AES-GCM) →
   **wrappedVaultKey**, and uploads `{ kdfSalt, wrappedVaultKey }` with registration.
4. At **login**, the client fetches `kdfSalt`, re-derives MK, downloads
   `wrappedVaultKey` (in the auth response), unwraps VK, and keeps **VK only in memory**.
5. All chord values are encrypted under VK.

**Rationale**: This is the architecture used by Bitwarden/1Password because it makes
FR-010 (password change must not lose data) structurally true: changing the password
only requires re-wrapping one 32-byte key, never re-encrypting the vault. It also keeps
the door open for the deferred recovery feature (a recovery key would simply be a second
wrapping of the same VK) — exactly what the spec's Q2 clarification requires. Works from
any device (salt + wrapped key live server-side) — FR-005.

**Alternatives considered**:
- Encrypt data directly under the password-derived key: simpler, but a future password
  change would require client-side re-encryption of every value in one atomic batch —
  fragile, and violates the spirit of FR-010/US3. Rejected.
- Per-chord random keys wrapped by VK: needless extra layer at this scale. Rejected
  (YAGNI, Constitution V).

---

## Decision 3 — Auth without sending the password: client-side auth hash, split from the encryption key

**Decision**: The login password never leaves the browser. From the PBKDF2-stretched
master key, HKDF derives two **independent** subkeys:

- `authKey` (HKDF info = `"vii-pass/auth"`) — base64url-encoded and sent to the server
  as the `authHash` field in register/login, **in place of** the password.
- `wrapKey` (HKDF info = `"vii-pass/wrap"`) — never leaves the device; wraps/unwraps VK.

The server treats `authHash` exactly as it treated the password before: it runs it
through the existing server-side PBKDF2 storage scheme (`password.ts`, unchanged) and
stores/verifies that. The server never possesses `wrapKey` or VK plaintext.

**Rationale**: The user's requirement is literal: *"No password should be visible in
… network payload in the browser."* Today `POST /api/auth/login` carries
`{ password: "..." }` in cleartext JSON (visible in dev tools). Sending a derived hash
instead satisfies the requirement, and the HKDF domain separation guarantees the server
(or a network observer of `authHash`) learns nothing usable to unwrap the vault —
this is what makes SC-005 (server compromise ≠ readable vault) hold. Server-side
re-hashing of `authHash` is retained so a DB leak still doesn't allow direct login
replay (defense in depth; mirrors Bitwarden's design).

**Alternatives considered**:
- Keep sending the raw password over TLS: standard practice for ordinary web apps, but
  fails the user's explicit requirement and would let a compromised/logged server read
  the vault key material. Rejected.
- SRP/OPAQUE (PAKE protocols): cryptographically stronger login, but far more complex,
  needs a library, and overkill relative to this threat model. Rejected (Constitution V).
- Sending `authHash` without server-side re-hash: a DB dump would then contain
  login-replayable credentials. Rejected — one line of existing code prevents it.

**Consequence — login round-trip**: the client needs the per-user `kdfSalt` *before* it
can compute `authHash`, so login becomes: `GET /api/auth/salt/:username` → derive →
`POST /api/auth/login`. The salt endpoint returns a **deterministic fake salt** (HMAC of
username under a server secret… simplified: SHA-256(username + static pepper)) for
unknown usernames so it cannot be used to enumerate accounts (mirrors FR-012 of the auth
feature: no enumeration).

---

## Decision 4 — Envelope formats: versioned, self-describing strings

**Decision**: Encrypted values are compact dot-separated strings, base64url payloads
(consistent with the repo's existing `encoding.ts` helpers and the `pbkdf2$...` hash
format precedent):

- **Level 1 (client → network → inside L2 at rest)**: `v1.l1.<iv>.<ciphertext>`
- **Level 2 (at rest, wraps the entire L1 string)**: `v1.l2.<keyId>.<iv>.<ciphertext>`
- **Wrapped vault key (users collection)**: `v1.wk.<iv>.<ciphertext>`

`keyId` names which server key encrypted the value (initial value `k1`), enabling
Level-2 key rotation (FR-012): a rotation deploys `VAULT_ENC_KEY` as `k2` while keeping
`k1` readable, and values re-wrap lazily on write. The `v1` prefix versions the whole
scheme for future algorithm migration (Constitution V extension point).

**Rationale**: Strings (not nested objects/BSON binaries) keep the Zod schemas, shared
TypeScript types, Mongo documents, and JSON payloads simple and diff-friendly; the
format is trivially validated at the API boundary with a regex. Self-describing formats
are the established repo pattern (`pbkdf2$sha256$...`).

**Alternatives considered**:
- Structured sub-documents `{ iv, ct, keyId }`: more "typed" but noisier across the
  shared-type/Zod/Mongo/JSON stack for zero functional gain. Rejected.
- Encrypting the whole `fields` array as one blob: fewer envelopes, but breaks
  per-field error isolation (FR-007 requires per-field failure) and per-row typing
  (`type` must stay readable for icons). Rejected.

---

## Decision 5 — Level-2 server key management on Cloudflare Workers

**Decision**: `VAULT_ENC_KEY` is a per-environment Cloudflare **Worker secret**
(`wrangler secret put VAULT_ENC_KEY` / `--env preview`), value = 32 random bytes,
base64url-encoded, generated once per environment. Local dev reads it from
`.dev.vars` (git-ignored), with a placeholder documented in `.dev.vars.example`.
Format in env: `k1:<base64url-32-bytes>` — key-id prefix so rotation can later supply
`k1:<old>,k2:<new>` without schema changes.

**Rationale**: Identical operational pattern to the existing `MONGODB_URI` secret
(never in CI, never in YAML — matches the CI/CD feature's rules and FR-012). Workers
have no KMS; a strong random env secret is the platform-appropriate equivalent.
AES-GCM under this key is applied to the *already-encrypted* L1 string, so even this
secret leaking does not expose plaintext (SC-005).

**Alternatives considered**:
- Cloudflare secrets store / KMS integration: not available in this plan/setup; env
  secret is the platform norm. Rejected for now.
- Deriving the L2 key per-user (HKDF of master secret + userId): nice property
  (per-user isolation at rest) and cheap — **adopted** as an HKDF step inside
  `vaultCrypto.ts`: the actual AES key for a user = HKDF(VAULT_ENC_KEY, salt=userId).
  A stolen ciphertext for user A cannot be decrypted by replaying user B's path.
- Storing the L2 key in MongoDB: circular — a DB dump would include the key that
  protects the DB. Rejected outright.

---

## Decision 6 — Existing data: drop users and chords (no migration)

**Decision**: On ship, per environment: `db.chords.drop()` **and** `db.users.drop()`
(sessions too, since they reference user ids). Users re-register; chords are re-entered.

**Rationale**: Chords-drop is the established precedent (feature 009). Users must also
be dropped because the stored password verifier changes meaning: the server previously
hashed the *raw password*; it now hashes the *client-derived authHash*. An existing
user's stored hash can never match, and they have no `kdfSalt`/`wrappedVaultKey`.
The app is pre-production with no real user base; migration machinery (dual verifier
paths, lazy upgrade on login) is complexity with zero beneficiaries. The spec already
authorizes dropping chord data; dropping accounts is the same decision applied
consistently.

**Alternatives considered**:
- Lazy migration (accept raw password once, upgrade to authHash + generate VK at next
  login): the "right" answer for a live product; pure waste here. Rejected (YAGNI).

---

## Decision 7 — Client KDF cost: 600k iterations client-side, one-time per session

**Decision**: PBKDF2-HMAC-SHA-256 at **600,000 iterations** (OWASP 2023 recommendation)
in the browser, executed once at login/registration. The Workers 100k PBKDF2 cap is
irrelevant here — the expensive stretch happens client-side; the server-side re-hash of
`authHash` stays at the existing capped 100k (it is stretching an already-stretched
high-entropy input, so the cap is harmless there).

**Rationale**: ~200–400ms on mid-range hardware, once per sign-in — inside the plan's
≤300ms-ish budget and imperceptible against SC-003's ~1s vault-task budget. Given the
deliberately weak 3–10 char password policy (Complexity Tracking), maximizing the
client-side stretch is the one free mitigation available.

**Alternatives considered**:
- 100k everywhere for symmetry: needlessly weak on the client where no cap exists.
- 1M+ iterations: >1s on low-end mobile → violates the responsive sign-in experience.

---

## Decision 8 — Frontend state: vault key in AuthContext memory; decrypt/encrypt at the VaultContext boundary

**Decision**:
- `AuthContext` derives keys during login/register, holds the unwrapped VK in a `useRef`
  (never state, never storage of any kind), exposes it via context, and zeroes it on
  logout / 401-driven session loss (FR-006).
- `VaultContext` (existing, from features 007/008) is the single
  encrypt-on-save / decrypt-on-fetch boundary: components above it keep working with
  plaintext exactly as today, so `AddChordDialog`, `ChordCard`, reorder logic, etc. need
  only minimal edits (per-field decrypt-error display).
- A decrypt failure maps the field value to a sentinel error state (not a thrown
  render), rendering as "This value could not be read" per FR-007 — other fields/chords
  unaffected.
- Page refresh nuance: the session cookie survives a refresh but the in-memory VK does
  not, and the password is gone. Refresh therefore triggers a **locked-vault state**:
  the UI prompts for the password once (re-derive → unwrap → unlocked) *or* the user
  logs in again. This is the unavoidable consequence of true zero-knowledge + FR-006 and
  matches how Bitwarden's web vault behaves (lock on refresh). Documented as expected
  behavior in quickstart; implemented as a minimal inline "Unlock" password form on the
  vault page reusing existing form styles.

**Rationale**: Keeping crypto at one boundary preserves every existing component
contract (FR-008, FR-004) and confines the blast radius of this feature. `sessionStorage`
persistence of the VK was considered for refresh-survival and **rejected**: FR-006 says
unlock material must not be persisted beyond memory, and sessionStorage is readable by
any successful XSS.

**Alternatives considered**:
- Storing VK in `sessionStorage`/IndexedDB for refresh survival: rejected (above).
- Encrypt/decrypt inside each component: scatters crypto through the UI. Rejected.

---

## Decision 9 — What exactly is encrypted (scope boundary)

**Decision**: Encrypted at both levels: `chord.fields[*].value` (all five types — a
"username" is as revealing as a password in aggregate) and `chord.url`. Plaintext:
`chord.title` (FR-011: listing/order/uniqueness), `chord.fields[*].type` (drives icons
and masking; reveals nothing about values), `position`, `sectionId`, section
names/colors (organizational labels, per spec assumption).

**Server-side URL validation consequence**: the server can no longer normalize/validate
the URL (it only sees ciphertext). The `https://`-prepend + `http(s)`-only allow-list
from feature 009 (the stored-XSS boundary) **moves to the client** (`AddChordDialog`
already mirrors it) and is enforced at decrypt-render time in `ChordCard` as
belt-and-braces: a decrypted URL failing the allow-list renders as text-error, never as
an `href`. The Zod schema now validates envelope *format* instead of URL semantics.

**Rationale**: Matches FR-011 exactly. The XSS boundary must follow the plaintext — it
can only live where plaintext exists (the client). Validating at decrypt-time keeps the
guarantee even against a tampered DB (which GCM would catch anyway).

**Alternatives considered**:
- Leaving `url` plaintext so the server keeps validating: leaks every site the user has
  an account on — unacceptable for a password manager. Rejected.
- Encrypting titles too: breaks server-side uniqueness/list/order (FR-011 explicitly
  keeps titles readable). Rejected per spec.
