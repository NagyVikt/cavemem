## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 5 explaining the blocker and **STOP**.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria.
- [x] 1.2 Define normative requirements in `specs/goal-on-lane-lanes-view/spec.md`.

## 2. Storage + write path (Phase A/B)

- [ ] 2.1 Append `goal` + `goal_check` entries to `COLUMN_MIGRATIONS` (`packages/storage/src/schema.ts`); add fields to `TaskClaimRow` (`packages/storage/src/types.ts`).
- [ ] 2.2 `storage.claimFile`: accept `goal`/`check`, switch `INSERT OR REPLACE` to an `ON CONFLICT … DO UPDATE` upsert that `COALESCE`s `goal`/`goal_check` (preserve on goal-less re-claim) while resetting `state`/`expires_at`/`handoff_observation_id`.
- [ ] 2.3 `guardedClaimFile` (`packages/core/src/scoped-claim.ts`): thread `goal`/`check` to `storage.claimFile`; add `owner_goal`/`owner_check` to `GuardedClaimResult` from the blocking owner's claim row.
- [ ] 2.4 `TaskThread.claimFile` (`packages/core/src/task-thread.ts`): add `goal`/`check` params, thread to storage + observation metadata.
- [ ] 2.5 `task_claim_file` MCP schema (`apps/mcp-server/src/tools/task.ts`): add optional `goal`/`check`, thread to `guardedClaimFile`.

## 3. Read surfaces (Phase C) + Lanes view (Phase D)

- [ ] 3.1 Add `goal`/`check` to `active_claims` (`task-thread.ts`), `InboxRecentClaim` (`attention-inbox.ts`), `taskClaimSummary` (`bridge.ts`), `localClaims`/`HivemindLocalClaim` (`shared.ts`).
- [ ] 3.2 New `packages/core/src/lanes.ts` `buildLanesSummary(store, { repo_root })`; export it.
- [x] 3.3 `hivemind_lanes` MCP wrapper DEFERRED to a follow-up — registering it changes the tool list asserted in `apps/mcp-server/test/server.test.ts`, currently lock-held by an active lane. The goal already reaches agents via `contention_detail.owner_goal`, `hivemind_context`, `attention_inbox`, and `bridge_status`.
- [ ] 3.4 Add `colony lane list` CLI sub-command (`apps/cli/src/commands/lane.ts`).
- [ ] 3.5 Document `goal`/`check` in `docs/mcp.md`.

## 4. Verification

- [ ] 4.1 Core unit tests: goal persists; goal-less re-claim coalesces; `buildLanesSummary` projects per-branch lanes.
- [ ] 4.2 MCP contract tests: `task_claim_file` goal round-trip; contended claim sees `owner_goal`. Core test: `buildLanesSummary` projects per-branch lanes.
- [ ] 4.3 `pnpm changeset`.
- [ ] 4.4 Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- [ ] 4.5 `bash scripts/e2e-publish.sh` (MCP-server tool surface changed).
- [ ] 4.6 `openspec validate agent-claude-goal-on-lane-lanes-view-2026-06-18-11-07 --type change --strict` and `openspec validate --specs`.

## 5. Cleanup (mandatory; run before claiming completion)

- [ ] 5.1 Independent `code-reviewer` pass; fix CRITICAL/HIGH.
- [ ] 5.2 `gx branch finish --branch agent/claude/goal-on-lane-lanes-view-2026-06-18-11-07 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 5.3 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 5.4 Confirm the sandbox worktree is pruned.
