import * as core from '@actions/core';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import FormData from 'form-data';
import { URL } from 'url';
import { ActionInputs, UploadResponse, UploadResult } from './types';

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
