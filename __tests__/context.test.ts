import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockContext = vi.hoisted(() => ({
  repo: { owner: 'test-owner', repo: 'test-repo' },
  sha: 'push-sha-123456',
  ref: 'refs/heads/main',
  eventName: 'push' as string,
  payload: {} as Record<string, unknown>,
}));

vi.mock('@actions/core', () => ({
  warning: vi.fn(),
}));

vi.mock('@actions/github', () => ({
  context: mockContext,
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => '2026-01-15T10:30:00-05:00'),
}));

import { execSync } from 'child_process';
import { deriveContext } from '../src/context';

describe('deriveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to push event
    mockContext.eventName = 'push';
    mockContext.sha = 'push-sha-123456';
    mockContext.ref = 'refs/heads/main';
    mockContext.payload = {};
  });

  it('should derive context from push event', () => {
    const context = deriveContext();

    expect(context.repository).toBe('test-owner/test-repo');
    expect(context.commitSha).toBe('push-sha-123456');
    expect(context.branch).toBe('main');
    expect(context.committedAt).toBe('2026-01-15T10:30:00-05:00');
  });

  it('should strip refs/heads/ prefix from branch', () => {
    mockContext.ref = 'refs/heads/feature/my-branch';

    const context = deriveContext();
    expect(context.branch).toBe('feature/my-branch');
  });

  it('should derive context from pull_request event', () => {
    mockContext.eventName = 'pull_request';
    mockContext.payload = {
      pull_request: {
        head: {
          sha: 'pr-head-sha-789',
          ref: 'feature/awesome',
        },
      },
    };

    const context = deriveContext();

    expect(context.commitSha).toBe('pr-head-sha-789');
    expect(context.branch).toBe('feature/awesome');
  });

  it('should handle git log failure gracefully', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('fatal: bad object');
    });

    const context = deriveContext();

    expect(context.committedAt).toBeUndefined();
    expect(context.repository).toBe('test-owner/test-repo');
    expect(context.commitSha).toBe('push-sha-123456');
  });
});
