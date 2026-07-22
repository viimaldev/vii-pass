# Feature Specification: End-to-End Marketing Demo Video

**Feature Branch**: `topic/vii-1026-marketing-demo-video`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "The project development is completely ready now. I am planning to release this directly to end users. I would like to sale this application with wonderful marketing. I want you to prepare an end-to-end marketing video for this with logging in and navigating to all the features by explaining. I want you to do the following: (1) Prepare the content for a minute which should cover all the features and security and demo, (2) Make an AI generated voice for that, (3) Create a video with created audio to visualize all the points."

## Clarifications

### Session 2026-07-22

- Q: The video aspect ratio is 9:16 portrait (user directive) — how should the app be shown in the portrait frame? → A: Mix — the walkthrough is recorded in the app's responsive mobile/narrow layout (fills the portrait frame natively), with one brief framed desktop glimpse to show the product works everywhere.
- Q: Should the video include burned-in captions/on-screen text for the narration (portrait social video is mostly watched muted)? → A: Minimal — only key headline words per scene (e.g., "End-to-end encrypted"), not full narration captions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Minute Marketing Script (Priority: P1)

As the product owner preparing to launch Vii Pass to end users, I need a polished,
approximately one-minute narration script that covers every user-facing feature of the
application, highlights its security story, and follows a demo-friendly order (sign in
first, then navigate through the features), so it can serve as the single source of
truth for the voiceover and the video's visual sequence.

**Why this priority**: The script is the foundation of the entire deliverable — the
voiceover is recorded from it and the video visuals are sequenced to it. It is also
independently valuable: even without audio or video, the script doubles as marketing
copy (website, app store listing, launch post).

**Independent Test**: Read the script aloud at a natural marketing-narration pace and
time it: it must land in the target duration window and mention every feature in the
coverage checklist (see FR-002) in a demo-navigable order.

**Acceptance Scenarios**:

1. **Given** the finished script, **When** it is read aloud at a natural pace, **Then** the total duration is approximately one minute (within the 50–70 second window).
2. **Given** the finished script, **When** its content is checked against the product's feature inventory, **Then** every item in the feature coverage checklist (FR-002) is mentioned or visually cued at least once.
3. **Given** the finished script, **When** its narrative order is reviewed, **Then** it opens with signing in and proceeds through features in an order that can be mirrored by on-screen navigation in a single continuous demo session.
4. **Given** the finished script, **When** reviewed for accuracy, **Then** it makes no claims the product cannot deliver (no invented features, no overstated security promises).

---

### User Story 2 - AI-Generated Voiceover (Priority: P2)

As the product owner, I need the approved script converted into a clear, natural-sounding
AI-generated voiceover audio file, so the video has professional narration without hiring
a voice artist.

**Why this priority**: The voiceover depends on the script (P1) but is required before
the video can be assembled with synchronized narration. On its own it is still valuable
as launch audio (podcast ad, audio teaser).

**Independent Test**: Play the audio file end to end: it must speak the full approved
script verbatim, be clearly intelligible, and match the script's target duration.

**Acceptance Scenarios**:

1. **Given** the approved script, **When** the AI voiceover is generated, **Then** the audio contains the complete script with no missing, repeated, or garbled sentences.
2. **Given** the generated audio, **When** played on ordinary consumer speakers or headphones, **Then** the speech is clearly intelligible at normal volume with no distracting artifacts (clipping, robotic stutter, abrupt cutoffs).
3. **Given** the generated audio, **When** its duration is measured, **Then** it fits the 50–70 second target window.

---

### User Story 3 - Assembled Marketing Video (Priority: P3)

As the product owner, I need a finished 9:16 portrait marketing video that pairs the
voiceover with on-screen visuals of the real application — starting with a sign-in and
then navigating through each feature as the narration describes it, shown primarily in
the app's mobile layout with one brief desktop glimpse — so prospective end users can
see and hear the product's value in one minute.

**Why this priority**: This is the final deliverable, but it depends on both the script
(P1) and the audio (P2). It delivers the complete end-to-end marketing asset requested.

**Independent Test**: Watch the final video: every narrated claim must be visually
demonstrated on screen at (or near) the moment it is spoken, using demo data only, and
the video must be playable in common players/platforms.

**Acceptance Scenarios**:

1. **Given** the final video, **When** watched end to end, **Then** the visuals open with the sign-in flow and then show each feature area as (or shortly before/after) the narration mentions it.
2. **Given** the final video, **When** any frame is inspected, **Then** no real user credentials, real passwords, personal data, or production secrets are visible — only purpose-made demo data.
3. **Given** the final video, **When** played on common video platforms/players, **Then** audio and visuals are synchronized (no drift greater than one second) and the total runtime is within the 50–70 second window.
4. **Given** the final video, **When** reviewed for presentation quality, **Then** the app is shown in a clean state (no error banners, no developer tooling, no browser clutter) at a resolution where on-screen text is readable.

---

### Edge Cases

