import * as fs from "fs";
import * as path from "path";
import * as mimeTypes from "mime-types";

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
 * The one dot-directory a bundle is allowed to ship: BFFless reads `.bffless/skills`,
 * `.bffless/workflows`, … from a deployment, and the CE zip path keeps it too.
 */
const KEPT_DOT_DIR = ".bffless";

/**
 * Recursively walk a directory and collect all files
 * Skips hidden files and system files (except `.bffless/` directories, at any depth)
 */
export async function walkDirectory(
  dirPath: string,
  basePath: string,
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  await walkRecursive(dirPath, basePath, dirPath, files);
  return files;
}

async function walkRecursive(
  currentPath: string,
  basePath: string,
  rootPath: string,
  files: FileInfo[],
): Promise<void> {
  const entries = await fs.promises.readdir(currentPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    // Skip hidden files and directories — except a `.bffless/` directory, which is
    // where a bundle publishes what BFFless itself reads (skills, workflows).
    if (
      entry.name.startsWith(".") &&
      !(entry.name === KEPT_DOT_DIR && entry.isDirectory())
    ) {
      continue;
    }

    // Skip common system directories
    if (entry.name === "__MACOSX" || entry.name === "node_modules") {
      continue;
    }

    if (entry.isDirectory()) {
      await walkRecursive(fullPath, basePath, rootPath, files);
    } else if (entry.isFile()) {
      const stat = await fs.promises.stat(fullPath);

      // Build relative path that preserves directory structure
      // relativePath includes basePath prefix: e.g., "apps/frontend/dist/index.html"
      const pathFromRoot = path.relative(rootPath, fullPath);
      const relativePath = path
        .join(basePath, pathFromRoot)
        .replace(/\\/g, "/");

      // Detect MIME type
      const contentType =
        mimeTypes.lookup(entry.name) || "application/octet-stream";

      files.push({
        absolutePath: fullPath,
        relativePath,
        size: stat.size,
        contentType,
      });
    }
  }
}

/**
 * Validate that a directory exists and is not empty
 */
export function validateDirectory(
  dirPath: string,
  workingDirectory: string,
): string {
  const resolvedPath = path.resolve(workingDirectory, dirPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory does not exist: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  const contents = fs.readdirSync(resolvedPath);
  if (contents.length === 0) {
    throw new Error(`Directory is empty: ${resolvedPath}`);
  }

  return resolvedPath;
}
