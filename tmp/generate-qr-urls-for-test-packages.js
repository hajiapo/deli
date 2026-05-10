const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'test-packages.json');
const outputPath = path.join(__dirname, 'test-packages.json');

// QR code generation removed - use alternative QR service or library
// function makeQuickChartUrl(payloadObj) removed

function main() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const packages = JSON.parse(raw);

  if (!Array.isArray(packages)) {
    throw new Error('Expected test-packages.json to be an array');
  }

  // QR generation removed
}

// main() call removed - this script is no longer functional

