import * as core from '@actions/core';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { FileInfo } from './files';
import {
  PrepareBatchUploadRequest,
  PrepareBatchUploadResponse,
  FinalizeUploadRequest,
  UploadResponse,
} from './types';

/**
 * Request presigned URLs for batch upload
 */
export async function requestPrepareBatchUpload(
  apiUrl: string,
  apiKey: string,
  request: PrepareBatchUploadRequest
): Promise<PrepareBatchUploadResponse> {
  const url = new URL('/api/deployments/prepare-batch-upload', apiUrl);

  core.info(`Requesting presigned URLs for ${request.files.length} files...`);

  const response = await postJson<PrepareBatchUploadResponse>(
    url,
    request,
    apiKey
  );

  return response;
}

/**
 * Finalize a batch upload
 */
export async function finalizeUpload(
  apiUrl: string,
  apiKey: string,
  request: FinalizeUploadRequest
): Promise<UploadResponse> {
  const url = new URL('/api/deployments/finalize-upload', apiUrl);

  core.info('Finalizing upload...');

  const response = await postJson<UploadResponse>(url, request, apiKey);

  return response;
}

/**
 * Upload a file directly to a presigned URL
 */
export async function uploadFileToPresignedUrl(
  presignedUrl: string,
  file: FileInfo
): Promise<void> {
  const url = new URL(presignedUrl);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(file.absolutePath);
    const stats = fs.statSync(file.absolutePath);

    const req = transport.request(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': file.contentType,
          'Content-Length': stats.size,
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          // Consume response body
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            reject(
              new Error(
                `Upload failed for ${file.relativePath}: HTTP ${res.statusCode} - ${body.substring(0, 200)}`
              )
            );
          });
        }
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Upload failed for ${file.relativePath}: ${err.message}`));
    });

    fileStream.pipe(req);
  });
}

/**
 * Upload files in parallel with concurrency limit
 */
export async function uploadFilesWithPresignedUrls(
  files: Array<{ file: FileInfo; presignedUrl: string }>,
  concurrency: number = 10,
  retries: number = 3
): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
  const success: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  // Process files in batches
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async ({ file, presignedUrl }) => {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            await uploadFileToPresignedUrl(presignedUrl, file);
            return file.relativePath;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < retries - 1) {
              // Exponential backoff: 1s, 2s, 4s
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        throw lastError;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        const errorMatch = result.reason.message?.match(/for (.+?):/);
        const path = errorMatch?.[1] || 'unknown';
        failed.push({
          path,
          error: result.reason.message || 'Unknown error',
        });
      }
    }

    // Log progress
    const completed = success.length + failed.length;
    if (completed % 100 === 0 || completed === files.length) {
      core.info(`Upload progress: ${completed}/${files.length} files`);
    }
  }

  return { success, failed };
}

/**
 * POST JSON to an API endpoint
 */
async function postJson<T>(
  url: URL,
  body: unknown,
  apiKey: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'X-API-Key': apiKey,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(responseBody) as T;
              resolve(parsed);
            } catch {
              reject(
                new Error(`Failed to parse response: ${responseBody.substring(0, 200)}`)
              );
            }
          } else {
            reject(
              new Error(
                `API request failed: HTTP ${res.statusCode} - ${responseBody.substring(0, 500)}`
              )
            );
          }
        });
      }
    );

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}
