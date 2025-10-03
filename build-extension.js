#!/usr/bin/env node

// Build script for Verifis Chrome Extension
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Verifis Chrome Extension...\n');

// Clean previous build
console.log('🧹 Cleaning previous build...');
if (fs.existsSync('extension')) {
  const files = fs.readdirSync('extension');
  files.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.html')) {
      fs.unlinkSync(path.join('extension', file));
    }
  });
}

// Build with webpack
console.log('📦 Building with Webpack...');
try {
  execSync('npx webpack --mode=production', { stdio: 'inherit' });
  console.log('✅ Webpack build completed');
} catch (error) {
  console.error('❌ Webpack build failed:', error.message);
  process.exit(1);
}

// Copy additional files
console.log('📋 Copying additional files...');

// Note: Icons are optional for development
console.log('ℹ️  Icons are optional for development. Add PNG icons to extension/icons/ for production.');

// Verify build
console.log('\n🔍 Verifying build...');
const requiredFiles = [
  'extension/manifest.json',
  'extension/background.js',
  'extension/content.js',
  'extension/popup.js',
  'extension/popup.html',
  'extension/options.js',
  'extension/options.html'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\n🎉 Extension build completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Set XAI_API_KEY in your environment variables');
  console.log('2. Load extension in Chrome:');
  console.log('   - Go to chrome://extensions/');
  console.log('   - Enable "Developer mode"');
  console.log('   - Click "Load unpacked"');
  console.log('   - Select the extension folder');
  console.log('3. (Optional) Add icon files to extension/icons/ for better appearance');
} else {
  console.log('\n❌ Build verification failed. Please check the errors above.');
  process.exit(1);
}
