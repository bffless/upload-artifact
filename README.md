# bffless/upload-artifact

GitHub Action to zip and upload build artifacts to a [BFFLESS](https://bffless.com) static asset hosting platform.

## Quick Start

```yaml
- uses: bffless/upload-artifact@v1
  with:
    path: apps/frontend/dist
    api-url: ${{ vars.ASSET_HOST_URL }}
    api-key: ${{ secrets.ASSET_HOST_KEY }}
```

## Examples

### PR Preview

```yaml
- uses: bffless/upload-artifact@v1
  with:
    path: apps/console-ui/dist
    api-url: ${{ vars.ASSET_HOST_URL }}
    api-key: ${{ secrets.ASSET_HOST_KEY }}
    alias: preview
    description: 'PR #${{ github.event.pull_request.number }} preview'
    proxy-rule-set-name: controlplane
```

### Production Deploy

```yaml
- uses: bffless/upload-artifact@v1
  id: deploy
  with:
    path: apps/frontend/dist
    api-url: ${{ vars.ASSET_HOST_URL }}
    api-key: ${{ secrets.ASSET_HOST_KEY }}
    alias: production
    tags: ${{ needs.release.outputs.version }}
    description: 'Release ${{ needs.release.outputs.version }}'

- run: echo "Deployed to ${{ steps.deploy.outputs.sha-url }}"
```

### Docs Site

```yaml
- uses: bffless/upload-artifact@v1
  with:
    path: build
    api-url: ${{ vars.ASSET_HOST_URL }}
    api-key: ${{ secrets.ASSET_HOST_KEY }}
    alias: docs-production
    base-path: /docs/build
```

### Using Outputs

```yaml
- uses: bffless/upload-artifact@v1
  id: upload
  with:
    path: dist
    api-url: ${{ vars.ASSET_HOST_URL }}
    api-key: ${{ secrets.ASSET_HOST_KEY }}

- run: |
    echo "SHA URL: ${{ steps.upload.outputs.sha-url }}"
    echo "Files: ${{ steps.upload.outputs.file-count }}"
    echo "Size: ${{ steps.upload.outputs.total-size }}"
```

## Inputs

| Input                 | Required | Default                | Description                           |
| --------------------- | -------- | ---------------------- | ------------------------------------- |
| `path`                | **yes**  | --                     | Build directory to zip and upload     |
| `api-url`             | **yes**  | --                     | Base URL of the BFFLESS platform      |
| `api-key`             | **yes**  | --                     | API key (`X-API-Key` header)          |
| `repository`          | no       | `github.repository`    | Repository in `owner/repo` format     |
| `commit-sha`          | no       | auto                   | Git commit SHA (PR head or push SHA)  |
| `branch`              | no       | auto                   | Branch name (PR head ref or push ref) |
| `is-public`           | no       | `'true'`               | Public visibility                     |
| `alias`               | no       | --                     | Deployment alias (e.g., `production`) |
| `base-path`           | no       | `/<path>`              | Path prefix in zip                    |
| `committed-at`        | no       | auto via `git log`     | ISO 8601 commit timestamp             |
| `description`         | no       | --                     | Human-readable description            |
| `proxy-rule-set-name` | no       | --                     | Proxy rule set name                   |
| `proxy-rule-set-id`   | no       | --                     | Proxy rule set ID                     |
| `tags`                | no       | --                     | Comma-separated tags                  |
| `summary`             | no       | `'true'`               | Write GitHub Step Summary             |
| `summary-title`       | no       | `'Deployment Summary'` | Summary heading                       |
| `working-directory`   | no       | `'.'`                  | Working directory for relative paths  |

Only 3 required inputs. Everything else auto-derives from GitHub context.

## Outputs

| Output           | Description                          |
| ---------------- | ------------------------------------ |
| `deployment-url` | Primary URL (SHA-based)              |
| `sha-url`        | Immutable SHA-based URL              |
| `alias-url`      | Alias-based URL                      |
| `preview-url`    | Preview URL (if basePath provided)   |
| `branch-url`     | Branch-based URL                     |
| `deployment-id`  | API deployment ID                    |
| `file-count`     | Number of files uploaded             |
| `total-size`     | Total bytes                          |
| `response`       | Raw JSON response for custom parsing |

## How It Works

1. **Validates** the build directory exists and is non-empty
2. **Zips** the directory preserving the path structure (`path: apps/frontend/dist` creates zip containing `apps/frontend/dist/...`)
3. **Uploads** the zip via multipart POST to `/api/deployments/zip`
4. **Sets outputs** from the API response (URLs, deployment ID, file count)
5. **Writes a Step Summary** with a formatted table of deployment info
6. **Cleans up** the temporary zip file

### Auto-Detection

- **Repository**: from `github.repository`
- **Commit SHA**: PR events use `pull_request.head.sha`, push events use `github.sha`
- **Branch**: PR events use `pull_request.head.ref`, push events strip `refs/heads/` from `github.ref`
- **Committed At**: runs `git log -1 --format=%cI <sha>` (requires `fetch-depth: 0` in checkout)
- **Base Path**: auto-derived as `/<path>` input value

## License

See [LICENSE.md](LICENSE.md).
