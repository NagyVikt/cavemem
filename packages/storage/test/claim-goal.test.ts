import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Storage } from '../src/index.js';

let dir: string;
let storage: Storage;
let taskId: number;

const FILE = 'packages/storage/src/storage.ts';

function session(id: string): void {
  storage.createSession({ id, ide: 'codex', cwd: '/repo', started_at: 1, metadata: null });
}

function claim() {
  return storage.listClaims(taskId).find((c) => c.file_path === FILE);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'colony-claim-goal-'));
  storage = new Storage(join(dir, 'test.db'));
  const task = storage.findOrCreateTask({
    title: 'goal-on-lane',
    repo_root: '/repo',
    branch: 'agent/codex/goal',
    created_by: 's1',
  });
  taskId = task.id;
  session('s1');
  session('s2');
});

afterEach(() => {
  storage.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('task_claims goal/check', () => {
  it('persists goal and check on the claim row', () => {
    storage.claimFile({
      task_id: taskId,
      file_path: FILE,
      session_id: 's1',
      goal: 'ship the search filter',
      check: 'pnpm --filter @colony/storage test',
    });
    const c = claim();
    expect(c?.goal).toBe('ship the search filter');
    expect(c?.goal_check).toBe('pnpm --filter @colony/storage test');
  });

  it('defaults goal and check to null when unstated', () => {
    storage.claimFile({ task_id: taskId, file_path: FILE, session_id: 's1' });
    const c = claim();
    expect(c?.goal).toBeNull();
    expect(c?.goal_check).toBeNull();
  });

  it('preserves a stated goal across a goal-less re-claim', () => {
    storage.claimFile({
      task_id: taskId,
      file_path: FILE,
      session_id: 's1',
      goal: 'ship the search filter',
      check: 'pnpm test',
    });
    // The hook auto-claim path re-claims edited files with no goal.
    storage.claimFile({ task_id: taskId, file_path: FILE, session_id: 's2' });
    const c = claim();
    expect(c?.session_id).toBe('s2'); // ownership + freshness still move to the latest claimer
    expect(c?.goal).toBe('ship the search filter'); // intent is preserved, not erased
    expect(c?.goal_check).toBe('pnpm test');
  });

  it('overwrites the goal when a re-claim states a new one, keeping unstated fields', () => {
    storage.claimFile({
      task_id: taskId,
      file_path: FILE,
      session_id: 's1',
      goal: 'old goal',
      check: 'old check',
    });
    storage.claimFile({ task_id: taskId, file_path: FILE, session_id: 's2', goal: 'new goal' });
    const c = claim();
    expect(c?.goal).toBe('new goal'); // restated -> replaced
    expect(c?.goal_check).toBe('old check'); // not restated -> preserved
  });
});
