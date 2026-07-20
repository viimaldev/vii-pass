# Contract: Mobile Single-Scroll Vault Layout

**Feature**: specs/019-mobile-scroll-tab-session | **Date**: 2026-07-20
**Consumers**: `frontend/src/styles/tokens.css` (all rules), `Layout.tsx` / `HomePage.tsx`
(class hooks only)

## Behavioral contract

1. **One scroll region on the vault surface.** While signed in on the vault page, the
   ONLY vertical scroller is `.chord-scroll`. The page/body and `.app-main` MUST NOT
   show a vertical scrollbar at any viewport size (320px+, portrait and landscape),
   including while the on-screen keyboard is open.
2. **No white below the content.** At every scroll position and viewport size, the
   visible page ends with app content or the app background — never the raw `body`
   background peeking below the shell.
3. **Auth pages keep their fallback page scroll.** Login/register/reset are exempt: when
   the form exceeds a short viewport, `.app-main`'s existing `overflow-y: auto` still
   page-scrolls them. This contract MUST NOT globally disable page scrolling.
4. **Desktop/tablet unchanged.** The existing flex chain
   (`.app-shell` → `.app-main` → `.vault-page` → `.vault-page__inner` → `.chord-scroll`,
   `min-height: 0` down the chain) and all spacing rules are preserved.

## CSS requirements

| Rule | Requirement |
|---|---|
| `.app-shell` height | `height: 100vh;` immediately followed by `height: 100dvh;` (fallback pattern — older browsers ignore the `dvh` line) |
| Vault-surface page-scroll lock | `.app-main` gets `overflow: hidden` ONLY when hosting the vault page (via `:has(.vault-page)` or an equivalent modifier class — implementation's choice; behavior is the contract) |
| Body background | `body` background remains `var(--color-bg)` (already true) so any transient overrun matches the theme, both themes |
| Overscroll | vault surface SHOULD set `overscroll-behavior-y: none` (or `contain`) on the shell/scroller so iOS rubber-banding doesn't chain to the page |

## Verification matrix (quickstart §2)

| Viewport | Vault state | Expected |
|---|---|---|
| 320×568 portrait | many entries | only `.chord-scroll` scrolls; `document.scrollingElement.scrollHeight === clientHeight` |
| 320×568 portrait | few/no entries | zero scrollbars anywhere; no white band |
| 568×320 landscape | many entries | same single-scroll rule |
| 390×844 with keyboard open (focused input) | any | no page scrollbar appears |
| 768 / 1280 | many entries | unchanged vs. main (regression check) |
| Login page 320×480 | form taller than viewport | page STILL scrolls (exemption holds) |
