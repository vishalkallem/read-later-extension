# Read Later Chrome Extension

A Chrome extension for saving articles and highlights for later reading, with local storage and powerful organization features.

## Features

- **Save Articles**: Save entire articles or selected text with one click
- **Keyboard Shortcuts**: Quick access with customizable shortcuts
- **Smart Organization**: Automatic domain grouping and tag management
- **Reading Time**: Automatic calculation of reading time for articles
- **Search & Filter**: Powerful search and filtering capabilities
- **Dark Mode**: Beautiful dark/light theme toggle
- **Kindle Import**: Import highlights from Amazon Notebook and clipping.io exports
- **Export/Import**: Backup and restore your saved items
- **Local Storage**: All data stored locally in your browser

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `read-later-extension` folder
5. The extension icon should appear in your toolbar

## Usage

### Saving Content

- **Save Full Article**: Click the extension icon and select "Save Article" or use `Ctrl+Shift+A`
- **Save Selection**: Select text on any page and use `Ctrl+Shift+S`
- **Open Saved Items**: Use `Ctrl+Shift+O` or click the extension icon and select "Open Saved"

### Managing Saved Items

- **Search**: Use the search bar to find specific items
- **Filter**: Filter by read status, domain, or tags
- **Sort**: Sort by date, title, domain, or read status
- **Tags**: Add and manage tags for better organization
- **Notes**: Add personal notes to any saved item

### Import Features

- **Kindle Highlights**: Import highlights from Amazon Notebook exports or clipping.io
- **Data Backup**: Export your data as JSON and import it on another device

## Keyboard Shortcuts

- `Ctrl+Shift+A`: Save current article
- `Ctrl+Shift+S`: Save selected text
- `Ctrl+Shift+O`: Open saved items page

## File Structure

```
read-later-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for keyboard shortcuts
├── content.js            # Content script for page interaction
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── saved-items.html      # Main saved items page
├── saved-items.js        # Saved items functionality
├── saved-items.css       # Styling for saved items
├── popup.css             # Popup styling
├── readability.js        # Article content extraction
├── DOMPurify.js          # HTML sanitization
└── icons/                # Extension icons
```

## Development

The extension uses:
- **Manifest V3**: Latest Chrome extension manifest
- **Local Storage**: Chrome storage API for data persistence
- **Content Scripts**: For page interaction and content extraction
- **Service Workers**: For background functionality and keyboard shortcuts

## Privacy

All data is stored locally in your browser using Chrome's storage API. No data is sent to external servers.

## Contributing

Feel free to submit issues and enhancement requests! 