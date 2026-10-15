# HPIB — Roadmap and decisions (v0.2)

Unifies the phased plan of the concept document and the stages of the GCEB v0.1 specification, which previously diverged.

## Phases

| Phase | Focus | Deliverables | Depends on |
|---|---|---|---|
| **0** | Specification (this repository) | Documents, task, schemas, templates | — |
| **1** | Foundation and spike | Verify H1–H6; choose track and reference device; V3 rig prototype; diagnostic tool | 0 |
| **2** | Reference application | Terrain Feedback Challenge app; T01–T12 harness; validated telemetry | 1 |
| **3** | Human pilot | Run the protocol; calibrate weights, thresholds and tolerances | 2 |
| **4** | First comparative experiment | Same task across several configurations; k ≥ 5; C1 report | 3 |
| **5** | Modding | Challenges with existing games; compare reactive audio and semantic events | 4 |
| **6** | Linux ecosystem | Adapters for more devices; distribution and library matrix | 4 |
| *Exploratory* | Robotics; applied and medical research | Working groups with experts; own protocols | 4 |

For modding (phase 5), two complementary strategies, neither presumed superior: **reactive audio** (analyses system audio, works without access to game events) and **semantic events** (collision, terrain, skid; more precise, needs a mod interface). The report states which was used. Candidate games with an open mod interface will be assessed in phase 5.

## Proposed decisions

Initial answers to the v0.1 open questions. Status: **Decided**, **Proposed** (to be confirmed by the author) or **Open**.

| ID | Question | Proposal | Status |
|---|---|---|---|
| D-01 | License | Apache-2.0 for everything (code, schemas, documents, tasks) | Decided |
| D-02 | Governance | Single maintainer at first; changes via RFC in issues; committee once there are ≥ 3 external maintainers | Proposed |
| D-03 | Technology | Mandatory Web track + optional Native track | Proposed; confirm in Phase 1 |
| D-04 | Reference device | One generic gamepad (Web) + one of DualSense and Steam Controller 2026, chosen in Phase 1 by the criterion of documented haptics access | Open |
| D-05 | Latency and synchronisation tolerances | Do not fix a priori; derive from rig measurements in the pilot | Proposed |
| D-06 | Attempts and raters | k ≥ 5 attempts; panel ≥ 5 | Proposed; calibrate |
| D-07 | Human aggregation | Mean across raters; Krippendorff's α reported | Proposed |
| D-08 | Task memorisation | Public development set + private parametric variants + hidden tests + canary in files | Proposed |
| D-09 | Result authenticity | Manifest + SHA-256 of artifacts + levels C0–C2 | Proposed |
| D-10 | Admitted models and tools | Any; the unit is the agent configuration, declared in the manifest | Proposed |
| D-11 | Resource limits | Two standard profiles (short and long), values set in the pilot | Proposed |
| D-12 | Robotics and medicine | Outside v0.x; require working groups with experts | Proposed |
