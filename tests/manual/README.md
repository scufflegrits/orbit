# Manual browser checks

These release-specific probes sit alongside Orbit's regular test runners.

- `group_downgrade.py` compares the current build with the local `v3.0.2` tag in Chromium in file and server modes. It uses temporary fixtures and disposable browser contexts.
- `visible_group_popups.py` reproduces the 3.0.3 group-planet pop-up check. It expects the visible Edge test profile over the loopback CDP tunnel on port 9334, the Orbit fixture at `C:\orbit-visible-test`, and the destination fixture on port 8779. Run with `blocked` before allowing pop-ups, or `allowed` after allowing them. The `inspect-settings` phase shows the Edge pop-up control.
- `enable_edge_popups.py` toggles the pop-up setting in that same disposable Edge test profile. Run it only against the isolated profile used by the visible test.

Run the scripts with the project's Playwright Python. For current visible Edge setup and cleanup, see [Windows 11 test VM](../../docs/HANDOFF.md#windows-11-test-vm).
