---
version: "alpha"
name: "AI Buddy Companion Dark Modern"
description: "Visual identity, dark-mode aesthetics, and design token specification for the AI Buddy real-time 3D conversational companion application."
colors:
  primary: "#38bdf8"
  primary-muted: "rgba(56, 189, 248, 0.15)"
  secondary: "#8b5cf6"
  secondary-muted: "rgba(139, 92, 246, 0.15)"
  secondary-dark: "#5b21b6"
  accent-listening: "#10b981"
  accent-listening-muted: "rgba(16, 185, 129, 0.15)"
  accent-amber: "#f59e0b"
  accent-amber-muted: "rgba(245, 158, 11, 0.15)"
  danger: "#ef4444"
  danger-dark: "#b91c1c"
  danger-muted: "rgba(239, 68, 68, 0.2)"
  neutral-bg: "#0a0d18"
  surface-dock: "#0f172a"
  surface-card: "#1e293b"
  surface-card-muted: "rgba(30, 41, 59, 0.5)"
  surface-glass: "rgba(15, 23, 42, 0.75)"
  border-subtle: "rgba(255, 255, 255, 0.08)"
  border-medium: "rgba(255, 255, 255, 0.12)"
  text-primary: "#f8fafc"
  text-secondary: "#94a3b8"
  text-muted: "#8492a6"
  text-dim: "#475569"
  text-inverse: "#0a0d18"
  brand-indigo: "#4338ca"
typography:
  headline-display:
    fontFamily: System
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: System
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0.02em
  headline-md:
    fontFamily: System
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
  headline-sm:
    fontFamily: System
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.35
  body-lg:
    fontFamily: System
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: System
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: System
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label-lg:
    fontFamily: System
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
  label-md:
    fontFamily: System
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
  label-sm:
    fontFamily: System
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.25
  label-caps:
    fontFamily: System
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.05em
  mono-timer:
    fontFamily: Courier
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.2
  mono-debug:
    fontFamily: Courier
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
spacing:
  2xs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 20px
  3xl: 24px
  4xl: 32px
rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 14px
  xl: 16px
  2xl: 20px
  3xl: 24px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.secondary-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    height: "52px"
    padding: "{spacing.xl}"
  button-danger:
    backgroundColor: "{colors.danger-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "{spacing.lg}"
  button-control-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "{spacing.lg}"
  button-control-active:
    backgroundColor: "{colors.danger-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "{spacing.lg}"
  button-mode-pill:
    backgroundColor: "{colors.brand-indigo}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  badge-status-ready:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.primary}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.sm}"
  badge-status-listening:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.accent-listening}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.sm}"
  badge-status-speaking:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.sm}"
  badge-status-connecting:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.accent-amber}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.sm}"
  badge-pill-popular:
    backgroundColor: "{colors.brand-indigo}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.2xs}"
  badge-pill-bestvalue:
    backgroundColor: "{colors.secondary-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.2xs}"
  badge-highlight-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  badge-upgrade-banner:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.xs}"
  card-plan-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  card-plan-active:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  card-topup:
    backgroundColor: "{colors.surface-card-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  tag-topup-price:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  hud-viseme-overlay:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.sm}"
  controls-dock:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.3xl}"
    padding: "{spacing.xl}"
  timer-bar:
    backgroundColor: "{colors.surface-card-muted}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  text-label-muted:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.none}"
    padding: "{spacing.xs}"
  text-legal-dim:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.none}"
    padding: "{spacing.2xs}"
  header-bar:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "{spacing.lg}"
  panel-listening-glow:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.accent-listening}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  panel-amber-alert:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.accent-amber}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  border-highlight:
    backgroundColor: "{colors.border-medium}"
    rounded: "{rounded.md}"
    padding: "{spacing.2xs}"
  border-subtle-divider:
    backgroundColor: "{colors.border-subtle}"
    rounded: "{rounded.none}"
    padding: "{spacing.2xs}"
  pill-danger-tag:
    backgroundColor: "{colors.surface-dock}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  badge-glow-listening:
    backgroundColor: "{colors.accent-listening-muted}"
    rounded: "{rounded.full}"
    padding: "{spacing.2xs}"
  badge-glow-amber:
    backgroundColor: "{colors.accent-amber-muted}"
    rounded: "{rounded.full}"
    padding: "{spacing.2xs}"
  badge-glow-secondary:
    backgroundColor: "{colors.secondary-muted}"
    rounded: "{rounded.full}"
    padding: "{spacing.2xs}"
  badge-glow-primary:
    backgroundColor: "{colors.primary-muted}"
    rounded: "{rounded.full}"
    padding: "{spacing.2xs}"
  badge-glow-danger:
    backgroundColor: "{colors.danger-muted}"
    rounded: "{rounded.full}"
    padding: "{spacing.2xs}"
  meta-dim-tag:
    backgroundColor: "{colors.text-dim}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xs}"
    padding: "{spacing.2xs}"
