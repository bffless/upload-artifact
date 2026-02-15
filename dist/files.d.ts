export interface FileInfo {
    /** Absolute path to the file */
    absolutePath: string;
    /** Relative path from the base directory (used as the deployment path) */
    relativePath: string;
    /** File size in bytes */
    size: number;
    /** MIME type */
    contentType: string;
}
/**
 * Recursively walk a directory and collect all files
 * Skips hidden files and system files
 */
export declare function walkDirectory(dirPath: string, basePath: string): Promise<FileInfo[]>;
/**
 * Validate that a directory exists and is not empty
 */
export declare function validateDirectory(dirPath: string, workingDirectory: string): string;
