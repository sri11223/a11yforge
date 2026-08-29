# Real-world evidence bucket (detection-only)

Frozen snapshots of well-known **public** pages, used for external validity: evidence that
real, professionally-built sites are often scanner-clean yet still fail the screen-reader /
keyboard layer.

**Detection-only, and ethical by design.** We *analyze* frozen snapshots and *report* the gap.
We do **not** modify these pages, and we do **not** publish or ship "fixes" to sites we don't
own. Each snapshot's `source.json` records its source URL and capture timestamp.

Populate with:

```bash
npm run snapshot-real                       # fetches + freezes into corpus/real/<slug>/
npm run audit -- corpus/real/<slug>/index.html   # report the gap for one snapshot
```

Snapshots are generated on demand (not committed by default) so results reflect the site at
your capture time; commit a snapshot only if you want to pin a specific point-in-time example,
and keep its `source.json` alongside it.
