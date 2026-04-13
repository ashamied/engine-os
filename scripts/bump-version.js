const fs = require('fs');
const path = require('path');

// process.cwd() always returns project root on Vercel
const pagePath = path.join(process.cwd(), 'src', 'app', 'page.js');

let content;
try {
  content = fs.readFileSync(pagePath, 'utf8');
} catch(e) {
  console.log('⚠ Could not read page.js at:', pagePath, '— skipping version bump');
  process.exit(0);
}

const match = content.match(/const VERSION = 'v(\d+)\.(\d+)\.(\d+)'/);
if (match) {
  const [, major, minor, patch] = match;
  const newVersion = `v${major}.${minor}.${parseInt(patch) + 1}`;
  content = content.replace(`const VERSION = 'v${major}.${minor}.${patch}'`, `const VERSION = '${newVersion}'`);
  fs.writeFileSync(pagePath, content);
  console.log(`✓ Version bumped to ${newVersion}`);
} else {
  console.log('⚠ No semver VERSION found — skipping bump');
}
