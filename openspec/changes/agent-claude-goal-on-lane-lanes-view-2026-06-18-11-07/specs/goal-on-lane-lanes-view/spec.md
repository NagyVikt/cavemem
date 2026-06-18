## ADDED Requirements

### Requirement: File Claims Carry An Optional Goal And Check

`task_claim_file` SHALL accept optional `goal` and `check` strings and persist them on the claim row, so the intent behind a lane lock is a durable, structured field rather than free-text in an observation.

#### Scenario: agent claims a file with a goal

- **WHEN** an agent calls `task_claim_file` with `goal` and `check`
- **THEN** the values are stored on the `task_claims` row for that `(task_id, file_path)`
- **AND** they are returned by the structured claim reader (`active_claims`) alongside `held_by`

#### Scenario: claim without a goal stays valid

- **WHEN** an agent (or the hook auto-claim path) claims a file with no `goal`
- **THEN** the claim succeeds with `goal` and `check` null
- **AND** no surface emits placeholder or noise text for the absent goal

### Requirement: Contention Reveals The Owner's Goal

When a claim is contended in open mode, the response SHALL include the current owner's goal so the contender learns what the lane is held for, not only who holds it.

#### Scenario: contended claim surfaces owner goal

- **WHEN** a second session claims a file already held by an active owner whose claim has a `goal`
- **THEN** the `contention_detail` payload includes `owner_goal` (and `owner_check` when present) drawn from the owner's claim row
- **AND** the existing `owner_session_id` / `owner_agent` fields are unchanged

### Requirement: A Goal Survives A Goal-less Re-claim

A re-claim of an already-claimed file that omits `goal` SHALL preserve the goal already recorded on the lane, so automatic re-claims do not erase an agent's stated intent.

#### Scenario: hook re-claim preserves the goal

- **WHEN** a file already has a stored `goal` and is re-claimed by a call that omits `goal`
- **THEN** the stored `goal` and `check` are retained on the row
- **AND** the claim's ownership and freshness are still updated to the latest claimer

### Requirement: Lanes View Summarizes Goals Per Branch

Colony SHALL expose a compact lanes view, as a CLI command backed by a reusable core builder, that lists active lanes keyed on `{ repo_root, branch }` with the agent, its stated goal, the files it has locked, and its current activity line.

#### Scenario: lanes view lists a working lane

- **WHEN** an agent is live on a branch and holds claims with a goal
- **THEN** `colony lane list` (via the `buildLanesSummary` core builder) returns one lane for that branch
- **AND** the lane includes `agent`, `goal`, `held_files`, and a `now_line` derived from the live working note or activity summary

#### Scenario: lanes view is read-only

- **WHEN** the lanes view is queried
- **THEN** it only reads coordination state and never mutates claims, tasks, or sessions
