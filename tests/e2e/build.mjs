import { execSync } from 'node:child_process';
for (const b of ['chrome', 'firefox']) execSync('npx wxt build -b ' + b, { stdio: 'inherit', env: { ...process.env, FRINGELESS_TEST: '1' } });
