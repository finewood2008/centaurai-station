/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  fromBackendDirOrFileList,
  fromBackendWorkspaceFlatFiles,
  type RawDirOrFile,
  type RawWorkspaceFlatFile,
} from '@/common/adapter/workspaceMapper';

describe('workspaceMapper', () => {
  it('maps workspace flat files from backend snake_case to frontend camelCase', () => {
    const raw: RawWorkspaceFlatFile[] = [
      {
        name: 'main.ts',
        full_path: '/workspace/src/main.ts',
        relative_path: 'src/main.ts',
      },
    ];

    expect(fromBackendWorkspaceFlatFiles(raw)).toEqual([
      {
        name: 'main.ts',
        fullPath: '/workspace/src/main.ts',
        relativePath: 'src/main.ts',
      },
    ]);
  });

  it('does not leak snake_case path fields', () => {
    const [file] = fromBackendWorkspaceFlatFiles([
      {
        name: 'README.md',
        full_path: '/workspace/README.md',
        relative_path: 'README.md',
      },
    ]);

    expect(file).toBeDefined();
    expect((file as Record<string, unknown>).full_path).toBeUndefined();
    expect((file as Record<string, unknown>).relative_path).toBeUndefined();
    expect(file?.fullPath).toBe('/workspace/README.md');
    expect(file?.relativePath).toBe('README.md');
  });

  // Regression guard: the Content Hub / RecentFiles tree walk reads camelCase
  // (`isFile`/`isDir`/`fullPath`). If `ipcBridge.fs.getFilesByDir` ever loses its
  // `withResponseMap(fromBackendDirOrFileList)` wrapper, `node.isFile` is
  // `undefined` for every node, the walk collects zero files, and the hub renders
  // empty. This has regressed twice — pin the mapping so a merge can't drop it again.
  it('maps the /api/fs/dir tree from snake_case to camelCase, recursively', () => {
    const raw: RawDirOrFile[] = [
      {
        name: 'workspace',
        full_path: '/ws',
        relative_path: '.',
        is_dir: true,
        is_file: false,
        children: [
          {
            name: '方案书.md',
            full_path: '/ws/方案书.md',
            relative_path: '方案书.md',
            is_dir: false,
            is_file: true,
          },
        ],
      },
    ];

    const [dir] = fromBackendDirOrFileList(raw);
    expect(dir?.isDir).toBe(true);
    expect(dir?.isFile).toBe(false);
    expect(dir?.fullPath).toBe('/ws');
    const child = dir?.children?.[0];
    expect(child?.isFile).toBe(true);
    expect(child?.fullPath).toBe('/ws/方案书.md');
    // No snake_case fields leak through to break camelCase consumers.
    expect((child as Record<string, unknown>).is_file).toBeUndefined();
    expect((child as Record<string, unknown>).full_path).toBeUndefined();
  });

  it('tolerates a non-array /api/fs/dir payload without throwing', () => {
    expect(fromBackendDirOrFileList(undefined as unknown as RawDirOrFile[])).toEqual([]);
  });
});
