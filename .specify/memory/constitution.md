<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- TEMPLATE -> I. Product Specs Are Authoritative
- TEMPLATE -> II. Shared Editor Architecture First
- TEMPLATE -> III. Mode Behavior Is Contractual
- TEMPLATE -> IV. Tests Guard Editor Behavior
- TEMPLATE -> V. Local Data and Change History Discipline
Added sections:
- Project Constraints
- Development Workflow
Removed sections:
- None
Templates requiring updates:
- updated: .specify/templates/plan-template.md
- updated: .specify/templates/spec-template.md
- updated: .specify/templates/tasks-template.md
Follow-up TODOs:
- None
-->
# Chainsaw Aliens Constitution

## Core Principles

### I. Product Specs Are Authoritative

Editor UI work MUST treat `UISpec.md` as the canonical product specification.
Shell, layout, spacing, typography, token, and surface behavior MUST follow
`ui/EDITORS_UI_CONTRACT.md`. Feature specs, plans, tasks, and code changes MUST
call out any intended divergence before implementation. This keeps editor work
anchored to the agreed product behavior instead of local interpretation.

### II. Shared Editor Architecture First

Editor mode layout decisions MUST use the shared landscape and gamepad helpers
in `src/ui/shared/editorMenuLayout.js` before adding editor-specific branches.
New menu behavior MUST prefer shared menu specs, shared input semantics, and
shared UI helpers over editor-specific UI code. Editor-specific code is allowed
only when the shared model cannot express a real workflow need, and the plan
MUST document why the shared path is insufficient.

### III. Mode Behavior Is Contractual

Portrait editor behavior MUST be preserved unless a feature explicitly requests
a portrait change. Landscape touch, desktop, and gamepad behavior MUST be treated
as first-class modes with their required and suppressed surfaces defined by the
shared contracts. Features that affect editor UI MUST specify mode impact for
portrait, landscape touch, desktop, and gamepad, including any intentional
unchanged modes. This prevents accidental regressions across input and viewport
modes.

### IV. Tests Guard Editor Behavior

Editor UI changes MUST include focused validation for the behavior they affect.
Plans and tasks MUST identify relevant unit, layout, gesture, controller, or
manual visual checks. Existing portrait tests MUST remain stable unless a
portrait change is explicitly in scope. Shared helpers, menu specs, or mode
contracts require broader tests because their blast radius spans multiple
editors.

### V. Local Data and Change History Discipline

Generated or local storage churn under `data/server-storage/` MUST NOT be
blanket-staged or treated as product source without explicit user intent. When
updating `src/ui/latestChanges.js`, entries MUST include both `date` and `time`
so the Latest Changes dialog retains timestamped history. This keeps commits
reviewable and preserves user-visible work history.

## Project Constraints

Chainsaw Aliens is a static, browser-only 2D metroidvania prototype. Plans MUST
preserve direct browser execution through `index.html` unless a feature
explicitly changes the runtime model. Dependencies, build steps, servers, and
frameworks MUST be justified by a current feature need rather than convenience.

Editor work MUST respect the named editor set in `UISpec.md`: Pixel, Tile,
Level, Actor, MIDI, SFX, Cutscene, Race, and Car. Changes to shared editor
behavior MUST consider all affected editors, even when implementation starts in
one editor.

## Development Workflow

Feature specifications MUST describe user-visible behavior and mode impact
before implementation details. Plans MUST include a Constitution Check that
maps the feature to these principles and records any justified exceptions.
Tasks MUST be grouped so each user story can be validated independently, with
test or visual-check tasks placed before implementation when the behavior is
testable.

Implementation MUST avoid unrelated refactors, generated data churn, and
metadata noise. Validation results MUST be reported with any known gaps. If a
principle conflicts with a requested change, the spec or plan MUST make the
tradeoff explicit before code is changed.

## Governance

This constitution supersedes ad hoc project practices for Speckit-generated
specs, plans, tasks, and implementation work. Amendments require a documented
constitution update, a semantic version bump, and synchronization of affected
templates or guidance files.

Versioning policy:
- MAJOR increments redefine or remove principles in a backward-incompatible way.
- MINOR increments add principles, sections, or materially expanded governance.
- PATCH increments clarify wording without changing required behavior.

Compliance review is required during `speckit-plan`, `speckit-tasks`,
`speckit-analyze`, and implementation review. Any unresolved constitution
violation MUST be listed in the plan's Complexity Tracking or equivalent risk
section with a concrete rationale.

**Version**: 1.0.0 | **Ratified**: 2026-07-15 | **Last Amended**: 2026-07-15
