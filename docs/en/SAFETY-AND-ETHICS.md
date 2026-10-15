# HPIB — Safety and ethics (v0.2, draft)

Safety applies from the design stage. There are four risk domains.

| Domain | Risk | Minimum control |
|---|---|---|
| Hardware | Excessive or stuck physical output; device damage | Manufacturer-documented limits; **safe state** (all outputs at zero) on disconnect, error or termination; a button or command to disable feedback; no firmware changes |
| Generated code | Untrusted code with access to devices and the system | Run as an unprivileged user; device permissions (`udev`) restricted to the test controller; no network by default; raw HID writes only to documented reports; firmware-update endpoints blocked |
| Participants | Discomfort, fatigue, lack of consent | Informed consent; voluntary participation and withdrawal at any time; stop on discomfort flag; duration and amplitude within device limits; alternatives for sensory and motor differences |
| Data | Collection beyond what is needed | Minimise and pseudonymise; **local** telemetry by default; no external sending without authorisation; comply with applicable law (for example LGPD, GDPR) |

## Integrity of claims

- An HPIB score does **not** certify a product, manufacturer or model.
- Comparisons that identify third parties are not published unless the protocol and the stated conformance level were met.
- Trademarks belong to their owners; the project has no affiliation with them.

## Medical and robotic applications

Out of scope for v0.x. HPIB does not certify medical devices or demonstrate clinical efficacy; a high score does not authorise clinical use. Any work in these areas requires its own protocol, qualified professionals, risk analysis, data protection, adequate consent, interruption procedures and independent validation. The level of supervision grows with task risk. Physical robots require operational limits and a stop mechanism.

## Reporting problems

Safety flaws in the kit (for example a procedure that could damage a device) should be reported privately to the author before public disclosure: nycollas_augusto@hotmail.com.
