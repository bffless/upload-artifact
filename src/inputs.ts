import * as core from '@actions/core';
import { ActionInputs } from './types';
import { deriveContext } from './context';

export function getInputs(): ActionInputs {
  const path = core.getInput('path', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const apiKey = core.getInput('api-key', { required: true });
  const workingDirectory = core.getInput('working-directory') || '.';

  const context = deriveContext();

  const repository = core.getInput('repository') || context.repository;
  const commitSha = core.getInput('commit-sha') || context.commitSha;
  const branch = core.getInput('branch') || context.branch;
  const committedAtInput = core.getInput('committed-at') || context.committedAt;

  const isPublic = core.getInput('is-public') || 'true';
  const alias = core.getInput('alias') || undefined;
  const basePathInput = core.getInput('base-path');
  const basePath = basePathInput || `/${path}`;
  const description = core.getInput('description') || undefined;
  const proxyRuleSetName = core.getInput('proxy-rule-set-name') || undefined;
  const proxyRuleSetId = core.getInput('proxy-rule-set-id') || undefined;
  const tags = core.getInput('tags') || undefined;

  const summaryInput = core.getInput('summary') || 'true';
  const summary = summaryInput.toLowerCase() !== 'false';
  const summaryTitle = core.getInput('summary-title') || 'Deployment Summary';

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
  };
}
