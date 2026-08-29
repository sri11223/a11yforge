import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderHtmlReport } from "../src/report/html-report.js";

/**
 * Build the self-contained HTML report from committed results.
 *   npx tsc && node dist/eval/build-report.js   → writes docs/report.html
 */
const R = join(process.cwd(), "docs", "results");
const read = (f: string) => JSON.parse(readFileSync(join(R, f), "utf8"));

const html = renderHtmlReport(read("metrics.json"), read("ablation.json"), read("sr-transcript.json"));
writeFileSync(join(process.cwd(), "docs", "report.html"), html, "utf8");
console.log(`Wrote docs/report.html (${html.length} bytes)`);
