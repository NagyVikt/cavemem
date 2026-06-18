import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultSettings } from '@colony/config';
import { MemoryStore, TaskThread } from '@colony/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

let dir: string;
let repoRoot: string;
let store: MemoryStore;
let client: Client;

const settings = {
  ...defaultSettings,
  rejectProtectedBranchClaims: false,
  coordinationMode: 'open' as const,
};

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? '{}';
  return JSON.parse(text) as T;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'colony-goal-on-lane-'));
  repoRoot = mkdtempSync(join(dir, 'repo-'));
  store = new MemoryStore({ dbPath: join(dir, 'data.db'), settings });
  const server = buildServer(store, settings);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('goal-on-lane', () => {
  it('persists goal and check from an MCP task_claim_file onto the claim row', async () => {
    store.startSession({ id: 'A', ide: 'claude-code', cwd: repoRoot });
    const thread = TaskThread.open(store, {
      repo_root: repoRoot,
      branch: 'feat/x',
      session_id: 'A',
    });
    thread.join('A', 'claude');

    await call('task_claim_file', {
      task_id: thread.task_id,
      session_id: 'A',
      file_path: 'src/x.ts',
      goal: 'ship the x filter',
      check: 'pnpm test',
    });

    expect(store.storage.getClaim(thread.task_id, 'src/x.ts')).toMatchObject({
      goal: 'ship the x filter',
      goal_check: 'pnpm test',
    });
  });

  it("surfaces the owner's goal when a second session hits contention", async () => {
    store.startSession({ id: 'active-owner', ide: 'claude-code', cwd: repoRoot });
    store.startSession({ id: 'requester', ide: 'codex', cwd: repoRoot });
    const first = TaskThread.open(store, {
      repo_root: repoRoot,
      branch: 'main',
      session_id: 'active-owner',
    });
    first.join('active-owner', 'claude');
    first.claimFile({
      session_id: 'active-owner',
      file_path: 'src/shared.ts',
      goal: 'refactor shared to async',
      check: 'pnpm typecheck',
    });
    const second = TaskThread.open(store, {
      repo_root: repoRoot,
      branch: 'main',
      session_id: 'requester',
    });
    second.join('requester', 'codex');

    const payload = await call<{
      contention: boolean;
      contention_detail: {
        owner_session_id?: string;
        owner_goal?: string;
        owner_check?: string;
      } | null;
    }>('task_claim_file', {
      task_id: second.task_id,
      session_id: 'requester',
      file_path: 'src/shared.ts',
    });

    expect(payload.contention).toBe(true);
    expect(payload.contention_detail?.owner_session_id).toBe('active-owner');
    expect(payload.contention_detail?.owner_goal).toBe('refactor shared to async');
    expect(payload.contention_detail?.owner_check).toBe('pnpm typecheck');
  });
});
