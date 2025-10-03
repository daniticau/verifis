# Verifis - Grok Live Search Fact Checker

A Chrome extension that provides AI-powered fact-checking using Grok Live Search with credibility scoring and source analysis.

## Features

- **Grok Live Search Integration**: Uses Grok's advanced AI with real-time web search
- **Credibility Scoring**: AI-powered credibility assessment (0-100 scale)
- **Source Analysis**: Detailed analysis of supporting/refuting evidence
- **Fast Preview Mode**: Quick fact-checks using grok-3-mini
- **Deep Analysis Mode**: Comprehensive analysis using grok-4-fast-reasoning
- **Smart Caching**: Results cached for faster repeated queries
- **Context Menu Integration**: Right-click to fact-check selected text
- **Keyboard Shortcuts**: Ctrl+Shift+F (Cmd+Shift+F on Mac)
- **Settings Page**: Configurable search parameters and preferences

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env.local` file:

```bash
# Required: Grok API Key
XAI_API_KEY=your_grok_api_key_here

# Optional: Model Configuration
GROK_MODEL_PRIMARY=grok-4-fast-reasoning
GROK_MODEL_FAST=grok-3-mini

# Optional: Search Configuration
GROK_ALLOWED_SITES=nih.gov,who.int,nejm.org,jamanetwork.com
GROK_MAX_RESULTS=8
GROK_FROM_DATE=2023-01-01
GROK_STRICT_WHITELIST=false
```

### 3. Build the Extension

```bash
# Build for production
npm run build:extension

# Build for development (with watch mode)
npm run build:extension:dev
```

### 4. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select the `extension` folder
4. The extension should appear in your extensions list

## Usage

### Fact-Checking Text

1. **Select text** on any webpage
2. **Right-click** and choose "Fact-check selection"
3. **Or use keyboard shortcut**: Ctrl+Shift+F (Cmd+Shift+F on Mac)
4. **Or click the extension icon** and paste text manually

### Popup Interface

- Enter claim text in the textarea
- Toggle "Fast preview" for quick analysis
- Click "Fact Check" to analyze
- View credibility score and source analysis
- Copy JSON results to clipboard

### Settings

- Click the settings link in the popup
- Configure allowed websites, search parameters
- Adjust caching and performance settings
- Set default models and preferences

## Architecture

### Core Components

```
src/
├── shared/
│   ├── config.ts          # Environment configuration
│   └── types.ts           # TypeScript type definitions
├── background/
│   ├── index.ts           # Service worker entry point
│   ├── clients/
│   │   └── grok.ts        # Grok API client
│   ├── factCheck.ts       # Fact-checking orchestration
│   └── cache.ts           # Result caching system
├── content/
│   └── selection.ts       # Content script for text selection
├── popup/
│   ├── index.html         # Popup UI
│   └── popup.ts           # Popup logic
└── options/
    ├── index.html         # Settings page
    └── options.ts         # Settings logic
```

### Fact-Checking Flow

1. **Text Selection**: User selects text or enters manually
2. **Grok Live Search**: Search for evidence with citations
3. **AI Analysis**: Grok analyzes sources and provides credibility scores
4. **Result Display**: Show summary, score, and source analysis
5. **Caching**: Store results for faster repeated queries

### API Integration

The extension uses Grok's Live Search API with the following features:

- **Real-time Web Search**: Searches current web content
- **Citation Extraction**: Automatically extracts source URLs
- **Credibility Assessment**: AI-powered source reliability scoring
- **Evidence Analysis**: Identifies supporting/refuting evidence

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XAI_API_KEY` | - | **Required** Grok API key |
| `GROK_MODEL_PRIMARY` | `grok-4-fast-reasoning` | Model for deep analysis |
| `GROK_MODEL_FAST` | `grok-3-mini` | Model for quick previews |
| `GROK_ALLOWED_SITES` | `nih.gov,who.int,nejm.org,jamanetwork.com` | Trusted domains |
| `GROK_MAX_RESULTS` | `8` | Max sources to analyze |
| `GROK_FROM_DATE` | `2023-01-01` | Minimum source date |
| `GROK_STRICT_WHITELIST` | `false` | Only search allowed sites |

### Extension Settings

Accessible via the settings page:

- **Search Configuration**: Allowed sites, max results, date filters
- **Performance Settings**: Caching, fast preview defaults
- **Model Selection**: Primary and fast model preferences

## Development

### Building

```bash
# Install dependencies
npm install

# Build extension
npm run build:extension

# Development build with watch
npm run build:extension:dev

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Run backend server (for API testing)
npm run dev

# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the extension folder
```

### Project Structure

- **Backend**: Next.js API routes for clip storage
- **Extension**: Chrome extension with TypeScript
- **Shared**: Common types and configuration
- **Build**: Webpack configuration for extension bundling

## API Reference

### Fact-Check Request

```typescript
interface FactCheckRequest {
  claim: string;
  pageUrl?: string;
  pageTitle?: string;
  useFastModel?: boolean;
}
```

### Fact-Check Response

```typescript
interface FactCheckResult {
  claim: string;
  overall: number; // 0-100 credibility score
  summary: string;
  sources: {
    url: string;
    domain: string;
    stance: 'supports' | 'refutes' | 'mixed';
    credibility: number;
    evidence: string[];
  }[];
  processingTime?: number;
  model?: string;
}
```

## Privacy & Security

- **No Data Collection**: Extension doesn't collect user data
- **Local Processing**: Fact-checking happens via API calls only
- **Secure Storage**: Settings stored locally in Chrome storage
- **API Key Security**: Keys never logged or transmitted unnecessarily
- **Minimal Permissions**: Only requests necessary Chrome permissions

## Troubleshooting

### Common Issues

1. **"XAI_API_KEY not found"**
   - Set your Grok API key in `.env.local`
   - Restart the development server

2. **"No sources found"**
   - Check your internet connection
   - Verify API key is valid
   - Try adjusting search parameters in settings

3. **Extension not loading**
   - Ensure all files are built in the `extension` folder
   - Check Chrome developer console for errors
   - Verify manifest.json is valid

4. **Fact-checking fails**
   - Check Chrome extension console for errors
   - Verify API key has sufficient credits
   - Try with shorter text selections

### Debug Mode

Enable debug logging by opening Chrome DevTools:

1. Right-click extension icon → "Inspect popup"
2. Check Console tab for detailed logs
3. Background script logs in Extensions page

## License

Private project - All rights reserved.

## Changelog

### v2.0.0
- Complete rewrite with Grok Live Search integration
- Added credibility scoring system
- Implemented fast preview mode
- Added comprehensive settings page
- Improved UI/UX with modern design
- Added caching and rate limiting
- Enhanced error handling and validation

### v1.0.0
- Initial release with basic fact-checking
- OpenAI integration
- Simple popup interface