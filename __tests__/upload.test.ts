import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
}));

import { uploadZip, uploadWithPresignedUrls } from '../src/upload';
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
    // Should not include plural fields when not provided
    expect(receivedBody).not.toContain('name="proxyRuleSetIds"');
    expect(receivedBody).not.toContain('name="proxyRuleSetNames"');

    await new Promise<void>((resolve) =>
      optionalServer.close(() => resolve())
    );
  });

  it('should send plural proxy rule set fields as repeated multipart parts on zip upload', async () => {
    let receivedBody = '';
    const pluralServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });
    });

    const pluralPort = await new Promise<number>((resolve) => {
      pluralServer.listen(0, () => {
        const addr = pluralServer.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        }
      });
    });

    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: `http://localhost:${pluralPort}`,
      apiKey: 'test-key',
      repository: 'test-owner/test-repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      proxyRuleSetNames: ['stripe-webhook', 'ai-proxy'],
      proxyRuleSetIds: ['id-a', 'id-b'],
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    await uploadZip(zipPath, inputs);

    // Two distinct repeated parts, not a single comma-joined value.
    const nameParts = receivedBody.match(/name="proxyRuleSetNames"/g) || [];
    expect(nameParts.length).toBe(2);
    expect(receivedBody).toContain('stripe-webhook');
    expect(receivedBody).toContain('ai-proxy');
    expect(receivedBody).not.toContain('stripe-webhook,ai-proxy');

    const idParts = receivedBody.match(/name="proxyRuleSetIds"/g) || [];
    expect(idParts.length).toBe(2);
    expect(receivedBody).toContain('id-a');
    expect(receivedBody).toContain('id-b');
    expect(receivedBody).not.toContain('id-a,id-b');

    await new Promise<void>((resolve) =>
      pluralServer.close(() => resolve())
    );
  });

  it('should send a single-element plural proxy rule set as exactly one multipart part', async () => {
    let receivedBody = '';
    const singleServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });
    });

    const singlePort = await new Promise<number>((resolve) => {
      singleServer.listen(0, () => {
        const addr = singleServer.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        }
      });
    });

    const inputs: ActionInputs = {
      path: 'dist',
      apiUrl: `http://localhost:${singlePort}`,
      apiKey: 'test-key',
      repository: 'test-owner/test-repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      proxyRuleSetNames: ['stripe-webhook'],
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    await uploadZip(zipPath, inputs);

    const nameParts = receivedBody.match(/name="proxyRuleSetNames"/g) || [];
    expect(nameParts.length).toBe(1);
    expect(receivedBody).toContain('stripe-webhook');
    // No proxyRuleSetIds part should be sent when the input wasn't provided.
    expect(receivedBody).not.toContain('name="proxyRuleSetIds"');

    await new Promise<void>((resolve) =>
      singleServer.close(() => resolve())
    );
  });
});

describe('uploadWithPresignedUrls', () => {
  let tempDir: string;
  let presignedServer: http.Server;
  let presignedPort: number;
  let prepareBody: string;
  let finalizeBody: string;

  const presignedMockResponse: UploadResponse = {
    deploymentId: 'deploy-456',
    repository: 'test-owner/test-repo',
    commitSha: 'abc123',
    branch: 'main',
    fileCount: 1,
    totalSize: 100,
    aliases: [],
    urls: {},
  };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-presigned-test-'));
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<html></html>');

    prepareBody = '';
    finalizeBody = '';

    presignedServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();

        if (req.url === '/api/deployments/prepare-batch-upload') {
          prepareBody = body;
          const parsed = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              presignedUrlsSupported: true,
              uploadToken: 'token-123',
              expiresAt: '2026-01-01T00:00:00Z',
              files: parsed.files.map((f: { path: string }) => ({
                path: f.path,
                presignedUrl: `http://localhost:${presignedPort}/upload/${encodeURIComponent(f.path)}`,
                storageKey: f.path,
              })),
            })
          );
        } else if (req.url === '/api/deployments/finalize-upload') {
          finalizeBody = body;
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(presignedMockResponse));
        } else if (req.method === 'PUT' && req.url?.startsWith('/upload/')) {
          res.writeHead(200);
          res.end();
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    await new Promise<void>((resolve) => {
      presignedServer.listen(0, () => {
        const addr = presignedServer.address();
        if (addr && typeof addr === 'object') {
          presignedPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    await new Promise<void>((resolve) =>
      presignedServer.close(() => resolve())
    );
  });

  it('sends real JSON arrays for plural proxy rule set fields on prepare and finalize', async () => {
    const inputs: ActionInputs = {
      path: tempDir,
      apiUrl: `http://localhost:${presignedPort}`,
      apiKey: 'test-key',
      repository: 'test-owner/test-repo',
      commitSha: 'abc123',
      branch: 'main',
      isPublic: 'true',
      proxyRuleSetNames: ['stripe-webhook', 'ai-proxy'],
      proxyRuleSetIds: ['id-a', 'id-b'],
      summary: true,
      summaryTitle: 'Deployment Summary',
      workingDirectory: '.',
    };

    const result = await uploadWithPresignedUrls(inputs);

    expect(result).not.toBeNull();

    const prepareParsed = JSON.parse(prepareBody);
    expect(prepareParsed.proxyRuleSetNames).toEqual([
      'stripe-webhook',
      'ai-proxy',
    ]);
    expect(prepareParsed.proxyRuleSetIds).toEqual(['id-a', 'id-b']);

    const finalizeParsed = JSON.parse(finalizeBody);
    expect(finalizeParsed.proxyRuleSetNames).toEqual([
      'stripe-webhook',
      'ai-proxy',
    ]);
    expect(finalizeParsed.proxyRuleSetIds).toEqual(['id-a', 'id-b']);
  });
});
