# Dialogue Archive
> Implementation-verified dialogue from the GitHub cutscene JSON, plus separately identified conversation drafts. Preserve source wording exactly; don't silently correct typos.

## Tower Hill Road — implemented opening radio
**Scene ID:** `introtowerhill`  
**Source:** [cutscene JSON](https://github.com/radiatedsaturn7/chainsaw-aliens/blob/staging/data/server-storage/files/cutscenes/introtowerhill/document.json)  
**Status:** IMPLEMENTED ON STAGING (verified 2026-11-13)

| Start | Duration | On-screen text |
|---:|---:|---|
| 00:06.523 | 1.800s | `Hey...` |
| 00:09.889 | 2.565s | `Winds shifted...` |
| 00:13.745 | 3.470s | `...Come back while you still can.` |

**Speaker:** Rob, over the radio (story context; text entries themselves do not identify a speaker).

## Garage — implemented follow-up scene
**Scene ID:** `lastongridintro`  
**Source:** [cutscene JSON](https://github.com/radiatedsaturn7/chainsaw-aliens/blob/staging/data/server-storage/files/cutscenes/lastongridintro/document.json)  
**Status:** IMPLEMENTED ON STAGING (verified 2026-11-13)

| Start | Duration | Speaker (from story context) | Exact on-screen text |
|---:|---:|---|---|
| 00:01.433 | 1.800s | Cait | `Got the fuel...` |
| 00:07.861 | 2.514s | Cait | `Weather's getter worse...` |
| 00:12.698 | 1.781s | Rob | `Yeah...` |
| 00:15.325 | 2.004s | Rob | `I know...` |
| 00:18.906 | 2.004s | Cait | `We still heading out tomorrow?` |
| 00:23.237 | 2.510s | Rob | `That's what I promised...` |
| 00:27.825 | 2.510s | Cait | `Right...` |

**Implementation note:** `Weather's getter worse...` is the literal string in the source. Likely intended `getting`, but this archive does not modify game data.

## Earlier conversation draft — not identical to implemented scene
CAIT: “Got the fuel.”

ROB: “Good.”

CAIT: “Weather’s getting worse.”

ROB: “Yeah. I know.”

CAIT: “We still heading out tomorrow?”

ROB: “That’s what I promised.”

CAIT: “Right.”

**Staging concept:** Rob is soldering. He pauses when Cait asks about tomorrow, then resumes. Cait approaches the workbench. Fade.

**Difference to note:** The current implemented garage cutscene does **not** contain Rob's “Good.” and uses different punctuation and timing. The earlier draft is preserved here as a draft, not misrepresented as implemented.

## The Other Scientist — conversation-recovered draft dialogue
The discovery and escape dialogue, including alternate versions, is collected in [the encounter draft](CAMPAIGN/the-other-scientist.md). These are **not implementation-verified** and must not be conflated with the Tower Hill cutscenes.

## Other dialogue fragments — context needed
- “Humans built all this? To serve them?” — Cait, Machine City concept.
- “I've been fixing your car this whole time…” — argument concept; wording and speaker context need verification.

## Archiving rule
Keep exact implemented strings, timing and source paths. Any proposed correction or rewrite belongs in a separate clearly labeled draft. Do not conflate the conversation draft with the deployed cutscene.
