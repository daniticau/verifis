# Verifis Extension Backend

A lightweight backend server that powers the Verifis Chrome extension for AI-powered fact checking.

## Overview

This project provides the essential backend services needed for the Verifis extension to function:

- **Clip Storage API** (`/api/clip`) - Stores and retrieves highlighted text from web pages
- **Claim Extraction API** (`/api/extract`) - Uses OpenAI + multi-source web search to extract and verify factual claims
- **Overlay Interface** (`/overlay`) - Clean, responsive UI for displaying verification results with source citations

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Copy `env.example` to `.env.local` and add your API keys:

```bash
cp env.example .env.local
# Edit .env.local and add your API keys:
# - OPENAI_API_KEY (required)
# - At least one search API key (BING_API_KEY recommended)
```

### 3. Start Development Server

```bash
npm run dev
```

The server will run on `http://localhost:3000`

### 4. Load Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. The extension will now work with your local backend

## API Endpoints

### POST /api/clip
Stores highlighted text from web pages.

**Request Body:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "text": "Highlighted text content..."
}
```

**Response:**
```json
{
  "id": "clip_1234567890_0",
  "message": "Clip created successfully"
}
```

### GET /api/clip?id={clipId}
Retrieves stored clip data.

**Response:**
```json
{
  "id": "clip_1234567890_0",
  "url": "https://example.com/article",
  "title": "Article Title",
  "text": "Full text content...",
  "isSnippet": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/extract
Extracts and verifies factual claims from text using multi-source web search.

**Request Body:**
```json
{
  "url": "https://example.com/article",
  "text": "Text to analyze...",
  "isSnippet": true
}
```

**Response:**
```json
{
  "url": "https://example.com/article",
  "claims": [
    {
      "claim": "Factual claim from the text",
      "status": "likely true",
      "confidence": 0.85,
      "justification": "This claim is supported by reliable sources...",
      "sources": [
        {
          "title": "Source Title",
          "url": "https://source.com/article",
          "snippet": "Source description...",
          "reliability": "high",
          "quote": "Exact quote supporting the claim",
          "domain": "source.com"
        }
      ]
    }
  ]
}
```

## Extension Features

The Chrome extension provides:

- **Auto-highlight verification** - Highlight any text to get instant verification with web sources
- **Smart debouncing** - 600ms delay prevents accidental triggers
- **Snippet mode** - Fast verification for short text (<2k characters) with 2-3 sources
- **Full page mode** - Comprehensive analysis with 3+ sources and cross-referencing
- **Overlay interface** - Clean, iframe-based verification results with source citations
- **Toggle control** - Enable/disable auto-verification per page
- **Source transparency** - View reliability ratings, domains, and relevant quotes

## Development

### Project Structure

```
├── app/
│   ├── api/
│   │   ├── clip/          # Clip storage API
│   │   └── extract/       # Claim extraction API with web search
│   ├── overlay/           # Overlay interface with source display
│   └── layout.tsx         # Root layout
├── lib/
│   ├── search.ts          # Multi-source search orchestration
│   ├── fetchPage.ts       # Robust page fetching with caching
│   ├── readability.ts     # Content extraction using Readability
│   └── sources.ts         # Source reliability scoring and deduplication
├── extension/             # Chrome extension files
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run linting

### Making Changes

1. **Backend changes** - Edit files in `app/` folder, server auto-reloads
2. **Extension changes** - Edit files in `extension/` folder, reload extension in Chrome

## Deployment

### Local Development
- Server runs on `http://localhost:3000`
- Extension configured for localhost
- Perfect for development and testing

### Production
- Deploy backend to your preferred hosting service
- Update extension URLs in `extension/content.js`
- Update `extension/manifest.json` host permissions

## Dependencies

- **Next.js 15** - React framework for API routes and overlay
- **OpenAI SDK** - AI-powered claim verification
- **Multi-Source Search** - Bing, Google CSE, Brave, and DuckDuckGo fallback
- **Content Extraction** - Mozilla Readability + JSDOM for article parsing
- **Source Management** - Reliability scoring, deduplication, and caching
- **Cheerio** - HTML parsing fallback
- **Zod** - Runtime type validation

## Web Search & Fact-Checking

### Multi-Source Search with Smart Fallback
Verifis uses a prioritized fallback system to ensure reliable fact-checking:

1. **Brave Search API** (Highest Priority) - Privacy-focused, high-quality results
2. **DuckDuckGo** (First Fallback) - Free, reliable alternative when Brave fails
3. **Wikipedia** (Second Fallback) - Knowledge-based results when DuckDuckGo fails
4. **Additional Providers** - Bing and Google CSE available as supplementary sources

**Fallback Behavior:**
- Brave is always tried first for best results (uses only Brave's own search results)
- If Brave fails or returns no results, DuckDuckGo is automatically tried
- If both Brave and DuckDuckGo fail completely, Wikipedia serves as the final fallback
- This ensures users always get search results, even if premium APIs are unavailable
- Brave never mixes with Wikipedia or other providers - it's a pure Brave search experience

### Content Extraction Pipeline
1. **Search Generation** - Creates focused queries from highlighted text
2. **Multi-Source Search** - Searches across all available providers
3. **Page Fetching** - Downloads and caches web pages with retry logic
4. **Content Extraction** - Uses Mozilla Readability for clean article text
5. **Source Enhancement** - Scores reliability and finds relevant quotes
6. **AI Analysis** - OpenAI processes text + sources for verification

### Source Reliability Scoring
- **High**: Government (.gov), Education (.edu), International (.int), Fact-checking sites
- **Medium**: Established news, Academic institutions, Reputable organizations
- **Low**: Blog platforms, Social media, Questionable domains

### Caching & Performance
- Search results cached for 10-30 minutes
- Fetched pages cached for 5-15 minutes
- Rate limiting to protect API keys
- Concurrent processing with limits

## License

Private project - All rights reserved.
