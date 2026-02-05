import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
}));

import { uploadZip } from '../src/upload';
import { ActionInputs, UploadResponse } from '../src/types';

describe('uploadZip', () => {
  let server: http.Server;
  let serverPort: number;
  let tempDir: string;
  let zipPath: string;

  const mockResponse: UploadResponse = {
    deploymentId: 'deploy-123',
    repository: 'test-owner/test-repo',
    commitSha: 'abc123',
    branch: 'main',
    fileCount: 5,
    totalSize: 12345,
    aliases: ['production'],
    urls: {
      sha: 'https://assets.example.com/public/test-owner/test-repo/abc123/',
      alias:
        'https://assets.example.com/public/test-owner/test-repo/alias/production/',
      preview:
        'https://assets.example.com/public/test-owner/test-repo/abc123/apps/frontend/dist/',
      branch:
        'https://assets.example.com/public/test-owner/test-repo/branch/main/',
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    zipPath = path.join(tempDir, 'test.zip');
    fs.writeFileSync(zipPath, 'fake-zip-content');

    // Create a simple HTTP server to receive the upload
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();

        // Verify required headers
        expect(req.headers['x-api-key']).toBe('test-key');
        expect(req.headers['content-type']).toMatch(/^multipart\/form-data/);
        expect(req.method).toBe('POST');
        expect(req.url).toBe('/api/deployments/zip');

        // Verify form fields are present in the multipart body
        expect(body).toContain('repository');
        expect(body).toContain('commitSha');
        expect(body).toContain('branch');
        expect(body).toContain('isPublic');

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should upload zip and return parsed response', async () => {
    const inputs: ActionInputs = {
      path: 'apps/frontend/dist',
      apiUrl: `http://localhost:${serverPort}`,
      apiKey: 'test-key',
      repository: 'test-owner/test-repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      alias: 'production',
      basePath: '/apps/frontend/dist',
      committedAt: '2026-01-15T10:30:00-05:00',
      description: 'Test deployment',
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    const result = await uploadZip(zipPath, inputs);

    expect(result.httpStatus).toBe(201);
    expect(result.response.deploymentId).toBe('deploy-123');
    expect(result.response.fileCount).toBe(5);
    expect(result.response.urls.sha).toContain('abc123');
    expect(result.response.urls.alias).toContain('production');
  });

  it('should throw on non-201 response', async () => {
    // Create a server that returns 400
    const errorServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      });
    });

    const errorPort = await new Promise<number>((resolve) => {
      errorServer.listen(0, () => {
        const addr = errorServer.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        }
      });
    });

    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: `http://localhost:${errorPort}`,
      apiKey: 'test-key',
      repository: 'test-owner/test-repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    await expect(uploadZip(zipPath, inputs)).rejects.toThrow(
      'Upload failed with HTTP 400'
    );

    await new Promise<void>((resolve) => errorServer.close(() => resolve()));
  });

  it('should include optional fields only when provided', async () => {
    let receivedBody = '';

    const optionalServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });
    });

    const optPort = await new Promise<number>((resolve) => {
      optionalServer.listen(0, () => {
        const addr = optionalServer.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        }
      });
    });

    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: `http://localhost:${optPort}`,
      apiKey: 'test-key',
      repository: 'test-owner/test-repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      proxyRuleSetName: 'controlplane',
      tags: 'v1.0.0',
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    await uploadZip(zipPath, inputs);

    expect(receivedBody).toContain('proxyRuleSetName');
    expect(receivedBody).toContain('controlplane');
    expect(receivedBody).toContain('tags');
    expect(receivedBody).toContain('v1.0.0');
    // Should not contain alias or description since they weren't set
    expect(receivedBody).not.toContain('name="alias"');
    expect(receivedBody).not.toContain('name="description"');

    await new Promise<void>((resolve) =>
      optionalServer.close(() => resolve())
    );
  });
});
