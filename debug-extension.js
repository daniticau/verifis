// Debug script to test extension functionality
console.log('🔍 Debug: Testing extension functionality...');

// Test 1: Check if content script is loaded
console.log('Test 1: Checking if content script is loaded...');
if (typeof SelectionHandler !== 'undefined') {
  console.log('✅ SelectionHandler class found');
} else {
  console.log('❌ SelectionHandler class not found');
}

// Test 2: Check if Chrome extension APIs are available
console.log('Test 2: Checking Chrome extension APIs...');
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('✅ Chrome runtime API available');
} else {
  console.log('❌ Chrome runtime API not available');
}

// Test 3: Test text selection
console.log('Test 3: Testing text selection...');
function testSelection() {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    console.log('✅ Text selected:', selection.toString().substring(0, 50) + '...');
    return true;
  } else {
    console.log('❌ No text selected');
    return false;
  }
}

// Test 4: Check if event listeners are working
console.log('Test 4: Testing event listeners...');
document.addEventListener('selectionchange', () => {
  console.log('✅ selectionchange event fired');
  testSelection();
});

document.addEventListener('mouseup', () => {
  console.log('✅ mouseup event fired');
  setTimeout(() => {
    if (testSelection()) {
      console.log('🎯 Text selection detected after mouseup');
    }
  }, 100);
});

// Test 5: Check storage
console.log('Test 5: Testing Chrome storage...');
if (chrome.storage) {
  chrome.storage.sync.get(['autoFactCheckEnabled'], (result) => {
    console.log('✅ Storage access working, autoFactCheckEnabled:', result.autoFactCheckEnabled);
  });
} else {
  console.log('❌ Chrome storage not available');
}

console.log('🔍 Debug setup complete. Try selecting some text now...');
