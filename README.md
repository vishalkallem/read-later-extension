# Read Later Chrome Extension

A Chrome extension that saves articles and highlighted text locally for reading later.

## Features

- **Save with Keyboard Shortcuts**: 
  - `Command+Shift+O` (Mac) / `Alt+Shift+O` (Windows/Linux) - Open the read later page
  - `Command+Shift+A` (Mac) / `Alt+Shift+A` (Windows/Linux) - Save current page
  - `Command+Shift+S` (Mac) / `Alt+Shift+S` (Windows/Linux) - Save selected selection
- **Local Storage**: All data is saved locally and synced across your devices

- **Rich Item Management**:
  - Add notes and tags to saved items
  - Mark items as read/unread
  - Search and filter saved items
  - Export/import your data
  - Tag cloud for easy filtering
- **Multiple Save Methods**:
  - Right-click context menu for selected text
  - Extension popup for full articles
  - Keyboard shortcuts for quick saving
- **Beautiful UI**: Modern, responsive interface with:
  - Dark mode support
  - Grid and list views
  - Link previews with favicons
  - Colorful, reactive design

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `read-later-extension` folder

For detailed setup instructions, see [QUICK_START.md](QUICK_START.md)

## Usage

### Saving Content

1. **Save Selected Text**: 
   - Highlight any text on a webpage
   - Right-click and choose "Save to Read Later"
   - Or press `Command+Shift+S` (Mac) / `Alt+Shift+S` (Windows/Linux)

2. **Save Full Article**:
   - Click the extension icon in the toolbar
   - Click "Save Full Article"
   - Or press `Command+Shift+A` (Mac) / `Alt+Shift+A` (Windows/Linux) without selecting text

3. **Quick Save from Twitter/X**:
   - Just press `Command+Shift+A` (Mac) / `Alt+Shift+A` (Windows/Linux) while viewing a thread
   - The extension will save the current page

### Viewing Saved Items

1. Press `Command+Shift+O` (Mac) / `Alt+Shift+O` (Windows/Linux)
2. Or click the extension icon and select "View All Saved Items"

### Managing Items

In the saved items page, you can:
- **Search**: Use the search bar to find items by title, author, content, or tags
- **Filter**: Show all items, only unread, or only read items
- **Sort**: By newest, oldest, or alphabetically
- **View**: Switch between grid and list views
- **Edit**: Click any item to:
  - Add personal notes
  - Add tags for organization
  - Mark as read/unread
  - Delete the item
  - Visit the original URL

### Data Management

- **Export**: Click "Export Data" to save all items as a JSON file
- **Import**: Click "Import Data" to load items from a previously exported file
- **Sync**: Data automatically syncs across devices logged into the same Chrome account

## Keyboard Shortcuts

### Customizing Shortcuts

1. Go to `chrome://extensions/shortcuts`
2. Find "Read Later" extension
3. Click the edit button next to any shortcut
4. Press your desired key combination

### Default Shortcuts

- **Save content**: `Command+Shift+A` (Mac) / `Alt+Shift+A` (Windows/Linux)
- **Open saved items**: `Command+Shift+O` (Mac) / `Alt+Shift+O` (Windows/Linux)

## Project Structure

```
read-later-extension/
├── manifest.json             # Extension configuration
├── background.js             # Service worker for context menus and commands
├── content.js               # Content script for extracting page data
├── popup.html               # Extension popup UI
├── popup.js                 # Popup functionality
├── popup.css                # Popup styles
├── saved-items.html         # Saved items page
├── saved-items.js           # Saved items functionality
├── saved-items.css          # Saved items styles
├── icons/                   # Extension icons (16, 48, 128px)
└── README.md               # This file
```

## Data Structure

Each saved item includes:
- **Title**: Page title
- **Author**: Article author (if found)
- **URL**: Full page URL
- **Highlights**: Selected text (if any)
- **Saved At**: Timestamp when saved
- **Read Status**: Whether the item has been read
- **Notes**: Your personal notes
- **Tags**: Custom tags for organization

## Privacy & Security

- All data is stored locally in your browser
- Data syncs only through your Chrome account
- No external servers or services are used
- You have full control over your data (export/import/delete)

## Tips

1. **Save Twitter/X Threads**: Navigate to any tweet and press the save shortcut to capture the thread
2. **Organize with Tags**: Use tags like "work", "personal", "research" to categorize items
3. **Quick Notes**: Add notes while reading to remember key points
4. **Batch Operations**: Use the export feature to backup your reading list regularly

## Troubleshooting

### Extension Not Working
1. Make sure you've granted all requested permissions
2. Try reloading the extension in `chrome://extensions/`
3. Check if keyboard shortcuts conflict with other extensions

### Data Not Syncing
1. Ensure you're signed into Chrome
2. Check Chrome sync settings include extensions
3. Note: Chrome sync has size limits; very large collections may only store locally

### Keyboard Shortcuts Not Working
1. Check for conflicts in `chrome://extensions/shortcuts`
2. Some websites may override shortcuts
3. Try using the right-click menu instead

## Development

To modify the extension:
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on your extension
4. Test your changes

## Testing the Extension

To test the extension without encountering issues on special Chrome pages:

1. **Open the test page**: Open `test-page.html` in your browser (drag and drop it into Chrome)
2. **Test saving features**:
   - Click the extension icon to see the popup
   - Try "Save Full Article" button
   - Select some text and try "Save Selection"
   - Use keyboard shortcuts (Alt+Shift+O, Alt+Shift+S, Alt+Shift+A on Windows/Linux or Command+Shift+O, Command+Shift+S, Command+Shift+A on Mac)
   - Right-click on selected text to use the context menu

**Note**: The extension cannot extract content from special pages like `chrome://`, `chrome-extension://`, or new tab pages. This is a Chrome security restriction.

## License

This extension is provided as-is for personal use. 