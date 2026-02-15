import { FileInfo } from './files';
import { PrepareBatchUploadRequest, PrepareBatchUploadResponse, FinalizeUploadRequest, UploadResponse } from './types';
/**
 * Request presigned URLs for batch upload
 */
export declare function requestPrepareBatchUpload(apiUrl: string, apiKey: string, request: PrepareBatchUploadRequest): Promise<PrepareBatchUploadResponse>;
/**
 * Finalize a batch upload
 */
export declare function finalizeUpload(apiUrl: string, apiKey: string, request: FinalizeUploadRequest): Promise<UploadResponse>;
/**
 * Upload a file directly to a presigned URL
 */
export declare function uploadFileToPresignedUrl(presignedUrl: string, file: FileInfo): Promise<void>;
/**
 * Upload files in parallel with concurrency limit
 */
export declare function uploadFilesWithPresignedUrls(files: Array<{
    file: FileInfo;
    presignedUrl: string;
}>, concurrency?: number, retries?: number): Promise<{
    success: string[];
    failed: Array<{
        path: string;
        error: string;
    }>;
}>;
