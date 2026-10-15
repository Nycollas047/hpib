# HPIB — Hardware compatibility (v0.2, draft)

Compatibility is measured **per feature**, in each combination of hardware, operating system, driver, library and interface. Kernel support is an integration advantage, not a guarantee that an advanced feature is reachable by any application.

## 1. Initial matrix (detection requirements, not an availability guarantee)

Items tagged H refer to the [technical hypotheses](GCEB-SPEC.md#technical-hypotheses-to-verify-phase-1) to verify in Phase 1.

| Feature | Generic gamepad | DualSense | Steam Controller (2026) |
|---|---|---|---|
| Buttons, sticks, analog triggers | Standard API | Kernel/library (H3, H5) | Basic gamepad at system level; full through Steam Input (H4) |
| Vibration | If supported | Expected in kernel (H3) | 4 LRA motors reported: 2 in the grips and 2 in the trackpads; access to verify |
| Trackpad haptics | Not applicable | Not applicable | Reported; access through Steam Input to verify |
| Adaptive triggers | Do not assume | Exist in hardware; user-space access (H3) | Not reported |
| Motion sensors (IMU) | Do not assume | Kernel exposes sensors (H3) | 6-axis IMU reported; access to verify |
| Touchpad / trackpads as input | Not applicable | Kernel exposes touchpad (H3) | Two pressure-sensitive trackpads; outside Steam Input they did not work under Proton/Wine (reported) |
| High-definition haptics | Not applicable | Through a USB audio endpoint (H6) | Not applicable |
| Transport | USB, Bluetooth | USB, Bluetooth | USB-C, Bluetooth, 2.4 GHz dongle (reported) |

Source for the Steam Controller: [GamingOnLinux, May 2026](https://www.gamingonlinux.com/2026/05/the-new-steam-controller-from-valve-is-out-now-some-early-thoughts/page=1), a review after about 5 days of use. No row above has been verified by HPIB.

### Consequence for the Steam Controller adapter

If full features depend on Steam Input, the adapter requires the Steam client running. The manifest must record the Steam client and firmware versions. Without them, the run is `INVALID` (G0).

## 2. Adapter contract

The adapter publishes a descriptor validated by [`capability-descriptor.schema.json`](../../schemas/capability-descriptor.schema.json):

| Field | Content |
|---|---|
| `device_id`, `transport`, `os`, `firmware` | Environment identification |
| `adapter`, `libraries` | Adapter name and version; drivers and libraries used |
| `capabilities.<feature>.state` | `supported`, `unsupported`, `unavailable` or `unverified` ([capability rule](GCEB-SPEC.md#4-capability-rule)) |
| `capabilities.<feature>.access_path` | For example kernel evdev, SDL, Steam Input, WebHID, Gamepad API |
| `capabilities.<feature>.verified_level` | V0–V4 level of the functional check |

## 3. Adding a device

1. Implement an adapter that publishes the descriptor.
2. For each feature, write a functional check (command and observe whatever is observable).
3. Run T02, T03, T09 and T11 on the device.
4. Record differences in Linux distribution, kernel version and library.
5. Open a pull request with the descriptor and the evidence.

## 4. Compatibility requirements

- Correctly identify the hardware and record the features actually available.
- Separate standard inputs from proprietary features.
- Document drivers, libraries and permissions (for example `udev` rules).
- Handle USB and wireless connection, when supported.
- Test suspend, reconnection and recovery.
- Do not assume universal support for advanced features.
