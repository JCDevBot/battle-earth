# ADR 0001: Renderer boundaries during stabilization

- Status: Accepted
- Date: 2026-07-16

## Context

Battle Earth describes a continuous, scale-aware digital Earth, but the current implementation uses different rendering approaches at different stages:

- Three.js renders the globe.
- SVG renders the strategic campaign stage.
- Three.js renders tactical battlefields and gameplay systems.

Previous notes sometimes described the strategic Three.js migration as complete even though `CampaignStage.jsx` remains an SVG implementation. That documentation drift made the actual architecture unclear.

## Decision

Retain the SVG strategic campaign renderer during repository stabilization.

Treat it as a transitional, lightweight strategic view rather than claiming that all scales currently share one renderer. The globe and tactical stages remain the authoritative Three.js implementations.

Do not remove the SVG campaign renderer until parity requirements and performance targets are documented and validated.

## Consequences

### Positive

- Stabilization work can proceed without a high-risk visual rewrite.
- Current campaign interactions remain intact.
- The repository accurately describes its implementation.
- A future migration can be evaluated against explicit parity requirements.

### Negative

- Strategic and tactical rendering continue to duplicate some concepts.
- Ownership overlays, labels, camera behavior, and geographic projection may diverge.
- The codebase carries two rendering models until a later decision.

## Follow-up

The renderer convergence phase in `ROADMAP.md` must define parity requirements and then choose one of two outcomes:

1. Move strategic rendering into the shared Three.js world pipeline.
2. Formally support SVG as a separate optimized strategic renderer.
