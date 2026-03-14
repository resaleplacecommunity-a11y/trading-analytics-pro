TL;DR
- TAP sync is configured and currently healthy for profile "лео пропка" (tap_health_latest.md shows closed_unique=683, TAP unique=683, rc=0).
- Main sync pipeline: scripts/tap_sync.py (uses Base44 functions API when TAP_TOKEN starts with tpro_) → proxy relay (relay.tradinganalyticspro.com) → Bybit demo API. State file: reports/tap_sync_state_p_2df415def3.json.

What I indexed (quick list)
- Scripts: scripts/tap_sync.py, scripts/tap_health_check.py, scripts/tap_sync_multi.py
- Reports: reports/tap_sync.log, reports/tap_health_latest.md, reports/tap_sync_state_*.json, reports/tap_exchange_connections.json, leo_closed_analysis.csv, leo_state.json
- Env / secrets: .leo.env (contains TAP_TOKEN, BYBIT creds, BYBIT_RELAY_URL, EXCHANGE_PROXY_SECRET), .bybit-relay-secret (relay secret), reports/tap_exchange_connections.json (connection list)
- Memory entries / notes: memory/2026-03-14-tips-tap-assignment.md and many nightly summaries under reports/nightly_tony_summary_*.md referencing TAP issues and health checks.
- Dashboard/task backlog: reports/tony_ops_dashboard.html (contains TAP tasks: TASK-001..006 etc.)

Goals (as inferred)
- Keep TAP and Leo trade data in parity with Bybit closed trades (closed history) and open positions (upserts).
- Maintain automated nightly health-check (scripts/tap_health_check.py) and recover missing history when needed.
- Minimise duplicates/junk and preserve a single source-of-truth (reports/tap_sync_state_*.json).

Architecture (textual)
- Base44 (TAP) API (https://base44.app/api/apps/<APP_ID>)
  - scripts/tap_sync.py talks to Base44 via either Entities API (direct REST) or tradingApiV2 Functions API (fn_call) depending on TAP_TOKEN (USE_FUNCTION_API when token starts with tpro_).
- Relay/proxy
  - BYBIT_RELAY_URL = https://relay.tradinganalyticspro.com/proxy (configured in .leo.env)
  - Relay authenticates requests with EXCHANGE_PROXY_SECRET / .bybit-relay-secret
  - Relay forwards signed requests to Bybit (BYBIT_BASE https://api-demo.bybit.com)
- Local artifacts
  - TRADE_TABLE: reports/leo_trades_table.csv
  - CSV canonical closed set: reports/leo_closed_analysis.csv
  - State: reports/tap_sync_state_p_<...>.json (per-profile)
  - Logs: reports/tap_sync.log, reports/tap_health_latest.md

Infra & secrets found (sensitive)
- .leo.env contains:
  - TAP_TOKEN (tpro_... → functions API)
  - TAP_APP_ID
  - TAP_PROFILE_NAME / TAP_PROFILE_ID
  - BYBIT_API_KEY / BYBIT_API_SECRET (demo keys present)
  - BYBIT_RELAY_URL and EXCHANGE_PROXY_SECRET (relay.tradinganalyticspro.com)
- .bybit-relay-secret (matches EXCHANGE_PROXY_SECRET)
- reports/tap_exchange_connections.json (plaintext API keys for demo conn)

Current status (snapshot)
- Last health-check (reports/tap_health_latest.md, 2026-03-13T17:32:03Z): closed_unique 683, TAP unique 683, duplicates=0, junk=0, missing=0, extra=0 → integrity confirmed.
- tap_sync.log tail shows repeated successful runs for profile leo-demo with total_synced 683 and rc summary ok=1 error=0.
- tap_sync_state_p_2df415def3.json contains 683 synced external IDs.
- scripts/tap_sync.py uses function-api flow (USE_FUNCTION_API True) when TAP_TOKEN starts with tpro_ — currently true in .leo.env.

Observed recurring issues (historical / resolved / intermittent)
- Past failures: nightly summaries documented earlier show periods when tap_sync failed (api_get('UserProfile') or api errors). Those were investigated and later fixed (deletes, rebuild state, re-run sync).
- Operational note: many runs show "tap_synced_added 0" — that is normal when state is up-to-date; if missing history exists then added>0 should occur during recovery runs.

Blocking issues / risks (what needs attention)
1) Secrets in repo/workspace
   - .leo.env and reports/tap_exchange_connections.json contain API tokens/keys in plaintext. If this workspace is shared/backed up off-host, rotate or move to secret store.
2) Relay availability & auth
   - BYBIT_RELAY_URL points at relay.tradinganalyticspro.com and EXCHANGE_PROXY_SECRET exists. Need access to relay logs/health and the relay operator contact.
3) Production Bybit keys
   - Currently demo keys are present. To move to real trading, must provision and secure live Bybit keys and confirm relay handles live endpoints.
4) Base44 (TAP) ownership
   - TAP_TOKEN (tpro_...) uses a functions API key; confirm token owner and rotate/limit scope if needed.
5) Missing automated PR/tasks
   - No automated tests/CI to detect regressions in tap_sync after code changes.

