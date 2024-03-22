import core from '@actions/core';
import artifact from '@actions/artifact';
import {opendir} from 'node:fs/promises';
import {join} from 'node:path';

try {
  // replace invalid characters in artifact name with underscore ('_')
  // see https://github.com/actions/toolkit/blob/ef77c9d60bdb03700d7758b0d04b88446e72a896/packages/artifact/src/internal/upload/path-and-artifact-name-validation.ts
  const name = core.getInput('name').replace(/[":<>|*?\r\n\\/]/g, '_');
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
      var testdir = await opendir(testdirname);
      for await (const diffentry of testdir) {
        const match = diffentry.isFile() && /^((.*)\.[^\.]*)\.diff$/.exec(diffentry.name);
        if (match) {
          failures.add(match[1]).add(match[2]);
        }
      }
      if (failures.size > 0) {
        testdir = await opendir(testdirname);
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
    const artifact_client = artifact.create();

    const rootDirectory = path;
    const uploadResponse = await artifact_client.uploadArtifact(name, files, path, options)
    if (uploadResponse.failedItems.length > 0) {
      core.setFailed('Failed to upload some test files. The artifact archive will be incomplete!');
    }
  }
} catch(err) {
  core.setFailed(err.message);
}
