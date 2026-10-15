# HPIB — Internal run guide (v0.2, draft)

How a team runs GCEB with its own agents. Nothing has to leave the company.

## 1. Choose the modality

| | Minimal run | Full run |
|---|---|---|
| Tasks | 1 (`terrain-feedback`) | 1 or more, with private variants |
| Agent configurations | 2 | As many as needed |
| Attempts (k) | 3 | ≥ 5 |
| Raters | 3 | ≥ 5 |
| Measurement rig (V3) | Absent | Present |
| Possible conformance | C0 or C1 | C1 or C2 |

Results without a rig are **not comparable** with results with one.

## 2. Roles

| Role | Responsibility |
|---|---|
| Run owner | Manifest, budget, artifact preservation |
| Hardware operator | Prepares the device, firmware and environment; operates the rig |
| Blind coordinator | Generates build codes and keeps the map; **does not rate** |
| Raters | Follow the [human protocol](HUMAN-EVALUATION.md) |
| Auditor | Checks claims × evidence (D5) and runs the D6 and D7 checks |

One person may hold several roles, except Blind coordinator and Rater.

## 3. Prerequisites

- A Linux PC (or the declared environment) and the controller(s) with firmware recorded.
- Web track and, optionally, Native track ([GCEB-SPEC](GCEB-SPEC.md#3-reference-profile)).
- Agent configured **without** network access unless an exception is declared, and **without** permission to update firmware.
- For V3: a contact microphone or accelerometer fixed to the controller, recording on a clock shared with audio.

## 4. Step by step

| # | Step | Output | Check |
|---|---|---|---|
| 1 | Fill in the [manifest](../../templates/run-manifest.yaml) | `manifest.yaml` | Environment fully described |
| 2 | Generate the device capability descriptor | Valid `capability.json` | Passes the schema |
| 3 | Hand the task to the agent and start the budget | Session recorded | Interventions noted in real time |
| 4 | Collect artifacts and the [completion report](../../templates/completion-report.yaml) | `artifacts/` | Report valid against the schema |
| 5 | Run T01–T12 | Test results | Logs preserved |
| 6 | Measure on the rig (T11), if available | `measurement/` | Clocks synchronised |
| 7 | Audit claims | Count of false and unsupported | D5 computed |
| 8 | Code the builds and run human evaluation | `human/` | References R0, R1, R2 included |
| 9 | Compute the [score](SCORING.md) | Points, state, intervals | Gates G0–G2 recorded |
| 10 | Produce the report from the [template](../../templates/report-template.md) | `report.md` | `SHA256SUMS` of artifacts |

## 5. Run structure

```
runs/<run_id>/
├── manifest.yaml
├── agent/            # agent session log and interventions
├── artifacts/        # code, tests, telemetry.jsonl, completion-report.yaml
├── measurement/      # rig recordings, if any
├── human/            # forms (the code map stays with the blind coordinator)
├── report.md
└── SHA256SUMS
```

## 6. Conformance levels

| Level | Meaning | May be called an "HPIB result"? |
|---|---|---|
| **C0** Exploratory | Any deviation from the protocol | No |
| **C1** Conformant | Protocol followed and manifest archived (self-declared) | Yes, with the level stated |
| **C2** Audited | An independent third party reproduced or audited the artifacts | Yes |

Citation format: `HPIB-GCEB v0.2 / terrain-feedback v0.2.0 / C1 / rig: absent`.

## 7. Common mistakes

| Mistake | Effect |
|---|---|
| Updating the task or tests during the run | Run `INVALID` |
| Reusing the public task as the official set | Contamination; use private variants |
| A rater knows which model produced the build | Bias; record it and, if possible, repeat |
| Counting commanded vibration as measured vibration | Wrong level in D1 and D5 |
| Comparing runs with and without a rig | Non-comparable result |
