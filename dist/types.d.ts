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
export interface DeploymentUrls {
    sha?: string;
    alias?: string;
    preview?: string;
    branch?: string;
}
export interface UploadResponse {
    deploymentId: string;
    repository?: string;
    commitSha: string;
    branch?: string;
    fileCount: number;
    totalSize: number;
    aliases?: string[];
    urls: DeploymentUrls;
}
export interface UploadResult {
    response: UploadResponse;
    httpStatus: number;
}
