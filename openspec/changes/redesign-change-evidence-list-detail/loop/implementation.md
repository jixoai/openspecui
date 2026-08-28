<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Track the single implementation slice and its evidence.
2. Keep the walkthrough re-verification handoff explicit.

Original request (2026-08-28): "这种结构替代手风琴会更好"
-->

# Implementation state

```text
R0 change authored              DONE   intake / research-plan / opsx-ui-views delta
R1 implementation               PENDING  single web slice (see research-plan slice table)
R2 Codex review                 PENDING
R3 rebuild walkthrough assets   PENDING  rebuild web bundle + copy-web + restart 3100/3101
R4 Owner re-walkthrough        PENDING  acceptance boundary
```

## Evidence recording rule

Gate turns DONE only with the touched files, the focused test commands actually run, and any
deviation. The integrator re-runs focused tests locally before recording.
