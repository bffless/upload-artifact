import * as core from '@actions/core';
import * as github from '@actions/github';
import { execSync } from 'child_process';
import { GitContext } from './types';

export function deriveContext(): GitContext {
  const { context } = github;
  const repository = context.repo.owner + '/' + context.repo.repo;

  let commitSha: string;
  let branch: string;

  if (context.eventName === 'pull_request' && context.payload.pull_request) {
    commitSha = context.payload.pull_request.head.sha;
    branch = context.payload.pull_request.head.ref;
  } else {
    commitSha = context.sha;
    branch = context.ref.replace('refs/heads/', '');
  }

  const committedAt = getCommittedAt(commitSha);

  return { repository, commitSha, branch, committedAt };
}

function getCommittedAt(sha: string): string | undefined {
  try {
    const result = execSync(`git log -1 --format=%cI ${sha}`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    if (result) {
      return result;
    }
  } catch (error) {
    core.warning(
      `Could not determine commit timestamp for ${sha}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return undefined;
}
