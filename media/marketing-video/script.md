# Vii Pass — Marketing Video Script (9:16, ~60s)

**Feature**: specs/022-marketing-demo-video | **Contract**: contracts/script-scenes.md

One-minute narration script for the Vii Pass marketing demo video. Eight scenes,
sign-in-first, one continuous signed-in session (S2–S7), one framed desktop glimpse
(S8). Total narration: **161 words** (~62s at a natural ~155 wpm). Each scene's
headline is burned in as the caption; `TTS input` is what the voice generator reads
(phonetic override "Vee Pass" for the brand — displayed text is never changed).

## Scene table

| Scene | Headline | Narration | TTS input | On-screen action | Covers |
|-------|----------|-----------|-----------|------------------|--------|
| S1 | Meet Vii Pass | Meet Vii Pass — the password manager that keeps every credential safe, organized, and always within reach. | Meet Vee Pass — the password manager that keeps every credential safe, organized, and always within reach. | Login page with logo and background art; brand beat, no interaction. | product intro |
| S2 | Sign in anywhere | Sign in from any browser with just your username and password — your vault appears instantly, ready wherever you are. | (same) | Type `viidemo` + password, tap Sign in, vault appears. | username sign-in |
| S3 | Organize your vault | Organize everything into color-coded sections. Switch tabs and your cards re-theme instantly — and you can reorder them any way you like. | (same) | Switch between Work / Personal / Mine tabs; cards re-theme per section color. | sections; color-coded cards; reorderable organization |
| S4 | Everything in one place | Each entry holds a title, a quick link, and typed fields — usernames, emails, passwords — everything exactly where you expect it. | (same) | Focus an entry card: title link, typed field rows with icons. | entries with titles/links/typed fields |
| S5 | Reveal & copy safely | Passwords stay masked until you need them. Reveal with a tap, copy in one touch — no typing, no mistakes. | (same) | Tap the eye on the one sanctioned fake password (`Fake!Pass1`), then tap copy. | masking; reveal; copy |
| S6 | End-to-end encrypted | Security is built in. Everything is encrypted on your device before it ever leaves, your password never leaves your device, plus a second layer of encryption at rest. | (same) | Open New entry, fill it, tap Save — the encrypted save moment. | E2E encryption; server-side layer; password never leaves device |
| S7 | Your vault, your rules | Make it yours: light, dark, or automatic themes. Share a view-only login for safe access, and reset your password without losing your vault. | (same) | Open user menu, switch theme dark then light (montage). | themes; dual usernames/view-only identity; security-question reset |
| S8 | On every device | From phone to desktop, Vii Pass works beautifully on every device. Try Vii Pass today. | From phone to desktop, Vee Pass works beautifully on every device. Try Vee Pass today. | Desktop layout framed inside the portrait canvas; logo end-card. | responsive/mobile-friendly; cross-device |

## Word-count budget (contract rule 3)

| Scene | Words |
|-------|-------|
| S1 | 16 |
| S2 | 19 |
| S3 | 21 |
| S4 | 20 |
| S5 | 19 |
| S6 | 28 |
| S7 | 23 |
| S8 | 15 |
| **Total** | **161** (150–165 ✓; every scene 8–35 ✓) |

## Coverage map (contract rule 1 — union of Covers == FR-002 inventory)

| FR-002 item | Scene |
|-------------|-------|
| Dual-username registration / view-only identity | S7 |
| Username sign-in | S2 |
| Color-coded sections | S3 |
| Reorderable cards/organization | S3 |
| Entries with titles, links, typed fields | S4 |
| Masking / reveal / copy | S5 |
| End-to-end encryption (device-side) | S6 |
| Server-side encryption layer | S6 |
| Password never leaves the device | S6 |
| Security-question reset preserving the vault | S7 |
| Themes (light/dark/auto) | S7 |
| Responsive / mobile-friendly / cross-device | S8 |

## Truthfulness check (contract rule 7)

All security claims use the allowed phrasings verbatim ("encrypted on your device
before it ever leaves", "your password never leaves your device", "a second layer of
encryption at rest", "reset your password without losing your vault", "a view-only
login for safe access"). No disallowed claims ("unhackable", absolute
"zero-knowledge", audits, cross-device sync) appear. "Ready wherever you are" /
"works beautifully on every device" = access-from-any-browser claims, not sync claims.
