import * as core from '@actions/core';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import FormData from 'form-data';
import { URL } from 'url';
import { ActionInputs, UploadResponse, UploadResult } from './types';
import { walkDirectory, validateDirectory, FileInfo } from './files';
import {
  requestPrepareBatchUpload,
  uploadFilesWithPresignedUrls,
  finalizeUpload,
} from './api';

/**
 * Upload files using presigned URLs (direct to storage)
 * Returns null if presigned URLs are not supported (fallback to ZIP upload)
 */
export async function uploadWithPresignedUrls(
  inputs: ActionInputs
): Promise<UploadResult | null> {
  // Validate and resolve directory
  const resolvedPath = validateDirectory(inputs.path, inputs.workingDirectory);

  core.info(`Scanning directory: ${resolvedPath}`);

  // Walk directory and collect files
  const files = await walkDirectory(resolvedPath, inputs.path);

  if (files.length === 0) {
    throw new Error('No files found to upload');
  }

  core.info(`Found ${files.length} files to upload`);

  // Request presigned URLs
  const prepareResponse = await requestPrepareBatchUpload(
    inputs.apiUrl,
    inputs.apiKey,
    {
      repository: inputs.repository,
      commitSha: inputs.commitSha,
      branch: inputs.branch,
      alias: inputs.alias,
      basePath: inputs.basePath,
      description: inputs.description,
      tags: inputs.tags,
      proxyRuleSetName: inputs.proxyRuleSetName,
      proxyRuleSetId: inputs.proxyRuleSetId,
      files: files.map((f) => ({
        path: f.relativePath,
        size: f.size,
        contentType: f.contentType,
      })),
    }
  );

  // Check if presigned URLs are supported
  if (!prepareResponse.presignedUrlsSupported) {
    core.info('Storage does not support presigned URLs, falling back to ZIP upload');
    return null;
  }

  if (!prepareResponse.files || !prepareResponse.uploadToken) {
    throw new Error('Invalid response from prepare-batch-upload');
  }

  core.info(
    `Received ${prepareResponse.files.length} presigned URLs (expires: ${prepareResponse.expiresAt})`
  );

  // Create lookup map for presigned URLs
  const urlMap = new Map(
    prepareResponse.files.map((f) => [f.path, f.presignedUrl])
  );

  // Match files with presigned URLs
  const filesToUpload = files.map((file) => {
    const presignedUrl = urlMap.get(file.relativePath);
    if (!presignedUrl) {
      throw new Error(`No presigned URL for file: ${file.relativePath}`);
    }
    return { file, presignedUrl };
  });

  // Upload files in parallel
  core.info('Uploading files directly to storage...');
  const uploadResults = await uploadFilesWithPresignedUrls(filesToUpload, 10, 3);

  if (uploadResults.failed.length > 0) {
    core.warning(
      `${uploadResults.failed.length} files failed to upload:\n` +
        uploadResults.failed.slice(0, 10).map((f) => `  - ${f.path}: ${f.error}`).join('\n')
    );

    if (uploadResults.failed.length > uploadResults.success.length) {
      throw new Error(
        `Too many upload failures: ${uploadResults.failed.length}/${files.length}`
      );
    }
  }

  core.info(`Successfully uploaded ${uploadResults.success.length} files`);

  // Finalize upload
  const response = await finalizeUpload(inputs.apiUrl, inputs.apiKey, {
    uploadToken: prepareResponse.uploadToken,
  });

  core.info('Upload finalized successfully');
  core.info(`Deployment ID: ${response.deploymentId}`);
  core.info(`Files: ${response.fileCount}`);
  core.info(`Total size: ${response.totalSize} bytes`);

  if (response.urls.sha) {
    core.info(`SHA URL: ${response.urls.sha}`);
  }
  if (response.urls.preview) {
    core.info(`Preview URL: ${response.urls.preview}`);
  }

  return {
    response,
    httpStatus: 201,
  };
}

export async function uploadZip(
  zipPath: string,
  inputs: ActionInputs
): Promise<UploadResult> {
  const url = new URL('/api/deployments/zip', inputs.apiUrl);

  core.info(`Uploading to ${url.toString()}...`);

  const form = new FormData();

  form.append('file', fs.createReadStream(zipPath), {
    filename: path.basename(zipPath),
    contentType: 'application/zip',
  });

  form.append('repository', inputs.repository);
  form.append('commitSha', inputs.commitSha);
  form.append('branch', inputs.branch);
  form.append('isPublic', inputs.isPublic);

  if (inputs.alias) {
    form.append('alias', inputs.alias);
  }
  if (inputs.basePath) {
    form.append('basePath', inputs.basePath);
  }
  if (inputs.committedAt) {
    form.append('committedAt', inputs.committedAt);
  }
  if (inputs.description) {
    form.append('description', inputs.description);
  }
  if (inputs.proxyRuleSetName) {
    form.append('proxyRuleSetName', inputs.proxyRuleSetName);
  }
  if (inputs.proxyRuleSetId) {
    form.append('proxyRuleSetId', inputs.proxyRuleSetId);
  }
  if (inputs.tags) {
    form.append('tags', inputs.tags);
  }

  const response = await postForm(url, form, inputs.apiKey);

  if (response.httpStatus !== 201) {
    throw new Error(
      `Upload failed with HTTP ${response.httpStatus}: ${JSON.stringify(response.response)}`
    );
  }

  core.info(`Upload successful (HTTP ${response.httpStatus})`);
  core.info(`Deployment ID: ${response.response.deploymentId}`);
  core.info(`Files: ${response.response.fileCount}`);
  core.info(`Total size: ${response.response.totalSize} bytes`);

  if (response.response.urls.sha) {
    core.info(`SHA URL: ${response.response.urls.sha}`);
  }
  if (response.response.urls.alias) {
    core.info(`Alias URL: ${response.response.urls.alias}`);
  }
  if (response.response.urls.preview) {
    core.info(`Preview URL: ${response.response.urls.preview}`);
  }
  if (response.response.urls.branch) {
    core.info(`Branch URL: ${response.response.urls.branch}`);
  }

  return response;
}

function postForm(
  url: URL,
  form: FormData,
  apiKey: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const headers = {
      ...form.getHeaders(),
      'X-API-Key': apiKey,
    };

    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request(
      url,
      {
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          let parsed: UploadResponse;
          try {
            parsed = JSON.parse(body);
          } catch {
            reject(
              new Error(
                `Failed to parse response (HTTP ${res.statusCode}): ${body}`
              )
            );
            return;
          }
          resolve({
            response: parsed,
            httpStatus: res.statusCode || 0,
          });
        });
      }
    );

    req.on('error', reject);

    form.pipe(req);
  });
}
