import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultSettings } from '@colony/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildLanesSummary } from '../src/lanes.js';
import { MemoryStore } from '../src/memory-store.js';
import { TaskThread } from '../src/task-thread.js';

let dir: string;
let repoRoot: string;
let store: MemoryStore;
let nowMs: number;

const BRANCH = 'agent/claude/goal';

function seedHeartbeat(): void {
  const activeSessionDir = join(repoRoot, '.omx', 'state', 'active-sessions');
  mkdirSync(activeSessionDir, { recursive: true });
  const nowIso = new Date(nowMs).toISOString();
  writeFileSync(
    join(activeSessionDir, 'agent__claude__goal.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      repoRoot,
      branch: BRANCH,
      taskName: 'goal-on-lane',
      agentName: 'claude',
      cliName: 'claude-code',
      sessionKey: 'agent__claude__goal',
      worktreePath: repoRoot,
      startedAt: nowIso,
      lastHeartbeatAt: nowIso,
      state: 'working',
    })}\n`,
    'utf8',
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'colony-lanes-'));
  repoRoot = join(dir, 'repo');
  mkdirSync(repoRoot, { recursive: true });
  nowMs = Date.parse('2026-06-18T10:00:00.000Z');
  store = new MemoryStore({ dbPath: join(dir, 'data.db'), settings: defaultSettings });
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('buildLanesSummary', () => {
  it('projects one lane per branch with its goal, held files, and now line', () => {
    seedHeartbeat();
    store.startSession({ id: 'A', ide: 'claude-code', cwd: repoRoot });
    const thread = TaskThread.open(store, { repo_root: repoRoot, branch: BRANCH, session_id: 'A' });
    thread.join('A', 'claude');
    thread.claimFile({
      session_id: 'A',
      file_path: 'src/a.ts',
      goal: 'make GET /search p95 < 200ms',
      check: 'pnpm bench search',
    });
    // A later, goal-less claim must not hide the stated goal on the lane.
    thread.claimFile({ session_id: 'A', file_path: 'src/b.ts' });

    const summary = buildLanesSummary(store, { repo_root: repoRoot, now: nowMs });

    expect(summary.lane_count).toBe(1);
    const lane = summary.lanes[0];
    expect(lane?.branch).toBe(BRANCH);
    expect(lane?.agent).toBe('claude');
    expect(lane?.goal).toBe('make GET /search p95 < 200ms');
    expect(lane?.check).toBe('pnpm bench search');
    expect([...(lane?.held_files ?? [])].sort()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(lane?.now_line).toBeTruthy();
  });

  it('reports a null goal for a lane that holds files without one', () => {
    seedHeartbeat();
    store.startSession({ id: 'A', ide: 'claude-code', cwd: repoRoot });
    const thread = TaskThread.open(store, { repo_root: repoRoot, branch: BRANCH, session_id: 'A' });
    thread.join('A', 'claude');
    thread.claimFile({ session_id: 'A', file_path: 'src/a.ts' });

    const summary = buildLanesSummary(store, { repo_root: repoRoot, now: nowMs });

    expect(summary.lane_count).toBe(1);
    expect(summary.lanes[0]?.goal).toBeNull();
    expect(summary.lanes[0]?.check).toBeNull();
    expect(summary.lanes[0]?.held_files).toEqual(['src/a.ts']);
  });
});
