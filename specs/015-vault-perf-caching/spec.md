# Feature Specification: Vault Performance — Single Upfront Load & Client Caching

**Feature Branch**: `topic/vii-1016-vault-perf-caching`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "I want to improve the performance of the application. Ex. Fetch all the sections and chords in the first request itself. No need to fetch from server, on browser refresh let's get fresh from server. Other than that new/edit only do server requests. Let's consider other possibilities as well to improve the performance"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One upfront load, instant section switching (Priority: P1)

When a signed-in user opens their vault, the application retrieves the user's entire
organizer — all sections and all entries in every section — in a single initial load.
After that, moving between sections is instant: clicking any section tab shows its
entries immediately from what was already loaded, with no waiting and no additional
server round-trips.

**Why this priority**: This is the core performance complaint. Today every section
switch triggers a fresh server fetch, so users see a loading delay each time they
change tabs. Eliminating per-switch fetches delivers the most visible speed
improvement and is the foundation the other stories build on.

**Independent Test**: Sign in with an account that has 3+ sections each containing
several entries. Observe that the initial view loads everything at once; then switch
between all sections repeatedly and confirm entries appear instantly with no loading
indicator and no additional data requests to the server.

**Acceptance Scenarios**:

1. **Given** a signed-in user with multiple sections and entries, **When** the vault
   surface first loads, **Then** all sections and all entries are retrieved in a
   single initial load (one request for the whole vault, not one per section).
2. **Given** the vault has finished its initial load, **When** the user switches to a
   different section, **Then** that section's entries display immediately without any
   server request and without a loading indicator.
3. **Given** the vault has finished its initial load, **When** the user switches back
   and forth between sections many times, **Then** no additional data requests are
   made to the server for viewing.
4. **Given** a signed-in user, **When** they reload the page in the browser, **Then**
   the application discards anything previously held and fetches fresh vault data from
   the server (again as a single load).
5. **Given** a user with only the default section and no entries, **When** the vault
   loads, **Then** the initial load completes successfully and the empty state shows
   as it does today.

---

### User Story 2 - Changes update the local view without refetching (Priority: P2)

When the user creates, edits, deletes, or reorders a section or an entry, the change is
saved to the server, and the on-screen vault updates from the outcome of that save —
the application does not follow up by re-downloading the section list or the entry
list.

**Why this priority**: Without this, every mutation would invalidate the cached vault
and trigger a full reload, negating the P1 win. It keeps writes correct (server is
still the source of truth for saves) while preserving the "no redundant fetch"
behavior.

**Independent Test**: With the vault loaded, create a new entry, edit it, reorder
entries, then delete it. Confirm each action issues exactly one save request and the
screen reflects the result without any additional list-fetch requests.

**Acceptance Scenarios**:

1. **Given** a loaded vault, **When** the user creates a new entry or section,
   **Then** exactly one save request is sent, and the new item appears in the correct
   place without a follow-up list fetch.
2. **Given** a loaded vault, **When** the user edits an entry or renames/recolors a
   section, **Then** exactly one save request is sent, and the updated values display
   without a follow-up list fetch.
3. **Given** a loaded vault, **When** the user deletes an entry or a deletable
   section, **Then** exactly one delete request is sent, and the item disappears
   (with entries of a deleted section removed with it) without a follow-up list fetch.
4. **Given** a loaded vault, **When** the user reorders sections or entries, **Then**
   the new order shows immediately and one save request records it; if the save fails,
   the user is informed and the display returns to a correct order.
5. **Given** any save fails (e.g. network error or rejected input), **Then** the
   on-screen vault is not left showing unsaved data as if it were saved — the user
   sees the existing error message style and the display remains consistent with the
   server.

---

### User Story 3 - Locked vault unlocks without re-downloading (Priority: P3)

A user whose vault is locked (secure data not yet readable) sees their sections and
masked entries from the already-loaded data; when they unlock, the readable values
appear without the application re-downloading the vault from the server.

**Why this priority**: Unlock is a rarer flow (fallback when the silent restore is
unavailable), but today it forces a re-fetch. Reusing the already-loaded data makes
unlock feel instant and removes another redundant server round-trip.

**Independent Test**: Arrange a locked-vault state (e.g. clear the silently-restored
key), reload, confirm the vault loads once with protected values hidden, unlock with
the password, and confirm the readable values appear with no additional vault data
request.

**Acceptance Scenarios**:

1. **Given** the vault loaded while locked, **When** the user unlocks it, **Then**
   protected values become readable using the already-loaded data, without another
   vault download.
2. **Given** the vault is locked, **When** the user browses sections, **Then**
   structure (sections, titles, order) is visible and switching sections is instant,
   with protected values hidden as today.

---

### Edge Cases

