import * as core from '@actions/core';
import { DefaultArtifactClient } from '@actions/artifact';
import { opendir } from 'node:fs/promises';
import { join } from 'node:path';

try {
  const name = core.getInput('name');
  const options = {
    retentionDays: parseInt(core.getInput('retention-days'))
  };
  const path = core.getInput('path');

  // First find the .diff files
  const files = [];
  const dir = await opendir(path);
  for await (const entry of dir) {
    if (entry.isDirectory() && entry.name.startsWith("test")) {
      const failures = new Set();
      const testdirname = join(path, entry.name);
      const testdir = await opendir(testdirname);
      for await (const diffentry of testdir) {
        const match = diffentry.isFile() && /^((.*)\.[^\.]*)\.diff$/.exec(diffentry.name);
        if (match) {
          failures.add(match[1]).add(match[2]);
        }
      }
      if (failures.size > 0) {
        const testdir = await opendir(testdirname);
        for await (const diffentry of testdir) {
          const match = diffentry.isFile() && /^(.*)\.[^\.]*$/.exec(diffentry.name);
          if (match && failures.has(match[1])) {
            files.push(join(testdirname, diffentry.name));
          }
        }
      }
    }
  }

  if (files.length > 0) {
    const artifact = new DefaultArtifactClient()
    const uploadResponse = await artifact.uploadArtifact(name, files, path, options)
    if (uploadResponse.id === undefined) {
      core.setFailed('Failed to upload some test files. The artifact archive will be incomplete!');
    }
  }
} catch(err) {
  core.setFailed(err.message);
}
