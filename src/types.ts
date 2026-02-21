import { UploadResponse } from '@bffless/artifact-client';

export interface ActionInputs {
  path: string;
  apiUrl: string;
  apiKey: string;
  repository: string;
  commitSha: string;
  branch: string;
  isPublic: string;
  alias?: string;
  basePath?: string;
  committedAt?: string;
  description?: string;
  proxyRuleSetName?: string;
  proxyRuleSetId?: string;
  tags?: string;
  summary: boolean;
  summaryTitle: string;
  workingDirectory: string;
}

export interface GitContext {
  repository: string;
  commitSha: string;
  branch: string;
  committedAt?: string;
}

export interface UploadResult {
  response: UploadResponse;
  httpStatus: number;
}

// Re-export shared types for convenience
export { UploadResponse, DeploymentUrls } from '@bffless/artifact-client';
