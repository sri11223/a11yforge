.PHONY: install build test eval ablation report trajectories determinism docker-eval docker-determinism

# --- local (Node 22) ---
install:            ## install pinned deps
	npm ci
build:             ## compile TypeScript -> dist/
	npm run build
test:              ## full test suite (offline)
	npm test
eval:              ## ONE COMMAND: offline baseline-vs-advanced eval -> out/metrics.json
	npm run eval
ablation:          ## gated {A}/{A,B}/{A,B,C} ablation -> out/ablation.json
	npm run ablation
report:            ## build docs/report.html from committed results
	npm run report
trajectories:      ## export runtime agent trajectories -> docs/trajectories/
	npm run trajectories
determinism:       ## 3x byte-identical determinism proof -> docs/results/DETERMINISM.md
	npm run determinism

# --- docker (only Docker required; offline, no key) ---
docker-eval:       ## ONE COMMAND in a container: full offline eval
	docker compose run --rm eval
docker-determinism:
	docker compose run --rm determinism
