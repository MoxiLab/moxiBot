const { spawnSync } = require('child_process');

function runPatchPackageSilently() {
    let patchPackageEntry;
    try {
        patchPackageEntry = require.resolve('patch-package');
    } catch {
        return 0;
    }

    const result = spawnSync(process.execPath, [patchPackageEntry], {
        stdio: ['ignore', 'ignore', 'inherit'],
        env: process.env,
    });

    return typeof result.status === 'number' ? result.status : 1;
}

const code = runPatchPackageSilently();
process.exit(code);
