import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Freeze a handful of well-known PUBLIC pages into corpus/real/<slug>/ for external
 * validity — evidence that real, professionally-built sites are scanner-clean yet still
 * fail the screen-reader/keyboard layer.
 *
 * DETECTION-ONLY: we analyze frozen snapshots and REPORT the gap. We do NOT publish or
 * ship "fixes" to sites we don't own. Each snapshot records its source URL + timestamp.
 * Run explicitly (network): `npm run snapshot-real`.
 */

// Diverse candidates; we keep whichever fetch cleanly (real sites block/redirect/stall —
// that messiness is the production test). Snapshots under ~5 KB are treated as
// bot-challenge/blocked stubs and skipped.
const SITES: { slug: string; url: string; kind: string }[] = [
  { slug: "gov-usagov", url: "https://www.usa.gov/", kind: "government" },
  { slug: "docs-mdn", url: "https://developer.mozilla.org/en-US/", kind: "documentation" },
  { slug: "org-wikipedia", url: "https://www.wikipedia.org/", kind: "reference" },
  { slug: "news-npr", url: "https://www.npr.org/", kind: "news" },
  { slug: "brand-apple", url: "https://www.apple.com/", kind: "brand" },
  { slug: "saas-github", url: "https://github.com/", kind: "SaaS" },
  { slug: "ecommerce-ebay", url: "https://www.ebay.com/", kind: "e-commerce" },
];
const MIN_BYTES = 5000;

async function main(): Promise<void> {
  const root = join(process.cwd(), "corpus", "real");
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const stampedAt = new Date().toISOString();
  try {
    for (const s of SITES) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        const html = await page.content();
        if (html.length < MIN_BYTES) {
          console.warn(`${s.slug}: skipped — only ${html.length} bytes (likely a bot-challenge/blocked stub)`);
          continue;
        }
        const dir = join(root, s.slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "index.html"), html, "utf8");
        writeFileSync(
          join(dir, "source.json"),
          JSON.stringify({ slug: s.slug, url: s.url, kind: s.kind, snapshotAt: stampedAt, note: "Frozen public snapshot for detection-only analysis; not modified, not republished as a 'fix'." }, null, 2) + "\n",
          "utf8",
        );
        console.log(`${s.slug}: ${html.length} bytes from ${s.url}`);
      } catch (err) {
        console.warn(`${s.slug}: fetch failed — ${(err as Error).message}`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log("done — snapshots under corpus/real/. Audit them with: npm run audit -- corpus/real/<slug>/index.html");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
