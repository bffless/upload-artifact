import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWrite, mockAddRaw } = vi.hoisted(() => {
  const mockWrite = vi.fn().mockResolvedValue(undefined);
  const mockAddRaw = vi.fn().mockReturnValue({ write: mockWrite });
  return { mockWrite, mockAddRaw };
});

vi.mock('@actions/core', () => ({
  info: vi.fn(),
  summary: {
    addRaw: mockAddRaw,
  },
}));

import { writeSummary } from '../src/summary';
import { ActionInputs, UploadResponse } from '../src/types';

describe('writeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddRaw.mockReturnValue({ write: mockWrite });
  });

  it('should write summary with all URLs', async () => {
    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: 'https://assets.example.com',
      apiKey: 'key',
      repository: 'owner/repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      alias: 'production',
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    const response: UploadResponse = {
      deploymentId: 'deploy-123',
      repository: 'owner/repo',
      commitSha: 'abc123',
      branch: 'main',
      fileCount: 10,
      totalSize: 54321,
      urls: {
        sha: 'https://assets.example.com/public/owner/repo/abc123/',
        alias:
          'https://assets.example.com/public/owner/repo/alias/production/',
        branch: 'https://assets.example.com/public/owner/repo/branch/main/',
      },
    };

    await writeSummary(inputs, response);

    expect(mockAddRaw).toHaveBeenCalledTimes(1);
    const content = mockAddRaw.mock.calls[0][0] as string;

    expect(content).toContain('## Deployment Summary');
    expect(content).toContain('`abc123`');
    expect(content).toContain('main');
    expect(content).toContain('production');
    expect(content).toContain('10');
    expect(content).toContain('53.05 KB');
    expect(content).toContain('SHA URL');
    expect(content).toContain('Alias URL');
    expect(content).toContain('Branch URL');
    expect(mockWrite).toHaveBeenCalled();
  });

  it('should not write summary when disabled', async () => {
    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: 'https://assets.example.com',
      apiKey: 'key',
      repository: 'owner/repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      summary: false,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    const response: UploadResponse = {
      deploymentId: 'deploy-123',
      repository: 'owner/repo',
      commitSha: 'abc123',
      fileCount: 5,
      totalSize: 1000,
      urls: { sha: 'https://example.com' },
    };

    await writeSummary(inputs, response);

    expect(mockAddRaw).not.toHaveBeenCalled();
  });

  it('should use custom summary title', async () => {
    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: 'https://assets.example.com',
      apiKey: 'key',
      repository: 'owner/repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      summary: true,
      summaryTitle: 'Console UI Deploy',
      workingDirectory: '.',
    };

    const response: UploadResponse = {
      deploymentId: 'deploy-123',
      repository: 'owner/repo',
      commitSha: 'abc123',
      fileCount: 5,
      totalSize: 1000,
      urls: { sha: 'https://example.com' },
    };

    await writeSummary(inputs, response);

    const content = mockAddRaw.mock.calls[0][0] as string;
    expect(content).toContain('## Console UI Deploy');
  });
});
