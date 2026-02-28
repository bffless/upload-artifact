import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionInputs, UploadResponse } from './types';

/**
 * Generate a unique marker for this deployment to enable comment updates.
 * Uses alias or basePath to identify the deployment.
 */
function getCommentMarker(inputs: ActionInputs): string {
  const identifier = inputs.alias || inputs.basePath || 'default';
  return `<!-- bffless-deploy:${identifier} -->`;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Build the comment body with deployment details
 */
function buildCommentBody(
  inputs: ActionInputs,
  response: UploadResponse,
  marker: string
): string {
  const header = inputs.commentHeader || '🚀 BFFLESS Deployment';
  const shortSha = response.commitSha.substring(0, 7);

  let body = `${marker}\n## ${header}\n\n`;

  // Add deployment identifier if alias or basePath specified
  if (inputs.alias) {
    body += `**Alias:** \`${inputs.alias}\`\n\n`;
  } else if (inputs.basePath && inputs.basePath !== '/') {
    body += `**Path:** \`${inputs.basePath}\`\n\n`;
  }

  body += `| Property | Value |\n|----------|-------|\n`;

  // Preview URL is the main attraction
  if (response.urls.preview) {
    body += `| **Preview** | [${response.urls.preview}](${response.urls.preview}) |\n`;
  }

  body += `| **Commit** | \`${shortSha}\` |\n`;
  body += `| **Files** | ${response.fileCount} |\n`;
  body += `| **Size** | ${formatBytes(response.totalSize)} |\n`;

  // Add link to admin if SHA URL available
  if (response.urls.sha) {
    body += `\n[View in Admin →](${response.urls.sha})`;
  }

  return body;
}

/**
 * Post or update a PR comment with deployment details
 */
export async function writePrComment(
  inputs: ActionInputs,
  response: UploadResponse
): Promise<void> {
  if (!inputs.prComment) {
    return;
  }

  // Check if we're in a PR context
  const context = github.context;
  const prNumber = context.payload.pull_request?.number;

  if (!prNumber) {
    core.info('Not in a PR context, skipping PR comment');
    return;
  }

  if (!inputs.githubToken) {
    core.warning('No GitHub token provided, cannot post PR comment');
    return;
  }

  const marker = getCommentMarker(inputs);
  const body = buildCommentBody(inputs, response, marker);

  const octokit = github.getOctokit(inputs.githubToken);
  const { owner, repo } = context.repo;

  try {
    // Find existing comment with this marker
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    const existingComment = comments.find(
      (comment) => comment.body?.includes(marker)
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body,
      });
      core.info(`Updated PR comment #${existingComment.id}`);
    } else {
      // Create new comment
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      core.info(`Created PR comment #${newComment.id}`);
    }
  } catch (error) {
    // Don't fail the action if comment fails
    core.warning(
      `Failed to post PR comment: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}