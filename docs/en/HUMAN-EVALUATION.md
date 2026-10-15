# HPIB — Human evaluation protocol (v0.2, proposal)

Human evaluation measures the **experience** (level V4). It happens after technical tests and before consolidation. Panel sizes, durations and thresholds are provisional and will be calibrated in the pilot.

## 1. Design

| Element | Proposal |
|---|---|
| Panel | ≥ 5 raters, all rating every build |
| Order | Balanced across raters (Latin square or equivalent) |
| Repetitions | 2 per scenario |
| Reference builds | R0 no haptics · R1 constant vibration · R2 hand-built reference implementation, mixed in with the tested builds |
| Session | Regular breaks; maximum duration set in the pilot |

## 2. Blinding

- Builds identified by random codes (`B-7F3A`); whoever generates the code→model map (the **blind coordinator**) does not rate.
- Remove interface text that reveals the model.
- Raters do not see development conversations before finishing.
- At the end, each rater tries to guess each build's origin. The hit rate is recorded as a measure of identity leakage.

## 3. Criteria (1 to 5 scale, with anchors)

| ID | Criterion | 1 | 3 | 5 |
|---|---|---|---|---|
| C1 | Event–sensation match | Sensation unrelated or contradictory | Recognisable for some events | Every event feels like what it represents |
| C2 | Pattern distinction | Indistinguishable | Some distinguishable, with effort | All distinguishable without effort |
| C3 | Audio–haptic synchronisation | Clearly out of sync | Noticeable but tolerable | Perceived as a single event |
| C4 | Naturalness | Artificial or confusing | Acceptable | Feels part of the simulated world |
| C5 | Comfort | Unpleasant or bothersome | Comfortable for a short time | Comfortable for the whole session |
| C6 | Consistency across repetitions | Every repetition different | Partly consistent | Perceptibly identical |
| C7 | Ease of use and configuration | Cannot adjust or disable | Can, with help | Adjusts and disables effortlessly |

Each response includes the `discomfort_flag` field. Flagging discomfort stops that rater's session (see [SAFETY-AND-ETHICS](SAFETY-AND-ETHICS.md)).

## 4. Blind identification test (H-ID)

Measures pattern distinction objectively.

1. The rater holds the controller with the screen off and audio masked.
2. The five surfaces' patterns play in random order, three times each.
3. For each, the rater picks the surface.

Chance = 20%. Report accuracy and the confusion matrix per build.

## 5. Reliability and validity

| Check | Rule |
|---|---|
| Agreement | Krippendorff's α (ordinal) per criterion. ≥ 0.800 reliable; 0.667 to 0.800 tentative; < 0.667 inconclusive |
| Protocol validity | The panel must rank R2 > R1 > R0. If it cannot, the session is invalid |
| Identity leakage | Origin hit rate recorded (§2) |

## 6. Aggregation

Mean of criteria per rater and repetition, then mean across raters. `s2 = (mean − 1) / 4` ([SCORING](SCORING.md#d2--human-experience)). Also report the median and the per-rater dispersion.

## 7. Recording

Use [`templates/human-eval-form.csv`](../../templates/human-eval-form.csv): `session_id`, `rater_id`, `build_code`, `scenario_id`, `repetition`, `criterion_id`, `score_1_5`, `discomfort_flag`, `comment`. Minimal, pseudonymised personal data.
