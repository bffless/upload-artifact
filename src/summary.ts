import * as core from '@actions/core';
import { ActionInputs, UploadResponse } from './types';

export async function writeSummary(
  inputs: ActionInputs,
  response: UploadResponse
): Promise<void> {
  if (!inputs.summary) {
    return;
  }

  const rows: [string, string][] = [
    ['Repository', inputs.repository],
    ['Commit SHA', `\`${response.commitSha}\``],
  ];

  if (response.branch) {
    rows.push(['Branch', response.branch]);
  }

  if (inputs.alias) {
    rows.push(['Alias', inputs.alias]);
  }

  rows.push(['Files', String(response.fileCount)]);
  rows.push(['Total Size', formatBytes(response.totalSize)]);

  if (response.urls.sha) {
    rows.push(['SHA URL', response.urls.sha]);
  }
  if (response.urls.alias) {
    rows.push(['Alias URL', response.urls.alias]);
  }
  if (response.urls.preview) {
    rows.push(['Preview URL', response.urls.preview]);
  }
  if (response.urls.branch) {
    rows.push(['Branch URL', response.urls.branch]);
  }

  const tableMarkdown = rows
    .map(([key, value]) => `| **${key}** | ${value} |`)
    .join('\n');

  const summaryContent = `## ${inputs.summaryTitle}

| Property | Value |
|----------|-------|
${tableMarkdown}
`;

  await core.summary.addRaw(summaryContent).write();

  core.info('Step summary written');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