Immediate 7-day plan (recommended)
- Day 0–1
  - Snapshot: create a secure backup of current state files (reports/tap_sync_state_*.json) and leo_closed_analysis.csv. (Done: backups/ exists but confirm timestamped copy)
  - Verify relay health: request access to relay.tradinganalyticspro.com dashboard or ask relay operator for uptime/logs for the last 7 days.
  - Confirm secrets handling policy: move .leo.env to secret manager / env-only and remove plaintext copies from repo (or gitignore). Replace reports/tap_exchange_connections.json with template.
- Day 1–3
  - Add a small CI job / cron script that runs scripts/tap_health_check.py daily with safe env (read-only) and stores reports/tap_health_latest.md with timestamp. Alert on non-ok.
  - Add a checklist task to verify scripting uses function-api vs entities API intentionally (confirm no unsupported fn paths used). Update scripts/tap_sync.py comments accordingly.
- Day 4–7
  - Run a controlled full re-sync (TAP_PHASE_START_ISO unset) and confirm added counts if missing historical rows exist.
  - Implement minimal integration tests: mock Bybit relay responses and assert tap_sync handles closed/open flows.

30-day plan (milestones)
- Week 2–4
  - Hardening: move secrets to vault; ensure long-term rotation plan.
  - Observability: add Prometheus-style metrics or at least structured JSON lines to logs for key metrics (added, skipped, total_synced, rc). Ship to central logging.
  - Deploy health-check alerting: on error>0 or missing_count > threshold, create task in dashboard + Telegram alert.
  - Product tasks: prioritize backlog TASK-001..006 from tony_ops_dashboard.html (visible in reports/tony_ops_dashboard.html).

Actionable checklist & suggested tasks/PRs
1) Security / housekeeping (high priority)
   - [ ] Move .leo.env → secret manager (Vault/Env configs). Remove TAP_TOKEN, BYBIT_API_SECRET, BYBIT_API_KEY from repo. (PR: add .leo.env.sample, update README)
   - [ ] Replace reports/tap_exchange_connections.json with an example file and remove plaintext keys.
2) Relay & infra (high)
   - [ ] Get relay operator contact and request access to logs for the last 7 days.
   - [ ] Add health probe for relay URL; fail-open policy for tap_sync to avoid stalls.
3) Automation / monitoring (medium)
   - [ ] Add daily cron to run scripts/tap_health_check.py and commit minimal wrapper script scripts/run_tap_health_cron.sh plus systemd/cron entry in docs.
   - [ ] Add small CI test that runs scripts/tap_sync.py in "dry"/mock mode (or with BYBIT_SYNC_OPEN=0 and limited pages) to assert no exceptions.
4) Data integrity (medium)
   - [ ] Add a script to compare reports/leo_closed_analysis.csv against reports/tap_sync_state_*.json and produce an anomaly report; run after every sync and attach to nightly report.
5) Product/bug tasks (low→medium)
   - [ ] TASK-001: Fix transition open → closed flow verification (refer to tony_ops_dashboard.html TASK-001)
   - [ ] TASK-002: Aggregate multi-order close into single trade (sync logic/analysis)
   - [ ] TASK-005: Stability check for autosync discrepancies (monitoring + repro)

Exact small PR suggestions (developer-ready)
- PR #1: docs/tap-ops/README.md
  - Describe: how tap_sync works, required env vars, how to run health-check locally, and where state files live. Remove secrets from repo.
- PR #2: infra/health-cron
  - Add scripts/run_tap_health_cron.sh and a sample systemd timer/cron entry; add basic notification (append to reports/tap_sync.log and write reports/tap_health_latest.md).
- PR #3: security
  - Add .leo.env.sample and update .gitignore to exclude .leo.env and .bybit-relay-secret; commit changes to README about secrets storage.

Places needing access / clarification
- Relay operator credentials or read-only access to logs (relay.tradinganalyticspro.com).
- Confirmation who owns the TAP_TOKEN (tpro_...) and whether token scope is OK for functions API.
- Decision: keep demo Bybit vs move to live Bybit; if live, obtain/rotate live API keys and verify relay supports live endpoints.
- Do we want CI/hosting for daily health-checks? If yes — choose runner (this host or external) and provide permission.

Files referenced (for follow-up)
- scripts/tap_sync.py
- scripts/tap_health_check.py
- scripts/tap_sync_multi.py
- reports/tap_sync.log
- reports/tap_health_latest.md
- reports/tap_sync_state_p_2df415def3.json
- reports/tap_exchange_connections.json
- reports/leo_closed_analysis.csv
- .leo.env
- .bybit-relay-secret
- reports/tony_ops_dashboard.html

What I did now
- Indexed TAP-related scripts, reports, and memory notes in workspace.
- Verified latest health artifact: reports/tap_health_latest.md shows integrity confirmed (683 rows).
- Created this tap_context.md as internal context + actionable checklist.

Next step (ask)
- Shall I: (A) implement PR #3 (move secrets to .leo.env.sample + update .gitignore) as a repository change and open a draft commit? (requires permission), or (B) only prepare the PR content and leave for you to review? Reply with A or B and I'll proceed.

-- End of report
