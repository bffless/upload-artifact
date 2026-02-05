import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
}));

import { createZip } from '../src/zip';

describe('createZip', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should throw if directory does not exist', async () => {
    await expect(createZip('nonexistent', tempDir)).rejects.toThrow(
      'Build directory does not exist'
    );
  });

  it('should throw if path is not a directory', async () => {
    const filePath = path.join(tempDir, 'file.txt');
    fs.writeFileSync(filePath, 'test');

    await expect(createZip('file.txt', tempDir)).rejects.toThrow(
      'Path is not a directory'
    );
  });

  it('should throw if directory is empty', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    fs.mkdirSync(emptyDir);

    await expect(createZip('empty', tempDir)).rejects.toThrow(
      'Build directory is empty'
    );
  });

  it('should create a zip from a directory with files', async () => {
    const buildDir = path.join(tempDir, 'dist');
    fs.mkdirSync(buildDir);
    fs.writeFileSync(path.join(buildDir, 'index.html'), '<html></html>');
    fs.writeFileSync(
      path.join(buildDir, 'app.js'),
      'console.log("hello");'
    );

    const result = await createZip('dist', tempDir);

    expect(result.zipPath).toMatch(/upload-artifact-\d+\.zip$/);
    expect(result.fileCount).toBe(2);
    expect(fs.existsSync(result.zipPath)).toBe(true);

    // Verify zip file has content
    const stat = fs.statSync(result.zipPath);
    expect(stat.size).toBeGreaterThan(0);

    // Clean up
    fs.unlinkSync(result.zipPath);
  });

  it('should create a zip from nested directories', async () => {
    const buildDir = path.join(tempDir, 'apps', 'frontend', 'dist');
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, 'index.html'), '<html></html>');

    const assetsDir = path.join(buildDir, 'assets');
    fs.mkdirSync(assetsDir);
    fs.writeFileSync(path.join(assetsDir, 'style.css'), 'body{}');

    const result = await createZip('apps/frontend/dist', tempDir);

    // archiver counts files only (not directories), so 2 files
    expect(result.fileCount).toBeGreaterThanOrEqual(2);
    expect(fs.existsSync(result.zipPath)).toBe(true);

    // Clean up
    fs.unlinkSync(result.zipPath);
  });
});
