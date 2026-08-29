# Real-world evidence (detection-only)

A/B/C detector run over frozen snapshots of public sites. We analyze and **report the gap**; we never modify or publish fixes to sites we don't own. Layer C is backstops-only (no key); real pages change over time (see each `snapshotAt`).

**3 of 4** snapshots have issues a screen-reader/keyboard user hits that the automated scanner's report does not surface (**38** such issues in total).

Note: unlike our curated corpus (which is deliberately axe-clean), these real sites also carry **many Layer-A violations** — scanners are not useless. The point is the Layer-B/C class of barriers (keyboard operability, reading order, meaningless-but-present alt) that a scanner cannot detect **at all**, shown in the last column.

| Site | Kind | Layer A (scanner) | Layer B (SR/keyboard) | Layer C (semantic) | Hidden from scanner |
|---|---|---|---|---|---|
| `brand-apple` | brand | 293 | 0 | 20 | **20** |
| `docs-mdn` | documentation | 103 | 0 | 1 | **1** |
| `news-npr` | news | 117 | 4 | 13 | **17** |
| `org-wikipedia` | reference | 4 | 0 | 0 | **0** |

Source URLs + timestamps are in `docs/results/real-world.json` and each `corpus/real/<slug>/source.json`.
