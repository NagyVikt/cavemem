## Why

Colony's `biological-coordination` spec says coordination is stigmergic and advisory: the Queen "publishes structure; never commands," and a claim is a local mark other agents read. Open mode (#591) already turned role walls and claim conflicts into loud, advisory signals. But one signal is still missing: **a file claim records *who* holds a lane, never *why***. `task_claim_file`'s `note` is optional free-text that lands in an observation and is never surfaced back; the structured claim row other agents read is just `{ file_path, held_by }`.

Agents therefore read each other as ownership walls ("X holds this file") instead of shared intent ("X is holding this to make `GET /search` p95 < 200ms"). This change makes the **goal behind a lock first-class** — the `gx /goal` model of an outcome plus a runnable check, attached to the lane — and adds a **lanes view** that answers "who is on what branch, why, and what have they locked."

## What Changes

- `task_claim_file` gains optional `goal` and `check` fields, persisted on the `task_claims` row (not just an observation).
- A contended claim's response carries the **current owner's** `owner_goal` / `owner_check`, so contention explains what the lane is held for.
- Every claim-row-backed read surface (`active_claims`, `attention_inbox` recent claims, `bridge_status` preview, `hivemind_context` local-mode claims) surfaces the goal alongside the owner.
- New `colony lane list` CLI, backed by a reusable `buildLanesSummary` core builder: a per-lane summary keyed on `{ repo_root, branch }` showing `{ agent, goal, check, held_files, now_line }`.
- A goal-less re-claim (e.g. the hook auto-claim path) MUST NOT erase a goal already set on the lane.

Deferred to a follow-up (kept out of scope to keep this a coherent slice and avoid colliding with an in-flight lane that owns the MCP registration surface):
- The `hivemind_lanes` MCP tool (a thin wrapper over `buildLanesSummary`). Its registration changes the canonical tool list asserted in `apps/mcp-server/test/server.test.ts`, which is currently lock-held by an active `mcp-count-schema-tokens` lane. The goal already reaches agents through `contention_detail.owner_goal`, `hivemind_context` local claims, `attention_inbox`, and `bridge_status`, so the dedicated tool is additive, not load-bearing.
- `hivemind_context` global-mode claims (derived from a flat `locked_file_preview` string list, not claim rows) and the PostToolUse contention-awareness push.

## Impact

- **Surfaces:** `task_claim_file` response shape (additive), `hivemind_context` local claims (additive), `attention_inbox` recent claims (additive), `bridge_status` claim preview (additive), new `colony lane list` CLI. Docs: `docs/mcp.md`.
- **Storage:** two additive nullable columns on `task_claims` via the idempotent `COLUMN_MIGRATIONS` mechanism (the same path that added `state`/`expires_at`/`handoff_observation_id` to this table). Forward-only, no backfill.
- **Risk:** low. All fields optional; no hard gate added or removed. The one correctness risk — a goal-less re-claim nulling a set goal — is handled by a `COALESCE` upsert and covered by a regression test.
- **Compat:** existing callers and tests that omit `goal`/`check` keep working unchanged.
