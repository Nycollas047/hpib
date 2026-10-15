# HPIB report — `<run_id or comparison id>`

**Citation:** `HPIB-GCEB v0.2 / terrain-feedback v0.2.0 / C? / rig: present|absent`

## 1. Result

| Item | Value |
|---|---|
| Report state | INVALID · UNSAFE · TECH_FAIL · TECH_PASS_HUMAN_INCOMPLETE · FULL_PASS |
| Agent configuration | model + version, scaffold, tools, budget profile |
| Attempts (k) | |
| Technical pass rate (Wilson 95% CI) | |
| Score (mean, bootstrap 95% CI, best, worst) | |
| Requirement coverage (applicable / total) | |

## 2. Gates

| Gate | Pass | Notes |
|---|---|---|
| G0 Valid run | | |
| G1 Safety | | |
| G2 Mandatory requirements | | |

## 3. Dimensions

| Dimension | Weight | s (0–1) | Points | Notes |
|---|---:|---:|---:|---|
| D1 Verified functionality | 25 | | | |
| D2 Human experience | 25 | | | α = ; reliability flag |
| D3 Hardware and API integration | 15 | | | |
| D4 Debugging and recovery | 10 | | | |
| D5 Claim accuracy | 10 | | | false = ; unsupported = ; total = |
| D6 Code quality | 10 | | | |
| D7 Documentation | 5 | | | |
| **Total** | **100** | | | |

## 4. Cost profile (not scored)

| Measure | Value |
|---|---|
| Time to first working V1 | |
| Human interventions (none / hint / fix / takeover) | |
| Tokens and tool calls | |

## 5. Human evaluation summary

Panel size, blinding procedure, reference-build ordering check (R2 > R1 > R0), H-ID accuracy and confusion matrix, identity-leak rate.

## 6. Environment and deviations

Device, firmware, OS, libraries, transport, measurement rig. Deviations from protocol and their possible effect on comparability.

## 7. Known limitations

## 8. Artifacts

Path to the run directory and `SHA256SUMS`.
