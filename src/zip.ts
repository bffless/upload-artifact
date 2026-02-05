import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

export interface ZipResult {
  zipPath: string;
  fileCount: number;
}

export async function createZip(
  buildPath: string,
  workingDirectory: string
): Promise<ZipResult> {
  const resolvedPath = path.resolve(workingDirectory, buildPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Build directory does not exist: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  const contents = fs.readdirSync(resolvedPath);
  if (contents.length === 0) {
    throw new Error(`Build directory is empty: ${resolvedPath}`);
  }

  const zipPath = path.join(
    workingDirectory,
    `upload-artifact-${Date.now()}.zip`
  );

  core.info(`Creating zip from ${resolvedPath}...`);

  const fileCount = await new Promise<number>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    let count = 0;

    output.on('close', () => resolve(count));
    archive.on('error', (err) => reject(err));
    archive.on('entry', () => {
      count++;
    });

    archive.pipe(output);

    // Preserve the directory structure: buildPath/... inside the zip
    // e.g., path: "apps/console-ui/dist" creates zip with apps/console-ui/dist/...
    archive.directory(resolvedPath, buildPath);
    archive.finalize();
  });

  const zipStat = fs.statSync(zipPath);
  core.info(
    `Created zip: ${zipPath} (${fileCount} files, ${formatBytes(zipStat.size)})`
  );

  return { zipPath, fileCount };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
