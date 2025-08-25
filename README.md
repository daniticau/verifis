# Verifis Extension Backend

A lightweight backend server that powers the Verifis Chrome extension for AI-powered fact checking.

## Overview

This project provides the essential backend services needed for the Verifis extension to function:

- **Clip Storage API** (`/api/clip`) - Stores and retrieves highlighted text from web pages
- **Claim Extraction API** (`/api/extract`) - Uses OpenAI to extract and verify factual claims
- **Overlay Interface** (`/overlay`) - Clean, responsive UI for displaying verification results

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Copy `env.example` to `.env.local` and add your OpenAI API key:

```bash
cp env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
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
Extracts and verifies factual claims from text.

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
      "justification": "This claim is supported by reliable sources..."
    }
  ]
}
```

## Extension Features

The Chrome extension provides:

- **Auto-highlight verification** - Highlight any text to get instant verification
- **Smart debouncing** - 600ms delay prevents accidental triggers
- **Snippet mode** - Fast verification for short text (<2k characters)
- **Overlay interface** - Clean, iframe-based verification results
- **Toggle control** - Enable/disable auto-verification per page

## Development

### Project Structure

```
├── app/
│   ├── api/
│   │   ├── clip/          # Clip storage API
│   │   └── extract/       # Claim extraction API
│   ├── overlay/           # Overlay interface
│   └── layout.tsx         # Root layout
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
- **Cheerio** - HTML parsing for web content
- **Zod** - Runtime type validation

## License

Private project - All rights reserved.
