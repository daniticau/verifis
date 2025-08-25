# Verifis Reader + Clipper Extension

A Chrome extension that automatically verifies highlighted text on any webpage using AI-powered fact checking.

## Features

- **Auto-highlight verification**: Highlight any text and get instant verification
- **Smart debouncing**: 600ms delay prevents accidental triggers
- **Snippet mode**: Fast verification for short text (<2k characters)
- **Overlay interface**: Clean, iframe-based verification results
- **Toggle control**: Enable/disable auto-verification per page
- **ESC to close**: Quick keyboard shortcut to dismiss overlay

## Installation

### 1. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` folder from this project

### 2. Start the Backend Server

The extension requires a local backend server to function:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The server will run on `http://localhost:3000` and provides:
- `/api/clip` - Store and retrieve highlighted text
- `/api/extract` - Extract and verify claims
- `/overlay` - Overlay interface for results

### 3. Verify Installation

- Extension icon should appear in Chrome toolbar
- Click icon to see popup with toggle switch
- Status should show "Highlight verification is enabled"

## Testing

### 1. Test Basic Functionality

1. Go to any webpage (e.g., Wikipedia article)
2. Highlight a paragraph of text (>15 characters)
3. Wait 600ms - you should see "Verifis verifying..." indicator
4. Overlay should appear with verification results

### 2. Test Snippet Mode

1. Highlight a short sentence (15-100 characters)
2. Should trigger faster verification (snippet mode)
3. Results show binary assessment: "likely true", "likely false", "uncertain"

### 3. Test Full Page Mode

1. Highlight longer text (>2000 characters)
2. Should use standard claim extraction
3. Results show detailed claims with quotes and confidence

### 4. Test Controls

- **Toggle**: Click extension icon to disable/enable
- **ESC**: Press ESC key to close overlay
- **Re-highlight**: Select different text to trigger new verification

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── content.js            # Main content script
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── background.js         # Service worker
└── README.md            # This file

app/
├── api/
│   ├── clip/            # Clip storage API
│   └── extract/         # Claim extraction API
├── overlay/             # Overlay interface
└── layout.tsx           # Root layout
```

## Configuration

### Debouncing Settings

```javascript
const CONFIG = {
  MIN_SELECTION_LENGTH: 15,    // Minimum characters to trigger
  DEBOUNCE_DELAY: 600,         // Milliseconds to wait after selection
  // ... other config
};
```

### API Endpoints

The extension expects these endpoints on your local backend:

- `POST /api/clip` - Store highlighted text
- `GET /api/clip?id=<id>` - Retrieve clip data  
- `POST /api/extract` - Extract claims (supports snippet mode)
- `GET /overlay?id=<id>&text=<text>` - Overlay interface

## Development

### Making Changes

1. Edit files in `extension/` folder
2. Go to `chrome://extensions/`
3. Click "Reload" on the Verifis extension
4. Refresh test page

### Backend Development

1. Edit files in `app/` folder
2. Server will auto-reload on changes
3. Extension will use updated backend immediately

### Debug Mode

Enable debug logging in `content.js`:

```javascript
console.log('Verifis debug:', { selectionText, isVerifying, autoVerifyEnabled });
```

## Security Notes

- Extension requests permission to run on all URLs
- Only sends highlighted text to your local API
- No persistent data stored locally
- Respects user toggle preferences

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Next Steps

- Add icon files (16x16, 32x32, 48x48, 128x128)
- Implement persistent storage for clips
- Add keyboard shortcuts for manual verification
- Support for different verification modes
- Deploy backend to production server
