import * as core from '@actions/core';
import * as fs from 'fs';
import { getInputs } from './inputs';
import { createZip } from './zip';
import { uploadZip, uploadWithPresignedUrls } from './upload';
import { writeSummary } from './summary';
import { UploadResult } from './types';

async function run(): Promise<void> {
  let zipPath: string | undefined;

  try {
    const inputs = getInputs();

    core.info(`Path: ${inputs.path}`);
    core.info(`API URL: ${inputs.apiUrl}`);
    core.info(`Repository: ${inputs.repository}`);
    core.info(`Commit SHA: ${inputs.commitSha}`);
    core.info(`Branch: ${inputs.branch}`);
    if (inputs.alias) core.info(`Alias: ${inputs.alias}`);
    if (inputs.basePath) core.info(`Base Path: ${inputs.basePath}`);
    if (inputs.committedAt) core.info(`Committed At: ${inputs.committedAt}`);
    if (inputs.proxyRuleSetName)
      core.info(`Proxy Rule Set Name: ${inputs.proxyRuleSetName}`);

    // Try presigned URL upload first (more efficient)
    let result: UploadResult | null = null;

    try {
      result = await uploadWithPresignedUrls(inputs);
    } catch (error) {
      // Log but continue to fallback
      core.warning(
        `Presigned URL upload failed, falling back to ZIP: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Fallback to ZIP upload if presigned URLs not supported or failed
    if (!result) {
      core.info('Using ZIP upload method...');

      // Create zip
      const zipResult = await createZip(inputs.path, inputs.workingDirectory);
      zipPath = zipResult.zipPath;

      // Upload
      result = await uploadZip(zipPath, inputs);
    }

    // Set outputs
    const response = result.response;
    core.setOutput('deployment-id', response.deploymentId);
    core.setOutput('file-count', String(response.fileCount));
    core.setOutput('total-size', String(response.totalSize));
    core.setOutput('response', JSON.stringify(response));

    if (response.urls.sha) {
      core.setOutput('deployment-url', response.urls.sha);
      core.setOutput('sha-url', response.urls.sha);
    }
    if (response.urls.alias) {
      core.setOutput('alias-url', response.urls.alias);
    }
    if (response.urls.preview) {
      core.setOutput('preview-url', response.urls.preview);
    }
    if (response.urls.branch) {
      core.setOutput('branch-url', response.urls.branch);
    }

    // Write summary
    await writeSummary(inputs, response);
  } catch (error) {
    core.setFailed(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  } finally {
    // Clean up temp zip
    if (zipPath && fs.existsSync(zipPath)) {
      try {
        fs.unlinkSync(zipPath);
        core.info('Cleaned up temporary zip file');
      } catch {
        core.warning(`Failed to clean up temp zip: ${zipPath}`);
      }
    }
  }
}

run();