---

## Overview

**AI Buddy** ("Echo") is an intelligent, real-time conversational 3D avatar companion application. The visual identity unites **Atmospheric Sci-Fi Aesthetics**, **Deep Obsidian Minimalism**, and **Tactile Audio-Visual Feedback**.

The design language is engineered specifically for hands-free voice interaction:
- The user's focus is drawn directly to the lifelike, responsive 3D character whose facial blendshapes move dynamically with OpenAI Realtime audio streams.
- The user interface frames the 3D canvas with non-intrusive, elevated glassmorphism HUD overlays that provide immediate visual feedback regarding connection status, listening/speaking state, remaining session time, and audio controls.
- Color, light, and motion signal conversational state changes without requiring the user to read dense text.

## Colors

The color palette is anchored in deep, immersive dark tones with vibrant neon accents that communicate speech telemetry and cognitive status.

- **Primary (#38bdf8):** Electric Sky Blue. Serves as the primary indicator of audio resonance, real-time telemetry, and technical metrics (active morph target, session timer).
- **Secondary (#8b5cf6 / #5b21b6):** Radiant Violet. Represents Echo's cognitive voice persona, speaking state, and premium subscriber entitlements.
- **Accent Listening (#10b981):** Emerald Green. Signifies active microphone intake, successful room connection, and bidirectional audio streaming.
- **Accent Amber (#f59e0b):** Warm Amber. Used for transition states, connection negotiations, and low remaining session time warnings.
- **Danger (#ef4444 / #b91c1c):** Crimson Red. Dedicated to session termination, mute overrides, and disconnecting from active calls.
- **Neutral Background (#0a0d18):** Deep Obsidian Space. The base canvas color creating an infinite depth backdrop for 3D avatar illumination.
- **Surfaces & Overlays:**
  - `surface-dock (#0f172a)`: High-elevation control panel docked at the bottom of the screen.
  - `surface-card (#1e293b)`: Opaque container for modal cards and pricing tiers.
  - `surface-glass (rgba(15, 23, 42, 0.75))`: Frosted blur layer for non-distracting telemetry overlays over the 3D scene.

## Typography

Typography establishes an intuitive balance between human empathy and computational precision.

- **Display & Headlines:** Set in System Bold/Extra-Bold with subtle negative letter spacing for authoritative, clean branding ("Echo", "Unlock Unlimited Echo").
- **Body:** System Regular at 13px–16px provides comfortable reading for subscription perks, legal disclosures, and companion tips.
- **Technical Telemetry & Metrics:** Monospace (`Courier` / `SF Mono`) is reserved strictly for real-time computational data, specifically the countdown timer and active Oculus viseme target (`viseme_AA`, `viseme_O`, etc.).
- **Labels & Microcopy:** High-contrast semi-bold and uppercase caps for status badges and pricing tags.

## Layout

The mobile layout adheres to a **Vertical Stage & Dock** pattern optimized for one-handed portrait orientation on iOS and Android:

- **Top Navigation & Telemetry Bar:** Houses the companion identity, dynamic status pill badge, and the real-time session duration countdown bar.
- **Central 3D Viewport:** A full-bleed, touch-enabled React Three Fiber canvas occupying the dominant vertical space, framed with safe area insets.
- **Floating HUD Overlay:** Lightweight, semi-transparent pill anchored at the bottom of the 3D canvas displaying active blendshape telemetry without obstructing the avatar face.
- **Elevated Controls Dock:** Bottom sheet container with generous corner radii housing conversational simulation toggles, audio mute controls, and call termination.
- **Consistent Rhythm:** Spacing follows a modular scale based on 4px increments, ranging from `2xs` (2px) for micro-borders to `4xl` (32px) for hero section separation.

## Elevation & Depth

Visual hierarchy is communicated through **Layered Luminance & Glassmorphism** rather than traditional heavy drop shadows:

- **Layer 0 (Canvas Base):** Infinite `#0a0d18` background illuminated exclusively by Three.js directional and ambient scene lights.
- **Layer 1 (Telemetry HUD):** Frosted background (`surface-glass`) floating over the canvas with a 1px subtle border (`border-subtle`).
- **Layer 2 (Interactive Controls Dock):** Elevated solid surface (`surface-dock`) featuring a top border highlight (`border-subtle`) and prominent top border radii (`24px`).
- **Layer 3 (Modals & Sheets):** Full-screen slide presentation for paywalls, subscription tier comparisons, and account settings.

## Shapes

Shapes reflect an approachable, ergonomic aesthetic designed to feel soft yet precise:

- **Capsules & Pills (`full` / 9999px):** Utilized for dynamic status indicators, session warning badges, and action pills to invite touch.
- **Generous Containers (`24px`):** Used for the bottom docked control bar to create a card-like cradle for thumb interactions.
- **Standard Action Elements (`12px` - `16px`):** Used for action buttons, plan cards, and consumable purchase tiles.
- **Hairline Borders (1px):** Applied to cards and badges with low-opacity white (`rgba(255, 255, 255, 0.08)` to `0.15)`) to maintain contrast without harsh demarcations.

## Components

The design system standardizes the following component atoms and molecules across the companion interface:

- **Action Buttons (`button-primary`, `button-danger`, `button-control-secondary`):** Full-width and half-width interactive elements with tactile feedback, minimum 48px tap targets, and distinct resting and pressed states.
- **State Badges (`badge-status-ready`, `badge-status-listening`, `badge-status-speaking`, `badge-status-connecting`):** Pill-shaped indicators containing a pulsating colored dot and uppercase state label indicating WebRTC and agent activity.
- **Session Timer Pill (`timer-bar`, `mono-timer`):** Live countdown display indicating remaining conversation allowance before the circuit breaker engages.
- **Telemetry HUD (`hud-viseme-overlay`):** Glassmorphic overlay dynamically tracking Oculus viseme blendshapes in real time.
- **Subscription Cards (`card-plan-default`, `card-plan-active`, `card-topup`):** High-converting pricing containers with glowing border states, feature lists, and instant App Store purchase triggers.

## Do's and Don'ts

### Do's
- **Do** prioritize the 3D avatar canvas as the primary focal element of the companion screen.
- **Do** use color cues consistently: emerald for listening, violet for speaking, amber for connecting/warning, and crimson for disconnect.
- **Do** render technical telemetry (timers, viseme morph targets, bitrates) in monospace typography.
- **Do** preserve full WCAG AA contrast (minimum 4.5:1) for all primary body text, titles, and button labels against their dark backgrounds.
- **Do** keep bottom controls reachable within comfortable one-handed thumb range.

### Don'ts
- **Don't** use pure white (`#ffffff`) as a screen background; the app strictly adheres to an immersive dark luxury palette (`#0a0d18`).
- **Don't** mix square sharp corners with rounded pill aesthetics on interactive buttons.
- **Don't** hide the active status badge while an active voice call is in progress.
- **Don't** clutter the 3D canvas viewport with opaque cards or persistent debug windows in production builds.
- **Don't** trigger modal paywalls during active speaking turns unless the session limit has expired.
