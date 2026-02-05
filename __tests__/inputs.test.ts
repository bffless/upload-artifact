import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @actions/core before importing
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock @actions/github
vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    sha: 'abc123def456',
    ref: 'refs/heads/main',
    eventName: 'push',
    payload: {},
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(() => '2026-01-15T10:30:00-05:00'),
}));

import * as core from '@actions/core';
import { getInputs } from '../src/inputs';

describe('getInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse required inputs', () => {
    const mockGetInput = vi.mocked(core.getInput);
    mockGetInput.mockImplementation((name: string, options?: { required?: boolean }) => {
      const inputs: Record<string, string> = {
        'path': 'apps/frontend/dist',
        'api-url': 'https://assets.example.com',
        'api-key': 'test-key-123',
        'working-directory': '.',
      };
      return inputs[name] || '';
    });

    const result = getInputs();

    expect(result.path).toBe('apps/frontend/dist');
    expect(result.apiUrl).toBe('https://assets.example.com');
    expect(result.apiKey).toBe('test-key-123');
    expect(result.repository).toBe('test-owner/test-repo');
    expect(result.commitSha).toBe('abc123def456');
    expect(result.branch).toBe('main');
    expect(result.isPublic).toBe('true');
    expect(result.summary).toBe(true);
  });

  it('should auto-derive basePath from path', () => {
    const mockGetInput = vi.mocked(core.getInput);
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'path': 'apps/console-ui/dist',
        'api-url': 'https://assets.example.com',
        'api-key': 'test-key-123',
      };
      return inputs[name] || '';
    });

    const result = getInputs();
    expect(result.basePath).toBe('/apps/console-ui/dist');
  });

  it('should use explicit basePath when provided', () => {
    const mockGetInput = vi.mocked(core.getInput);
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'path': 'apps/console-ui/dist',
        'api-url': 'https://assets.example.com',
        'api-key': 'test-key-123',
        'base-path': '/custom/path',
      };
      return inputs[name] || '';
    });

    const result = getInputs();
    expect(result.basePath).toBe('/custom/path');
  });

  it('should parse optional inputs', () => {
    const mockGetInput = vi.mocked(core.getInput);
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'path': 'dist',
        'api-url': 'https://assets.example.com',
        'api-key': 'key',
        'alias': 'production',
        'description': 'Test deployment',
        'proxy-rule-set-name': 'controlplane',
        'tags': 'v1.0.0',
        'summary': 'false',
      };
      return inputs[name] || '';
    });

    const result = getInputs();
    expect(result.alias).toBe('production');
    expect(result.description).toBe('Test deployment');
    expect(result.proxyRuleSetName).toBe('controlplane');
    expect(result.tags).toBe('v1.0.0');
    expect(result.summary).toBe(false);
  });

  it('should use explicit overrides for repository, sha, branch', () => {
    const mockGetInput = vi.mocked(core.getInput);
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'path': 'dist',
        'api-url': 'https://assets.example.com',
        'api-key': 'key',
        'repository': 'custom-org/custom-repo',
        'commit-sha': 'custom-sha-999',
        'branch': 'feature-branch',
      };
      return inputs[name] || '';
    });

    const result = getInputs();
    expect(result.repository).toBe('custom-org/custom-repo');
    expect(result.commitSha).toBe('custom-sha-999');
    expect(result.branch).toBe('feature-branch');
  });
});
