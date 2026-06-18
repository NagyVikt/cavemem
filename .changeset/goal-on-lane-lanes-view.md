---
'@colony/storage': minor
'@colony/core': minor
'@colony/mcp-server': minor
'colonyq': minor
---

feat(coordination): goal-on-lane + lanes view

File claims now carry an optional `goal` and `check` (gx /goal style), persisted on the
claim row and surfaced wherever the claim's owner is shown — `active_claims`,
`attention_inbox` recent claims, `bridge_status`, `hivemind_context` local claims, and a
contended claim's `contention_detail.owner_goal`/`owner_check`. A new `colony lane list`
CLI (backed by a reusable `buildLanesSummary` core builder) summarizes one lane per branch
with its agent, stated goal, held files, and activity line. A goal-less re-claim (e.g. the
hook auto-claim path) preserves an already-set goal via a COALESCE upsert.
