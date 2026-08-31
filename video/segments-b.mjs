import { execFileSync } from "node:child_process";
import { terminalPanel, diffPanel, beat } from "./lib/stage.mjs";

/**
 * Segments 3, 4 and 7 — the text-driven shots.
 *
 * Every string rendered here is read from a committed artifact or captured from a live command at
 * record time. Each segment throws rather than degrade if its real source is missing: a demo that
 * invents its own evidence would contradict the thing the project argues.
 */

export function register(SEGMENTS, ctxHelpers) {
  const { openStage, finish, fileUrl, realFile, REPO, boxOf } = ctxHelpers;

  /** 3. Sighted order vs the order a screen reader actually announces. */
  SEGMENTS["03-reorder"] = async (browser) => {
    const rel = "corpus/adversarial/css-reorder/index.html";
    const nd = JSON.parse(realFile("docs/trajectories/narration-diff.json"));
    const cr = nd.pages.find((p) => p.slug === "css-reorder");
    if (!cr) throw new Error("refusing to fabricate: css-reorder narration missing");
    const heard = [];
    for (const t of cr.before) {
      const m = /^heading, (Starter|Team|Enterprise), level 2$/.exec(t);
      if (m && !heard.includes(m[1])) heard.push(m[1]);
    }
    if (heard.length !== 3) throw new Error("refusing to fabricate: unexpected capture " + heard);

    const { ctx, page } = await openStage(browser, {
      id: "03-reorder", fullFrame: true, chromeLabel: rel, src: fileUrl(rel),
    });
    const frame = page.frameLocator("#stageFrame");
    // 125% browser zoom, the Windows default: a viewer setting, not an edit to the page.
    await frame.locator("body").evaluate(() => { document.documentElement.style.zoom = "1.25"; });
    await beat(1100);
    await page.evaluate(() => window.__v.caption(
      "Another page from the same corpus — a pricing table. <b>Also scanner-clean.</b>",
      "Sighted order, left to right: Starter → Team → Enterprise."));
    await beat(2800);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(700);

    // Number the cards in the order the screen reader ACTUALLY announced them. Because the
    // captured order is Enterprise → Starter → Team, the chips land 3, 1, 2 left to right —
    // the defect draws itself, we don't have to assert it.
    const boxes = {};
    for (const k of ["starter", "team", "enterprise"]) {
      boxes[k] = await boxOf(frame.locator("#tier-" + k));
    }
    await page.evaluate(() => window.__v.caption(
      "Numbering them in the order the <b>screen reader</b> announces."));
    await beat(1500);
    for (let i = 0; i < heard.length; i++) {
      const b = boxes[heard[i].toLowerCase()];
      // Top-RIGHT of the card: at the top-left the chip sits on top of the tier name it is
      // numbering, which hides the very word the shot is about.
      await page.evaluate(([n, x, y]) => window.__v.chip(n, x, y), [i + 1, b.x + b.width - 34, b.y + 30]);
      await beat(1050, 110);
    }
    await beat(900);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(500);
    await page.evaluate((h) => window.__v.caption(
      "It reads <b>" + h.join(" → ") + "</b> — a different order than the one on screen.",
      "Verbatim from the captured virtual-screen-reader transcript. CSS 'order' moved the cards; the reading order did not follow."), heard);
    await beat(4200);
    await page.evaluate(() => { window.__v.clearAnn(); window.__v.hideCaption(); });
    await beat(1000);
    await finish(ctx, page, "03-reorder");
  };

  /** 4. The real audit, captured at record time so it is provably this run. */
  SEGMENTS["04-terminal"] = async (browser) => {
    const target = "corpus/adversarial/keyboard-trap-modal/index.html";
    const cmd = "npm run audit -- " + target + " --no-llm";
    let out = "", code = 0;
    try {
      // stderr carries the progress line and is emitted FIRST in a real terminal, so order it
      // that way rather than appending it after the report.
      const r = execFileSync("npm", ["run", "audit", "--", target, "--no-llm"],
        { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true });
      out = r;
    } catch (e) { out = (e.stderr || "") + (e.stdout || ""); code = e.status ?? 1; }
    const body = out.split(/\r?\n/)
      .filter((l) => !/^\s*>/.test(l) && !/^npm (warn|notice)/.test(l.trim()))
      .join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!/SCANNER-CLEAN/.test(body)) throw new Error("refusing to fabricate: audit output missing headline");

    // A real bash prompt, with its two variable parts READ rather than invented: the working
    // directory the command actually ran in, and the branch it actually ran on.
    const cwd = execFileSync("bash", ["-lc", "pwd"], { cwd: REPO, encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
    const prompt = `${cwd} (${branch})\n$ `;

    const { ctx, page } = await openStage(browser, {
      id: "04-terminal", fullFrame: true, chromeLabel: `MINGW64:${cwd}`,
      inner: terminalPanel(""),
    });
    const type = async (text) => {
      for (const ch of text) {
        await page.evaluate((c) => { document.getElementById("term").textContent += c; }, ch);
        await new Promise((r) => setTimeout(r, 45 + Math.random() * 50));
      }
    };
    await beat(800);
    await page.evaluate((p) => { document.getElementById("term").textContent = p; }, prompt);
    await type(cmd);
    await beat(750);
    await page.evaluate(() => { document.getElementById("term").textContent += "\n"; });
    await beat(850);
    await page.evaluate((t) => { document.getElementById("term").textContent += t + "\n"; }, body);
    await page.evaluate(([p, c]) => {
      document.getElementById("term").textContent += "\n" + p + "echo $?\n" + c + "\n\n" + p;
    }, [prompt, code]);
    await beat(1200);
    await page.evaluate(() => window.__v.caption(
      "The scanner says clean. <b>The audit finds three issues it cannot see</b> — and exits non-zero.",
      "Real output, captured while this frame was recorded. Exit 1 is what fails a CI check."));
    await beat(5400);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(700);
    await finish(ctx, page, "04-terminal");
  };

  /** 7. The narration diff — what a blind user hears, before vs after. */
  SEGMENTS["07-narration"] = async (browser) => {
    const nd = JSON.parse(realFile("docs/trajectories/narration-diff.json"));
    const pl = nd.pages.find((p) => p.slug === "placeholder-as-label");
    const fn = nd.pages.find((p) => p.slug === "inj-alt-filename-heading");
    if (!pl || !fn) throw new Error("refusing to fabricate: narration pages missing");
    const rows = [
      ...pl.distinctRemoved.map((t) => ({ op: "-", text: t })),
      ...pl.distinctAdded.map((t) => ({ op: "+", text: t })),
    ];
    const { ctx, page } = await openStage(browser, {
      id: "07-narration", fullFrame: true, chromeLabel: "docs/trajectories/narration-diff.md",
      inner: diffPanel(rows, { heading: "placeholder-as-label — captured screen-reader announcements" }),
    });
    await beat(900);
    await page.evaluate(() => window.__v.caption("Five form fields. This is what a blind user hears."));
    await beat(2000);
    await page.evaluate(() => window.__v.hideCaption());
    const nBefore = pl.distinctRemoved.length;
    for (let i = 0; i < rows.length; i++) {
      await page.evaluate((n) => {
        const el = document.querySelectorAll("#difflines .dl")[n];
        if (el) el.style.opacity = "1";
      }, i);
      await beat(i === nBefore ? 900 : 430, 90);
      if (i === nBefore - 1) {
        await page.evaluate(() => window.__v.caption(
          "<b>Before:</b> a placeholder is read out — but a placeholder is not a label.",
          "It vanishes the moment the user types, and it is not an accessible name."));
        await beat(2800);
        await page.evaluate(() => window.__v.hideCaption());
      }
    }
    await beat(700);
    await page.evaluate(() => window.__v.caption(
      "<b>After:</b> every field has a real accessible name.",
      "Same page, same model, same prompt — the difference is that the fix was verified."));
    await beat(2900);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(600);
    await page.evaluate((t) => {
      document.getElementById("stageInner").innerHTML =
        '<div style="width:1920px;height:1040px;background:#0c1017;padding:44px 60px;' +
        'font-family:\'Cascadia Code\',Consolas,monospace;font-size:26px;color:#d7e3f4">' +
        '<div style="font-family:-apple-system,\'Segoe UI\',sans-serif;font-size:24px;color:#8fa3c0;margin-bottom:30px">' +
        'inj-alt-filename-heading — captured announcements</div>' +
        '<div style="padding:12px 18px;color:#ff8a80;background:rgba(255,95,87,.10);border-radius:6px">- ' + t[0] + '</div>' +
        '<div style="padding:12px 18px;color:#ff8a80;background:rgba(255,95,87,.10);border-radius:6px;margin-top:10px">- ' + t[1] + '</div>' +
        '<div style="padding:12px 18px;color:#79e2a8;background:rgba(40,200,120,.10);border-radius:6px;margin-top:22px">+ ' + t[2] + '</div>' +
        '</div>';
    }, [fn.distinctRemoved[0], fn.distinctRemoved[1], fn.distinctAdded[0]]);
    await beat(1000);
    await page.evaluate(() => window.__v.caption(
      "And a camera filename simply stops being read aloud.",
      "The image was grounded by the adjacent heading, so its alt became empty — nothing was invented."));
    await beat(4500);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(800);
    await finish(ctx, page, "07-narration");
  };
}
