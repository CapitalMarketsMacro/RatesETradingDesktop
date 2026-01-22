const fs = require('fs');
const path = require('path');

// Read package-lock.json
const packageLockPath = path.join(__dirname, 'package-lock.json');
const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

// Extract all packages
const allPackages = new Map();

// Iterate through all packages in the lock file
for (const [packagePath, packageData] of Object.entries(packageLock.packages)) {
  // Skip root package (empty string key)
  if (packagePath === '') continue;
  
  // Extract package name from path if name is not present
  let packageName = packageData.name;
  if (!packageName && packagePath.startsWith('node_modules/')) {
    // Extract name from path like "node_modules/@scope/package" or "node_modules/package"
    const pathParts = packagePath.replace('node_modules/', '').split('/');
    if (pathParts[0].startsWith('@')) {
      packageName = `${pathParts[0]}/${pathParts[1]}`;
    } else {
      packageName = pathParts[0];
    }
  }
  
  if (packageName && packageData.version) {
    const key = `${packageName}@${packageData.version}`;
    if (!allPackages.has(key)) {
      allPackages.set(key, {
        name: packageName,
        version: packageData.version,
        license: packageData.license || 'N/A',
        resolved: packageData.resolved || 'N/A',
        integrity: packageData.integrity || 'N/A',
        dev: packageData.dev || false,
        optional: packageData.optional || false,
        dependencies: packageData.dependencies ? Object.keys(packageData.dependencies) : []
      });
    }
  }
}

// Sort packages by name
const sortedPackages = Array.from(allPackages.values()).sort((a, b) => 
  a.name.localeCompare(b.name)
);

// Generate output files
const output = {
  summary: {
    totalPackages: sortedPackages.length,
    generatedAt: new Date().toISOString()
  },
  packages: sortedPackages
};

// Write JSON file
fs.writeFileSync(
  'npm-dependencies.json',
  JSON.stringify(output, null, 2),
  'utf8'
);

// Write text file
let textOutput = `NPM Transitive Dependencies Report\n`;
textOutput += `=====================================\n\n`;
textOutput += `Generated: ${new Date().toISOString()}\n`;
textOutput += `Total Packages: ${sortedPackages.length}\n\n`;
textOutput += `Packages:\n`;
textOutput += `${'='.repeat(80)}\n\n`;

sortedPackages.forEach((pkg, index) => {
  textOutput += `${index + 1}. ${pkg.name}@${pkg.version}\n`;
  textOutput += `   License: ${pkg.license}\n`;
  if (pkg.dependencies.length > 0) {
    textOutput += `   Dependencies: ${pkg.dependencies.join(', ')}\n`;
  }
  textOutput += `\n`;
});

// Write simple list file (just name@version)
let simpleList = sortedPackages.map(pkg => `${pkg.name}@${pkg.version}`).join('\n');
fs.writeFileSync('npm-dependencies-list.txt', simpleList, 'utf8');

fs.writeFileSync('npm-dependencies.txt', textOutput, 'utf8');

console.log(`Extracted ${sortedPackages.length} packages`);
console.log('Generated files:');
console.log('  - npm-dependencies.json (detailed JSON)');
console.log('  - npm-dependencies.txt (detailed text report)');
console.log('  - npm-dependencies-list.txt (simple list)');