- **Large vaults**: a user with many sections and hundreds of entries must still get a
  successful single initial load; the interface must remain responsive while the load
  completes (loading indicator on first load only).
- **Initial load fails**: the user sees the existing retryable error message; no
  partial/stale vault is shown as if complete.
- **Session expires while browsing cached data**: viewing may continue from loaded
  data, but the next save fails with the existing signed-out handling (redirect to
  sign-in); no secure data remains available after sign-out.
- **Two sessions/devices editing the same account**: changes made elsewhere are not
  expected to appear live; they appear after the next browser refresh (accepted
  staleness model — refresh is the sync point).
- **Save conflict** (e.g. duplicate title created from another session): the server's
  rejection is shown with the existing error messaging, and the local view is not left
  claiming the save succeeded.
- **Sign-out**: all locally held vault data (including any readable secure values) is
  discarded immediately, exactly as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST retrieve the signed-in user's complete vault —
  all sections and all entries — as one initial load when the vault surface first
  opens, instead of loading entries section-by-section on demand.
- **FR-002**: After the initial load, switching between sections MUST NOT trigger any
  server request; the entries shown MUST come from the already-loaded data.
- **FR-003**: A browser page reload MUST discard all previously loaded vault data and
  fetch a fresh copy from the server; the server remains the source of truth at every
  page load.
- **FR-004**: Create, edit, delete, and reorder operations MUST each send exactly one
  request to the server, and the on-screen vault MUST update from that operation's
  outcome without re-downloading section or entry lists.
- **FR-005**: If a save operation fails, the application MUST inform the user using
  the existing error-messaging patterns and MUST NOT leave the display showing
  unsaved changes as if they were saved.
- **FR-006**: Vault data held on the client MUST live in memory only for the duration
  of the page visit; it MUST NOT be written to any persistent browser storage, and it
  MUST be discarded on sign-out or when the session is no longer valid.
- **FR-007**: Read-only (normal-role) sessions MUST get the same single-load and
  instant-switching behavior for viewing; the existing omission of mutation controls
  is unchanged.
- **FR-008**: A locked vault MUST be able to display structure (sections, entry
  titles, order) from the single load, and unlocking MUST reveal protected values
  from the already-loaded data without another vault download.
- **FR-009**: The first-load experience MUST show a loading indicator only during the
  initial load; subsequent section switches MUST NOT show loading indicators.
- **FR-010**: All existing behaviors not related to data loading — permissions,
  ordering rules, default-section provisioning, masking/reveal, error messages —
  MUST remain unchanged from the user's perspective.

### Key Entities

- **Vault snapshot**: the complete picture of one user's organizer at a moment in
  time — every section (name, color, order, default flag) together with every entry
  (title, protected values, order, owning section). Delivered whole at page load,
  then kept current on the client by applying the outcome of each successful save.
- **Section / Entry**: unchanged in meaning from the existing organizer; only *when*
  they are fetched changes (once, upfront) — not their content, rules, or ownership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the vault has loaded, switching to any section displays its
  entries in under 100 ms (perceived as instant), with zero server requests.
- **SC-002**: A complete vault session (open, browse every section, make one edit)
  issues at most: one vault load + one request per user-initiated change — no
  other data requests.
- **SC-003**: For a typical vault (up to 10 sections, up to 200 total entries), the
  initial load completes and the first section is viewable within 2 seconds on a
  standard broadband connection.
- **SC-004**: 100% of create/edit/delete/reorder actions are reflected on screen
  immediately after the save completes, without any follow-up list fetch.
- **SC-005**: After browser refresh, the data shown always matches the server's
  current state (no stale data survives a reload).
- **SC-006**: No vault data (encrypted or readable) can be found in persistent
  browser storage after sign-out.

## Assumptions

- **Staleness model**: a browser refresh is the synchronization point. Changes made
  from another device/session are not expected to appear live; this is acceptable for
  a personal password manager and matches the user's stated intent ("on browser
  refresh let's get fresh from server").
- **Single load shape**: "first request" is interpreted as one logical load of the
  whole vault when the vault surface opens (after sign-in or page reload) — not as
  bundling vault data into the sign-in response itself.
- **Scale ceiling**: personal vaults are assumed to stay within a size where a full
  upfront load is practical (hundreds of entries, not tens of thousands); no
  pagination or partial loading is in scope.
- **"Other possibilities" scope**: within this feature, additional performance work is
  limited to load-and-cache behavior described here (single load, no refetch on
  mutations, unlock without re-download, loading-indicator polish). Broader
  optimizations (asset size, server-side tuning, offline support) are out of scope and
  can be separate features.
- **Security posture unchanged**: this feature moves *when* data is fetched, not how
  it is protected — end-to-end encryption, masking, role restrictions, and sign-out
  clearing all continue to apply to the cached data.
