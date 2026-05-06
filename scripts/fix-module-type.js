const fs = require('fs');
const path = require('path');

const htmlFiles = ['dist/index.html', 'dist/(tabs)/index.html', 'dist/+not-found.html'];

for (const file of htmlFiles) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  let html = fs.readFileSync(filePath, 'utf-8');
  // Add type="module" to script tags that load _expo JS but are missing the attribute
  const fixed = html.replace(
    /<script src="(\/_expo\/static\/js\/[^"]+)" defer>/g,
    '<script type="module" src="$1" defer>'
  );
  fs.writeFileSync(filePath, fixed, 'utf-8');
  console.log(`Fixed: ${file}`);
}
