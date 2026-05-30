import * as core from '@actions/core';
import { ActionInputs } from './types';
import { deriveContext } from './context';

// The BFFless serving layer only strips leading/trailing slashes when normalizing
// the alias basePath. "./" or "." survive that and get prepended literally to every
// asset lookup, breaking all requests. Rewrite them to "/" so the alias ends up with
// an empty prefix, which is what users mean when they pass "./".
export function normalizeBasePath(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === './' || trimmed === '.') {
    core.warning(
      `base-path: "${raw}" is being rewritten to "/" because the BFFless serving layer does not normalize "./" and would 404 on every request. Update your workflow to use "/" explicitly.`,
    );
    return '/';
  }
  return trimmed;
}

export function getInputs(): ActionInputs {
  const path = core.getInput('path', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const apiKey = core.getInput('api-key', { required: true });
  core.setSecret(apiKey);
  const workingDirectory = core.getInput('working-directory') || '.';

  const context = deriveContext();

  const repository = core.getInput('repository') || context.repository;
  const commitSha = core.getInput('commit-sha') || context.commitSha;
  const branch = core.getInput('branch') || context.branch;
  const committedAtInput = core.getInput('committed-at') || context.committedAt;

  const isPublic = core.getInput('is-public') || 'true';
  const alias = core.getInput('alias') || undefined;
  const basePathInput = core.getInput('base-path');
  const basePath = basePathInput
    ? normalizeBasePath(basePathInput)
    : `/${path}`;
  const description = core.getInput('description') || undefined;
  const proxyRuleSetName = core.getInput('proxy-rule-set-name') || undefined;
  const proxyRuleSetId = core.getInput('proxy-rule-set-id') || undefined;
  const tags = core.getInput('tags') || undefined;

  const summaryInput = core.getInput('summary') || 'true';
  const summary = summaryInput.toLowerCase() !== 'false';
  const summaryTitle = core.getInput('summary-title') || 'Deployment Summary';

  const prCommentInput = core.getInput('pr-comment') || 'false';
  const prComment = prCommentInput.toLowerCase() === 'true';
  const commentHeader = core.getInput('comment-header') || undefined;
  const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || undefined;

  return {
    path,
    apiUrl,
    apiKey,
    repository,
    commitSha,
    branch,
    isPublic,
    alias,
    basePath,
    committedAt: committedAtInput,
    description,
    proxyRuleSetName,
    proxyRuleSetId,
    tags,
    summary,
    summaryTitle,
    workingDirectory,
    prComment,
    commentHeader,
    githubToken,
  };
}
