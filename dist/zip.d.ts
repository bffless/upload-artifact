export interface ZipResult {
    zipPath: string;
    fileCount: number;
}
export declare function createZip(buildPath: string, workingDirectory: string): Promise<ZipResult>;
