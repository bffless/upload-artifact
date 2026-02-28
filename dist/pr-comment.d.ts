import { ActionInputs, UploadResponse } from './types';
/**
 * Post or update a PR comment with deployment details
 */
export declare function writePrComment(inputs: ActionInputs, response: UploadResponse): Promise<void>;
