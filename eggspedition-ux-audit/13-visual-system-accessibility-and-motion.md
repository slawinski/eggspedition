# UX-013 — Visual System, Accessibility and Motion Cleanup

**Priority:** P2  
**Primary outcome:** preserve Eggspedition’s distinctive clay character while improving hierarchy, legibility, performance and consistency.

## Problem

The visual language is expressive, but many controls, cards, toggles, rows and navigation states use multiple outer and inset shadows, rounded containers, uppercase microcopy and accent glows. When nearly every element is “raised,” depth no longer explains what is interactive or important. Small uppercase labels and icon-sized controls also reduce usability on mobile.

Global styles contain duplicated dark-theme token definitions and load fonts through CSS `@import`. Motion is spread across component styles, with varied easing and durations.

## Design direction

Do not remove claymorphism. Give it a job.

Use depth to communicate:

- **raised:** primary interactive control;
- **surface:** grouped content/card;
- **pressed/inset:** selected control or input well;
- **flat:** supporting content, metadata and secondary actions;
- **overlay:** dialogs, sheets and menus.

Most content should be flat or lightly surfaced. Reserve strong squish, glow and multilayer shadows for primary actions and selected states.

## Surface tokens

Create semantic tokens instead of component-local shadow recipes:

- `--elevation-flat`
- `--elevation-surface`
- `--elevation-raised`
- `--elevation-pressed`
- `--elevation-overlay`
- `--focus-ring`
- `--border-subtle`
- `--border-strong`

Also centralize:

- spacing scale;
- radius scale;
- control heights;
- typography roles;
- motion durations/easings;
- z-index layers;
- safe-area/nav/header dimensions.

Do not encode a desktop-only larger shadow simply because the viewport is wider. Elevation should represent meaning, not screen size.

## Typography

Define roles:

- Display: landing-page marketing only;
- Page title;
- Section title;
- Body;
- Label;
- Metadata;
- Button.

Guidelines:

- body text should generally remain at least 16 CSS px on mobile inputs to avoid iOS focus zoom;
- navigation labels should target 11–12 px minimum and avoid excessive letter spacing;
- use uppercase sparingly for short category labels, not long actions or instructions;
- permit grocery item names to wrap where truncation would obscure meaning;
- use `font-variant-numeric: tabular-nums` for quantities/timers where helpful.

## Color and contrast

Audit every semantic foreground/background pair in light and dark themes.

Minimum targets:

- normal text: WCAG AA 4.5:1;
- large text: 3:1;
- control boundaries and meaningful icons: 3:1 against adjacent color;
- focus indicator: clearly visible in both themes.

Pastel accents may remain as backgrounds, but pair them with darker semantic text tokens rather than using saturated accent color directly for small text.

Do not communicate category/store/action only through coral/lavender/mint. Retain icons and labels.

## Focus and input states

Every interactive element requires:

- keyboard-visible focus ring via `:focus-visible`;
- hover only where hover exists;
- pressed/selected state distinct from hover;
- disabled state with sufficient legibility;
- pending state that does not shift layout;
- error state with text, not red border alone.

Normalize buttons and icon buttons through reusable classes/components. Avoid ad hoc `outline: none` unless a replacement ring is always applied.

## Motion system

Define durations:

- immediate feedback: 80–120 ms;
- control transition: 150–200 ms;
- row insert/remove: 180–240 ms;
- sheet/dialog: 220–300 ms;
- celebratory motion: up to 450 ms, rare.

Define a small easing set. Remove rotations and bounce from routine destructive actions unless user testing demonstrates value.

Under `prefers-reduced-motion: reduce`:

- no spinning decorative sync icon;
- no scale/rotate squish;
- no animated progress countdowns;
- preserve state change through opacity/color/text without transition dependency;
- do not disable essential progress indication.

## Background and decorative effects

The global gradients/grid and fixed pseudo-elements should be evaluated on low-end mobile devices.

- Reduce or remove decorative layers behind dense application screens.
- Keep richer marketing treatment on the landing page.
- Avoid fixed full-screen paint-heavy overlays where a static background suffices.
- Verify dark-mode banding and contrast.
- Ensure `backdrop-filter` has a readable fallback.

## Font loading

Replace CSS `@import` with document-level `<link>` tags or self-hosted/subset assets according to licensing and project policy.

- preconnect only when using a remote provider;
- request only used weights;
- use `font-display: swap`;
- measure layout shift;
- retain a strong system fallback stack.

## Theme architecture

- define base tokens once;
- define explicit `[data-theme="dark"]` overrides once;
- use `prefers-color-scheme` only to choose the initial theme when no user preference exists;
- avoid duplicate dark token blocks that can drift;
- set `color-scheme: light dark` appropriately for native controls;
- preserve theme across logout.

## Accessibility audit scope

Audit with automated tools and manual testing:

- landmark structure and heading order;
- skip link target on every route;
- dialog/menu focus trapping and restoration;
- accessible names for icon buttons;
- duplicate IDs;
- 200% browser zoom and 400% narrow reflow;
- keyboard-only operation;
- VoiceOver on iOS/Safari and NVDA or VoiceOver desktop;
- minimum targets and target spacing;
- status/live-region noise;
- forced-colors/high-contrast behavior where feasible.

## Engineering plan

- create a small Storybook-like internal `/dev/ui` route only in development, or component test fixtures, showing every control state;
- refactor repeated shadow/button/input styles into semantic primitives while keeping CSS Modules;
- add Stylelint rules for prohibited raw z-index/elevation patterns if useful;
- add axe checks to core route tests;
- use visual regression snapshots for light/dark and reduced-motion states;
- profile paint/composite cost before and after shadow/background reduction.

## Acceptance criteria

- Elevation recipes map to semantic roles and are not independently reinvented in core components.
- All core text/control pairs meet AA contrast.
- Inputs use at least 16 px text on mobile and do not trigger iOS focus zoom.
- All interactive controls have visible `:focus-visible` states.
- Reduced-motion mode removes nonessential transforms/spins while preserving feedback.
- Dark theme has one maintainable override source.
- Landing page may remain visually rich; authenticated task screens are calmer and more legible.
- Core screens remain usable at 200% zoom without clipped actions or horizontal page scrolling.

## Tests and validation

- axe scans for landing, login, list, add dialog, activity and settings;
- manual keyboard scripts;
- light/dark contrast report;
- iOS input-focus test;
- reduced-motion screenshot suite;
- 320 px and 400% reflow checks;
- Lighthouse/Performance trace focused on paint cost and font loading.

## Non-goals

- Replacing CSS Modules with a utility framework.
- Removing the clay identity.
- A complete rebrand or new product name.
