# Contract: Script Scenes — narration ↔ visual ↔ caption mapping

**Feature**: 022-marketing-demo-video | **Consumers**: `script.md` (authoring),
`generate-voiceover.mjs`, `record-demo.mjs`, `assemble-video.mjs`, reviewer

This contract fixes the scene structure the three pipeline stages share. The exact
narration wording is authored in `media/marketing-video/script.md` during
implementation and may be tuned for duration — but scene ids, order, coverage
obligations, layouts, and caption slots below are binding.

## Scene sequence (binding)

| # | Scene id | Layout | Headline caption (≤5 words, final wording may be tuned) | On-screen action | FR-002 coverage tags |
|---|----------|--------|----------------------------------------------------------|------------------|----------------------|
| 1 | S1 | mobile | "Meet Vii Pass" | Login page with logo + background art; brand beat | product intro |
| 2 | S2 | mobile | "Sign in anywhere" | Type demo username + password, sign in, vault appears | username sign-in |
| 3 | S3 | mobile | "Organize your vault" | Switch between color-coded section tabs; cards re-theme instantly | sections, color-coded cards, reorderable organization |
| 4 | S4 | mobile | "Everything in one place" | Open an entry card: title link, typed fields with icons | entries with titles/links/typed fields |
| 5 | S5 | mobile | "Reveal & copy safely" | Tap eye to reveal the one sanctioned fake password; tap copy | masking, reveal, copy |
| 6 | S6 | mobile | "End-to-end encrypted" | Stylized moment: entry saves; caption carries the security claim (narration explains device-side encryption + server layer + password-never-leaves) | E2E encryption, server-side layer, password never leaves device |
| 7 | S7 | mobile | "Your vault, your rules" | Fast montage: theme switch dark/light via user menu; (narration mentions view-only identity + security-question reset that preserves the vault) | themes, dual usernames/view-only identity, security-question reset |
| 8 | S8 | desktop-glimpse | "On every device" | Desktop layout framed inside portrait canvas; end-card with logo + tagline | responsive/mobile-friendly, cross-device |

## Binding rules

1. **Coverage completeness**: the union of coverage tags above equals the FR-002
   inventory. If a scene is cut, its tags MUST move to another scene before the script
   is approved (SC-002 gate).
2. **Single continuous session**: S2–S7 are one signed-in session in scene order —
   recording MUST NOT require out-of-order navigation (FR-003).
3. **Narration budget**: total words 150–165; no scene's narration under 8 or over 35
   words. Measured (ffprobe) full-track duration MUST land in 50–70s (SC-001) before
   the script is approved.
4. **Sync unit = scene**: assembly sizes clip *n* to per-scene audio *n* (trim or
   hold-last-frame). Drift within a scene is bounded by the scene length (max ~10s),
   and scene boundaries re-anchor to zero — satisfying the ≤1s budget at every
   narrated *feature moment* because each feature is narrated in the scene that shows
   it (SC-005).
5. **Reveal discipline**: exactly one password reveal on camera (S5), value
   fake-by-construction (FR-007). No other sensitive value may be unmasked in any
   scene.
6. **Caption slot**: every scene has exactly one headline; burned in as white text on
   a semi-opaque dark pill, safe-area-inset from edges (platform UI overlays),
   present for the full scene duration (FR-011).
7. **Truthfulness**: narration claims are limited to shipped behavior (FR-004).
   Specifically allowed: "encrypted on your device before it ever leaves",
   "your password never leaves your device", "a second layer of encryption at rest",
   "reset your password without losing your vault", "a view-only login for shared
   access". Disallowed: "unhackable", "zero-knowledge" as an absolute, audits or
   certifications that don't exist, cross-device *sync* claims beyond "access from
   any browser".
8. **Desktop glimpse**: exactly one scene (S8), desktop capture framed inside the
   9:16 canvas (scaled to width on a branded background band) — never full-canvas
   letterboxed footage (clarification #1).