- What happens if the full feature list cannot be narrated within one minute? The script prioritizes the security story and the core vault workflow; lower-impact polish features (e.g., micro-animations) may be shown visually without dedicated narration, but every checklist item must still appear on screen or in narration.
- What happens if a revealed password would appear on screen during the demo? Only demo credentials created solely for the recording may ever be revealed; the demo vault must contain no real secrets.
- What happens if the AI voice mispronounces the product name or a feature term? The audio is regenerated (with pronunciation guidance) until the product name is spoken correctly — a mispronounced brand name is a rejection criterion.
- What happens if narration and visuals drift out of sync during assembly? The video is re-timed; sync drift beyond one second at any narrated feature moment fails acceptance.
- What happens on platforms that autoplay muted? The burned-in headline captions (FR-011) plus visually self-explanatory feature moments carry the message when there is no audio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deliverable MUST include a narration script whose spoken duration at a natural pace is approximately one minute (50–70 seconds).
- **FR-002**: The script and video MUST together cover the full feature inventory of the application: account registration with dual usernames (full-access and view-only identities), signing in with a username, the vault of color-coded sections with reorderable credential cards, credential entries with titles, links, and typed fields, masking with reveal and copy for sensitive values, end-to-end encryption (secrets encrypted on the user's device; the password never leaves it) with an additional server-side encryption layer, security-question password reset that preserves the vault, theme support (auto/dark/light), and a responsive mobile-friendly experience.
- **FR-003**: The script MUST follow a demo-navigable order that begins with signing in and proceeds through features as they would be encountered in a single continuous session of the application.
- **FR-004**: The script MUST contain only truthful, verifiable claims about the product — no invented features and no security promises beyond what the product actually provides.
- **FR-005**: The deliverable MUST include an AI-generated voiceover audio file that speaks the approved script verbatim, is clearly intelligible on consumer audio hardware, and fits the 50–70 second window.
- **FR-006**: The deliverable MUST include a final video file that combines the voiceover with on-screen visuals of the application, where each narrated feature is visually demonstrated at or near the moment it is spoken (sync drift no greater than one second).
- **FR-007**: All on-screen content in the video MUST use purpose-made demo data only; no real user credentials, personal data, production secrets, or internal/developer surfaces (consoles, tooling, error states) may appear in any frame.
- **FR-008**: The video MUST present the application in a clean, presentable state: the walkthrough is captured primarily in the app's responsive mobile/narrow layout so it fills the 9:16 portrait frame natively, with one brief desktop-layout glimpse (framed within the portrait canvas) to show cross-device support; on-screen text MUST be readable at the delivered resolution and free of error banners or loading failures.
- **FR-009**: The final video MUST be delivered in a widely playable format suitable for common marketing channels (websites, social platforms, app listings) without requiring special software.
- **FR-010**: The script, audio, and video MUST be delivered as reviewable assets (script as readable text; audio and video as standalone playable files) so each can be approved or revised independently.
- **FR-011**: The video MUST include minimal burned-in headline captions — a few key words per scene (e.g., "End-to-end encrypted", "Dark & light themes") rather than full narration text — legible against the underlying visuals, so the core message survives muted playback.

### Key Entities

- **Narration Script**: The approved marketing text — one minute of narration segmented into scenes, each scene mapping to an on-screen action or feature; the source of truth for both audio and visual sequencing.
- **Voiceover Audio**: The AI-generated spoken rendition of the script; a standalone audio asset consumed by the video assembly.
- **Demo Recording / Visuals**: Screen-captured footage (or equivalent visual sequences) of the real application performing the scripted walkthrough using demo data.
- **Final Marketing Video**: The assembled deliverable — demo visuals synchronized with the voiceover — the asset actually published to end users.
- **Demo Account & Demo Vault Data**: Purpose-made account(s) and sample credential entries created exclusively for the recording; contain no real secrets and are safe to show on screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The final video's runtime is between 50 and 70 seconds.
- **SC-002**: 100% of the feature coverage checklist (FR-002) is either narrated, shown on screen, or both — verified against a scene-by-scene coverage map.
- **SC-003**: A first-time viewer can name the product, its core purpose (secure password storage), and at least three distinct features after a single viewing.
- **SC-004**: Zero frames of the final video contain real credentials, personal data, or non-demo secrets — verified by a frame-level review pass.
- **SC-005**: Narration-to-visual sync drift never exceeds one second at any narrated feature moment.
- **SC-006**: The video plays correctly (audio + visuals, no re-encoding needed) on at least three common playback surfaces (e.g., a desktop player, a browser, and a mobile device).
- **SC-007**: The script, the audio file, and the video file are each delivered as separately reviewable assets, and each can be revised without redoing the other two from scratch (script edits only force audio regeneration; audio regeneration only forces re-sync of the video).

## Assumptions

- The narration language is English, targeting a general consumer audience.
- One video deliverable is in scope for this feature: a 9:16 portrait cut recorded primarily in the app's responsive mobile/narrow layout, with one brief framed desktop glimpse; a separate landscape/desktop cut is out of scope.
- Standard marketing-video defaults apply: 9:16 portrait, full-HD-class resolution (e.g., 1080×1920), a single widely supported file format, and stereo or mono voiceover audio.
- The demo is recorded against a non-production environment with a purpose-made demo account and sample vault entries; no production data is used.
- A single AI voice (neutral, professional tone) is sufficient; multiple voices, music licensing decisions, and subtitle/localization variants are out of scope for this feature (background music remains an optional enhancement; captions are scoped by FR-011 — minimal headline text only, no full-narration captions).
- The product owner reviews and approves each asset in order (script → audio → video); approval of the script freezes the feature coverage list for the downstream assets.
- Distribution (uploading to specific platforms, ad campaigns, thumbnails, A/B variants) is out of scope; this feature ends at delivering the finished video file.
- The application is feature-complete as of this spec; the feature inventory in FR-002 reflects the currently shipped user-facing capabilities.
