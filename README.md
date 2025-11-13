# Verifis - Chrome Factcheck Extension

A Chrome extension that fact-checks highlighted text using Google Gemini AI for claim extraction and source discovery.

## Features

- **Automatic Fact-Checking**: Highlight text on any webpage and get instant fact-check results
- **AI-Powered Analysis**: Uses Google Gemini AI to extract factual claims and discover relevant sources
- **Inline Tooltip**: Compact tooltip appears near selected text with claims and top sources
- **Rich Popup View**: Detailed view in extension popup with expandable claim cards and source lists
- **Smart Debouncing**: Waits for stable text selection before processing

## Architecture

- **Extension**: MV3 Chrome extension built with Vite, React, and TypeScript
  - Background service worker for API communication
  - Content script for text selection and tooltip display
  - React popup UI with Tailwind CSS
- **Backend**: Node.js server using Hono framework
  - Gemini AI integration for claim extraction and source discovery
  - Secure API with shared secret authentication
- **Shared Types**: Common TypeScript types package for type safety across extension and backend

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Chrome browser

### Installation

1. Install dependencies:
```bash
npm install
```

2. Build shared types:
```bash
cd packages/shared-types && npm install && npm run build && cd ../..
```

3. Set up environment variables:

**Backend** - Create `api/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
EXTENSION_SHARED_SECRET=your_random_secret_string
PORT=3000
GEMINI_MODEL=gemini-2.0-flash-exp
```

**Extension** - Create `extension/.env.local`:
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_SHARED_SECRET=your_random_secret_string
```

**Important Notes:**
- Get `GEMINI_API_KEY` from https://aistudio.google.com/app/apikey
- `VITE_SHARED_SECRET` must match `EXTENSION_SHARED_SECRET` exactly
- `GEMINI_MODEL` is optional (defaults to `gemini-2.0-flash-exp`)
- After creating/updating `.env.local`, rebuild the extension: `npm run build:extension`

### Development

1. Start the backend:
```bash
npm run dev:api
```

2. Build the extension (in watch mode):
```bash
npm run dev:extension
```

3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` directory

### Building for Production

```bash
npm run build
```

This builds all workspaces. The extension will be in `extension/dist/`.

## Project Structure

```
verifis/
├── extension/          # Chrome extension (MV3)
│   ├── src/
│   │   ├── background/ # Service worker
│   │   ├── content/    # Content script
│   │   ├── popup/      # React popup UI
│   │   └── manifest.json
│   ├── public/         # Static assets
│   └── .env.local      # Extension env vars (create this)
├── api/                # Backend server
│   ├── src/
│   │   ├── factcheck.ts
│   │   ├── gemini.ts
│   │   ├── gemini-search.ts
│   │   ├── router.ts
│   │   └── config.ts
│   └── .env            # Environment variables (create this)
└── packages/
    └── shared-types/   # Shared TypeScript types
```

## Usage

1. Highlight text on any webpage
2. Wait ~1 second for the selection to stabilize
3. A tooltip will appear with fact-check results
4. Click the extension icon to see a detailed view in the popup

## Configuration

Key constants are defined in:
- `extension/src/constants.ts` - Extension settings (debounce delay, max selection length, etc.)
- `api/src/types.ts` - Backend limits (max claims, max sources, text length)

### Environment Variables

**Backend (`api/.env`):**
- `GEMINI_API_KEY` - Required: Your Google Gemini API key
- `EXTENSION_SHARED_SECRET` - Required: Secret token for authenticating extension requests
- `PORT` - Optional: Server port (default: 3000)
- `GEMINI_MODEL` - Optional: Gemini model name (default: `gemini-2.0-flash-exp`)

**Extension (`extension/.env.local`):**
- `VITE_BACKEND_URL` - Required: Backend API URL (e.g., `http://localhost:3000`)
- `VITE_SHARED_SECRET` - Required: Must match `EXTENSION_SHARED_SECRET` from backend

## Security Notes

- API keys are never exposed to the extension
- All backend calls require a shared secret header
- The extension only communicates with your configured backend URL

## License

MIT

