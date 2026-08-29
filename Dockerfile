# Pins the Playwright Chromium revision to the exact build A11yForge uses (Playwright
# 1.62.1 → chromium-headless-shell v1234 / Chrome 151). The official Playwright image
# ships that browser preinstalled, so the reproducible run is byte-stable across machines.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Install pinned deps first (better layer caching). npm ci uses the committed lockfile;
# pa11y's bundled Puppeteer downloads its (version-pinned) Chromium here too.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# The reproducible path is OFFLINE: replay from committed cassettes, NO OpenRouter key.
ENV A11YFORGE_MODE=replay

# One command → the full baseline-vs-advanced evaluation, writing out/metrics.json.
CMD ["node", "dist/eval/run-eval.js"]
