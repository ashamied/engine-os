const fs = require('fs');
const path = require('path');

// __dirname is /vercel/path0/scripts — go up one level to reach project root
const pagePath = path.join(__dirname, '..', 'src', 'app', 'page.js');
let content = fs.readFileSync(pagePath, 'utf8');

const match = content.match(/const VERSION = 'v(\d+)\.(\d+)\.(\d+)'/);
if (match) {
  const [, major, minor, patch] = match;
  const newVersion = `v${major}.${minor}.${parseInt(patch) + 1}`;
  content = content.replace(`const VERSION = 'v${major}.${minor}.${patch}'`, `const VERSION = '${newVersion}'`);
  fs.writeFileSync(pagePath, content);
  console.log(`✓ Version bumped to ${newVersion}`);
} else {
  const match2 = content.match(/const VERSION = 'v(\d+)\.(\d+)'/);
  if (match2) {
    const [, major, minor] = match2;
    const newVersion = `v${major}.${minor}.1`;
    content = content.replace(`const VERSION = 'v${major}.${minor}'`, `const VERSION = '${newVersion}'`);
    fs.writeFileSync(pagePath, content);
    console.log(`✓ Version bumped to ${newVersion}`);
  } else {
    console.log('⚠ No version found in page.js — skipping bump');
  }
}
