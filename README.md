# Verifis - Chrome Factcheck & Explain Extension

A Chrome extension that fact-checks or explains highlighted text using Google Gemini AI.

## Features

- **Two Modes**:
  - **Fact Check**: Extracts factual claims from text and finds relevant sources
  - **Explain**: Provides simplified summaries and background context for complex text
- **Automatic Processing**: Highlight text on any webpage and get instant results
- **AI-Powered**: Uses Google Gemini 2.0 Flash for analysis
- **Smart Debouncing**: Waits for stable text selection before processing

## Setup

### Prerequisites

- Node.js 18+
- Chrome browser
- Google Gemini API key (get one at https://aistudio.google.com/app/apikey)

### Installation

1. Install dependencies and build:
```bash
cd extension
npm install
npm run build
```

2. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` directory

3. Configure API key:
   - Click the extension icon
   - Click the settings gear icon
   - Enter your Gemini API key
   - Save

## Usage

1. Navigate to any webpage
2. Select the mode (Fact Check or Explain) in the popup
3. Highlight text on the page
4. Wait ~1 second for processing
5. View results in the extension popup

### Fact Check Mode
- Extracts 1-3 factual claims from selected text
- Finds up to 5 sources per claim with stance indicators (supports/contradicts/unclear)

### Explain Mode
- Provides a simplified summary in plain language
- Adds contextual background information

## Project Structure

```
verifis/
└── extension/           # Chrome extension (MV3)
    ├── src/
    │   ├── background/  # Service worker (Gemini API calls)
    │   ├── content/     # Content script (text selection)
    │   ├── popup/       # React popup UI
    │   ├── options/     # Settings page
    │   └── storage/     # Chrome storage utilities
    └── dist/            # Built extension
```

## Development

```bash
cd extension
npm run dev    # Watch mode
npm run build  # Production build
```

## License

MIT
