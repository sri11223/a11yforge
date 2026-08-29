import { chromium } from "playwright";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit } from "../src/cli/audit.js";

/**
 * Run the A/B/C detector over the frozen real-world snapshots in corpus/real/ and write a
 * detection-only findings report to docs/results/real-world.json (+ a Markdown summary).
 * Deterministic path: Layer C runs backstops-only (--no-llm) so the report needs no key.
 * This NEVER touches corpus/injected or the sealed V1 metrics/ablation/DETERMINISM files.
 *   npx tsc && node dist/eval/audit-real.js
 */

interface SiteResult {
  slug: string;
  url: string;
  kind: string;
  snapshotAt: string;
  scannerClean: boolean;
  layerA: number;
  layerB: number;
  layerC: number;
  hiddenFromScanner: number;
  sampleHidden: string[];
}

async function main(): Promise<void> {
  const ROOT = join(process.cwd(), "corpus", "real");
  if (!existsSync(ROOT)) {
    console.error("corpus/real/ is empty — run `npm run snapshot-real` first.");
    process.exitCode = 1;
    return;
  }
  const slugs = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((s) => existsSync(join(ROOT, s, "index.html")))
    .sort();

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const sites: SiteResult[] = [];
  try {
    for (const slug of slugs) {
      const src = existsSync(join(ROOT, slug, "source.json"))
        ? (JSON.parse(readFileSync(join(ROOT, slug, "source.json"), "utf8")) as { url: string; kind: string; snapshotAt: string })
        : { url: "?", kind: "?", snapshotAt: "?" };
      try {
        const r = await audit(join(ROOT, slug, "index.html"), { browser, noLlm: true });
        const hidden = [...r.layerB, ...r.layerC];
        sites.push({
          slug, url: src.url, kind: src.kind, snapshotAt: src.snapshotAt,
          scannerClean: r.scannerClean,
          layerA: r.summary.mechanical, layerB: r.summary.behavioral, layerC: r.summary.semantic,
          hiddenFromScanner: r.summary.hiddenFromScanner,
          sampleHidden: hidden.slice(0, 4).map((f) => `[${f.wcag ?? "?"}] ${f.message.slice(0, 90)}`),
        });
        console.log(`${slug}: A=${r.summary.mechanical} B=${r.summary.behavioral} C=${r.summary.semantic} (hidden=${r.summary.hiddenFromScanner})`);
      } catch (err) {
        console.warn(`${slug}: audit failed — ${(err as Error).message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const withHidden = sites.filter((s) => s.hiddenFromScanner > 0).length;
  const totalHidden = sites.reduce((n, s) => n + s.hiddenFromScanner, 0);
  const report = {
    note: "Detection-only: A/B/C findings on frozen snapshots of public sites. We analyze and report; we do not modify or publish fixes to sites we don't own. Layer C is backstops-only (no key). Real pages change — see each site's snapshotAt.",
    n: sites.length,
    sitesWithHiddenIssues: withHidden,
    totalHiddenIssues: totalHidden,
    sites,
  };
  writeFileSync(join(process.cwd(), "docs", "results", "real-world.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  const md = [
    "# Real-world evidence (detection-only)",
    "",
    "A/B/C detector run over frozen snapshots of public sites. We analyze and **report the gap**; we never modify or publish fixes to sites we don't own. Layer C is backstops-only (no key); real pages change over time (see each `snapshotAt`).",
    "",
    `**${withHidden} of ${sites.length}** snapshots have issues a screen-reader/keyboard user hits that the automated scanner's report does not surface (**${totalHidden}** such issues in total).`,
    "",
    "Note: unlike our curated corpus (which is deliberately axe-clean), these real sites also carry **many Layer-A violations** — scanners are not useless. The point is the Layer-B/C class of barriers (keyboard operability, reading order, meaningless-but-present alt) that a scanner cannot detect **at all**, shown in the last column.",
    "",
    "| Site | Kind | Layer A (scanner) | Layer B (SR/keyboard) | Layer C (semantic) | Hidden from scanner |",
    "|---|---|---|---|---|---|",
    ...sites.map((s) => `| \`${s.slug}\` | ${s.kind} | ${s.layerA} | ${s.layerB} | ${s.layerC} | **${s.hiddenFromScanner}** |`),
    "",
    "Source URLs + timestamps are in `docs/results/real-world.json` and each `corpus/real/<slug>/source.json`.",
  ].join("\n");
  writeFileSync(join(process.cwd(), "docs", "results", "real-world.md"), md + "\n", "utf8");

  console.log(`\n${withHidden}/${sites.length} snapshots scanner-report-incomplete; ${totalHidden} hidden issues total.`);
  console.log("Wrote docs/results/real-world.json + real-world.md");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
