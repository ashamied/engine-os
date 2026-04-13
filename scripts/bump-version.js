const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'src/app/page.js');
let content = fs.readFileSync(pagePath, 'utf8');

// Extract current version
const match = content.match(/const VERSION = 'v(\d+)\.(\d+)\.(\d+)'/);
if (match) {
  const [, major, minor, patch] = match;
  const newPatch = parseInt(patch) + 1;
  const newVersion = `v${major}.${minor}.${newPatch}`;
  content = content.replace(
    `const VERSION = 'v${major}.${minor}.${patch}'`,
    `const VERSION = '${newVersion}'`
  );
  fs.writeFileSync(pagePath, content);
  console.log(`✓ Version bumped to ${newVersion}`);
} else {
  // Handle v1.1 or v1.2 format (no patch)
  const match2 = content.match(/const VERSION = 'v(\d+)\.(\d+)'/);
  if (match2) {
    const [, major, minor] = match2;
    const newMinor = parseInt(minor) + 1;
    const newVersion = `v${major}.${newMinor}.0`;
    content = content.replace(
      `const VERSION = 'v${major}.${minor}'`,
      `const VERSION = '${newVersion}'`
    );
    fs.writeFileSync(pagePath, content);
    console.log(`✓ Version bumped to ${newVersion}`);
  }
}
