# HPIB-S — Sensation catalogue (v0.1, draft)

**English** · [Português (Brasil)](SENSATION-CATALOG.pt-BR.md)

Part of the [Sensation Challenge](README.md). Each entry names a **perceptual target** (what a person should feel, in plain words), the **event** that triggers it, the **minimum capability** it needs, and the **human test** that judges it. Entries are proposals to be criticised and calibrated in a pilot.

## How to read an entry

| Field | Meaning |
|---|---|
| ID | `S-<level><nn>`, stable across versions |
| Perceptual target | What the rater should recognise, not how to build it |
| Event | The simulation event that triggers it (see the [task events](../tasks/terrain-feedback/task.yaml)) |
| Needs | Capability from the [capability list](../docs/en/HARDWARE-COMPATIBILITY.md): `rumble`, `adaptive_triggers`, `imu`, `touchpad`, `trackpad_haptics` |
| Test | `H-ID` blind identification, `C1`–`C7` criteria and claim verdict, from [HUMAN-EVALUATION](../docs/en/HUMAN-EVALUATION.md) |

## Level 1 — Surfaces

Stable surface ids as in the task: `asphalt`, `grass`, `sand`, `gravel`, `metal`.

| ID | Sensation | Perceptual target | Event | Needs | Test |
|---|---|---|---|---|---|
| S-101 | Asphalt | Firm, fine, steady and low in intensity | `surface_entered` | rumble | H-ID, C2 |
| S-102 | Grass | Soft and damped, slightly irregular | `surface_entered` | rumble | H-ID, C2 |
| S-103 | Sand | Fine and granular, with a dragging feel | `surface_entered` | rumble | H-ID, C2 |
| S-104 | Gravel | Coarse and rough, with separate small hits | `surface_entered` | rumble | H-ID, C2 |
| S-105 | Metal | Hard and bright, higher in character | `surface_entered` | rumble | H-ID, C2 |

## Level 2 — Impacts and one-off events

| ID | Sensation | Perceptual target | Event | Needs | Test |
|---|---|---|---|---|---|
| S-201 | Light bump | Short and soft, clearly weaker than a crash | `collision` (low) | rumble | Claim, C1 |
| S-202 | Heavy collision | One strong impulse that fades quickly | `collision` (high) | rumble | Claim, C1 |
| S-203 | Pickup / reward | Short, bright and pleasant, scaled by value | pickup | rumble | Claim, C1, C5 |
| S-204 | Rumble strip | Regular repeated pulses whose rate follows speed | `surface_entered` | rumble | Claim, C1 |
| S-205 | Landing | A single impact after a moment of nothing | `surface_entered` after airtime | rumble | Claim, C1 |
| S-206 | Sudden stop | A short pulse that ends the ongoing sensation | `vehicle_stopped` | rumble | Claim, C1 |

## Level 3 — Continuous states

| ID | Sensation | Perceptual target | Event | Needs | Test |
|---|---|---|---|---|---|
| S-301 | Engine | Rises smoothly with speed, no sudden jumps | `speed_changed` | rumble | C4, C5 |
| S-302 | Loss of grip | A change of character the player reads as slipping | slip state | rumble | C1, C4 |
| S-303 | Wet road | Subtle, finer texture on top of the surface | weather state | rumble | C4, C5 |
| S-304 | Brake pressure | Resistance that grows as the brake is pressed | brake input | adaptive_triggers | C1, C4 |
| S-305 | High speed | Light steady buzz that grows with speed without tiring | `speed_changed` | rumble | C4, C5 |

## Level 4 — Narrative cues

| ID | Sensation | Perceptual target | Event | Needs | Test |
|---|---|---|---|---|---|
| S-401 | Danger approaching | Urgency that rises as the danger gets closer | hazard distance | rumble | C1 |
| S-402 | Success | Short rising pattern, satisfying and not startling | round won | rumble | C1, C5 |
| S-403 | Warning pulse | Clear, repeated and still comfortable over a whole session | low-resource state | rumble | C1, C5 |
| S-404 | Calm | Nearly nothing, so that other cues stand out | idle | rumble | C4 |

## Level 5 — Portability

| ID | Sensation | Perceptual target | Needs | Test |
|---|---|---|---|---|
| S-501 | Same sensations on a second device class | S-101 to S-203 are still recognisable on another controller, even if reduced | the second device's own capabilities | H-ID, claim |

## Safety notes

- Keep every pattern within documented actuator limits and interruptible at any time.
- S-403 and S-401 repeat on purpose. Keep them comfortable over a whole session and let raters flag discomfort (C5, `discomfort_flag`).
- Never rely on a sensation alone to convey safety-relevant information; offer an equivalent visual or audio cue.
