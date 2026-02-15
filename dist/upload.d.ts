import { ActionInputs, UploadResult } from './types';
/**
 * Upload files using presigned URLs (direct to storage)
 * Returns null if presigned URLs are not supported (fallback to ZIP upload)
 */
export declare function uploadWithPresignedUrls(inputs: ActionInputs): Promise<UploadResult | null>;
export declare function uploadZip(zipPath: string, inputs: ActionInputs): Promise<UploadResult>;
