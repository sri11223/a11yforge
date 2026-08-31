# Pins the Playwright Chromium revision to the exact build A11yForge uses (Playwright
# 1.62.1 → chromium-headless-shell v1234 / Chrome 151). The official Playwright image
# ships that browser preinstalled, so the reproducible run is byte-stable across machines.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Install pinned deps first (better layer caching). npm ci uses the committed lockfile;
# pa11y's bundled Puppeteer downloads its (version-pinned) Chromium here too.
COPY package.json package-lock.json .npmrc ./
# --ignore-scripts is REQUIRED, not an optimisation: package.json has "prepare": "npm run build"
# and npm runs prepare during `npm ci`. At this layer there is no tsconfig.json and no src/, so tsc
# has no project and exits 1, failing the whole install. The real compile happens at `npm run build`
# below, after COPY . ., so nothing is lost. It also skips pa11y's Puppeteer Chrome download, which
# is unnecessary because A11YFORGE_PA11Y_CHROMIUM=1 reuses the image's Playwright Chromium.
RUN npm ci --ignore-scripts
# pa11y's Puppeteer reuses the image's full Playwright Chromium via executablePath (gated by
# this flag in src/layers/layerA-scanners.ts), so no separate Chrome download is needed.
ENV A11YFORGE_PA11Y_CHROMIUM=1

COPY . .
RUN npm run build

# The reproducible path is OFFLINE: replay from committed cassettes, NO OpenRouter key.
ENV A11YFORGE_MODE=replay

# One command → the full baseline-vs-advanced evaluation, writing out/metrics.json.
CMD ["node", "dist/eval/run-eval.js"]
