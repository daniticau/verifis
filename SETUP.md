# Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build shared types package:**
   ```bash
   cd packages/shared-types
   npm install
   npm run build
   cd ../..
   ```

3. **Set up backend environment:**
   
   Create `api/.env` file with the following content:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   EXTENSION_SHARED_SECRET=your_random_secret_string_here
   PORT=3000
   GEMINI_MODEL=gemini-2.0-flash-exp
   ```
   
   **Where to get values:**
   - `GEMINI_API_KEY`: Get from https://makersuite.google.com/app/apikey or https://aistudio.google.com/app/apikey
   - `EXTENSION_SHARED_SECRET`: Choose any secure random string (e.g., `my-secret-key-abc123xyz`)
   - `PORT`: Default is 3000, change if needed
   - `GEMINI_MODEL`: Optional, defaults to `gemini-2.0-flash-exp`. Can use `gemini-1.5-pro`, `gemini-1.0-pro`, etc.

4. **Set up extension environment:**
   
   Create `extension/.env.local` file with the following content:
   ```env
   VITE_BACKEND_URL=http://localhost:3000
   VITE_SHARED_SECRET=your_random_secret_string_here
   ```
   
   **Important:** 
   - `VITE_SHARED_SECRET` must match `EXTENSION_SHARED_SECRET` from step 3 exactly
   - `VITE_BACKEND_URL` should match your backend URL (default: `http://localhost:3000`)
   - After creating/updating `.env.local`, you must rebuild the extension for changes to take effect

5. **Create extension icons:**
   - Add three PNG files to `extension/public/icons/`:
     - `icon16.png` (16x16)
     - `icon48.png` (48x48)
     - `icon128.png` (128x128)
   - You can use placeholder images for development

6. **Start development:**
   ```bash
   # Terminal 1: Start backend
   npm run dev:api
   
   # Terminal 2: Build extension (watch mode)
   npm run dev:extension
   ```

7. **Build and load extension in Chrome:**
   - First, build the extension (if not already built):
     ```bash
     npm run build:extension
     ```
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension/dist` folder
   
   **Note:** After changing `.env.local`, rebuild the extension:
   ```bash
   npm run build:extension
   ```
   Then reload the extension in Chrome (click the reload icon on the extension card)

## Testing

1. Open any webpage
2. Highlight some text containing factual claims
3. Wait ~1 second for the tooltip to appear
4. Click the extension icon to see the detailed popup view

## Production Build

```bash
npm run build
```

The extension will be in `extension/dist/`. You can zip this folder for distribution.

## Troubleshooting

- **Extension won't load**: Make sure icons exist in `extension/public/icons/` (or remove icon references from manifest.json temporarily)
- **Backend errors**: 
  - Check that all environment variables are set correctly in `api/.env`
  - Verify `GEMINI_API_KEY` is valid
  - Check backend console for specific error messages
- **401 Unauthorized errors**: 
  - Ensure `VITE_SHARED_SECRET` in `extension/.env.local` matches `EXTENSION_SHARED_SECRET` in `api/.env`
  - Rebuild extension after changing `.env.local`: `npm run build:extension`
  - Reload extension in Chrome
- **Gemini model errors**: 
  - Try different model names in `api/.env`: `GEMINI_MODEL=gemini-1.0-pro` or `GEMINI_MODEL=gemini-1.5-pro`
  - Restart backend after changing model
- **No tooltip appears**: Check browser console and extension service worker logs
- **CORS errors**: Ensure `VITE_BACKEND_URL` matches your backend URL exactly

