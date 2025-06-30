// Popup script for handling UI interactions

let currentTab = null;
let selectedText = '';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Load stats
  await loadStats();
  
  // Get page metadata
  try {
    // Check if we can run content scripts on this page
    if (currentTab.url.startsWith('chrome://') || 
        currentTab.url.startsWith('chrome-extension://') || 
        currentTab.url.startsWith('about:') ||
        currentTab.url.startsWith('edge://') ||
        currentTab.url.startsWith('file://') && !currentTab.url.endsWith('.html')) {
      // Can't inject content scripts on these pages
      updatePageInfo({
        title: currentTab.title || 'Special Page',
        author: '',
        url: currentTab.url
      });
      document.getElementById('save-article').disabled = true;
      document.getElementById('save-article').title = 'Cannot save from this type of page';
      return;
    }

    // Try to inject content script first if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['DOMPurify.js', 'readability.js', 'content.js']
      });
      console.log('Content scripts injected successfully');
    } catch (injectionError) {
      // Content script might already be injected, continue anyway
      console.log('Content script injection attempted:', injectionError.message);
    }

    // Wait a moment for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 200));

    // Now try to get the page data
    // Verify tab still exists
    if (!currentTab || !currentTab.id) {
      throw new Error('Tab no longer exists');
    }
    
    console.log('Requesting page data from content script...');
    const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractData' });
    console.log('Received page data:', response);
    updatePageInfo(response);
  } catch (error) {
    console.error('Error getting page data:', error);
    // Use basic tab info as fallback
    updatePageInfo({
      title: currentTab?.title || 'Unable to extract page data',
      author: '',
      url: currentTab?.url || ''
    });
    
    // Show a more helpful message
    if (error.message && (error.message.includes('Receiving end does not exist') || error.message.includes('No tab with id'))) {
      showStatus('Please refresh the page and try again', 'info');
    }
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Update keyboard shortcuts display based on platform
  updateShortcutDisplay();
});

// Update page information in the UI
function updatePageInfo(data) {
  document.getElementById('page-title').textContent = data.title || 'Untitled';
  document.getElementById('page-author').textContent = data.author || 'Unknown';
  document.getElementById('page-url').textContent = data.url || '';
  document.getElementById('page-url').title = data.url || ''; // Tooltip for full URL
  
  // Enable selection button if text is selected
  if (data.selectedText) {
    selectedText = data.selectedText;
    document.getElementById('save-selection').disabled = false;
    document.getElementById('save-selection').innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
      </svg>
      Save Selected Text (${data.selectedText.length} chars)
    `;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Save selected text button
  document.getElementById('save-selection').addEventListener('click', async () => {
    if (selectedText) {
      await saveItem(selectedText);
    }
  });
  
  // Save full article button
  document.getElementById('save-article').addEventListener('click', async () => {
    await saveItem(null);
  });
  
  // View all button
  document.getElementById('view-all').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('saved-items.html') });
  });
  
  // Configure shortcuts button
  document.getElementById('configure-shortcuts').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
  

}

// Save item
async function saveItem(selectedTextOverride) {
  showStatus('Saving...', 'info');
  
  try {
    // Check if this is a special page where we can't extract content
    const isSpecialPage = currentTab.url.startsWith('chrome://') || 
                         currentTab.url.startsWith('chrome-extension://') || 
                         currentTab.url.startsWith('about:') ||
                         currentTab.url.startsWith('edge://');
    
    if (isSpecialPage && !selectedTextOverride) {
      showStatus('Cannot extract content from this type of page', 'error');
      return;
    }
    
    // Send message to background script
    await chrome.runtime.sendMessage({
      action: 'saveArticle',
      selectedText: selectedTextOverride,
      tab: currentTab,
      isSpecialPage: isSpecialPage
    });
    
    // Update stats
    await loadStats();
    
    // Show success and close popup after a delay
    showStatus('Saved successfully!', 'success');
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (error) {
    console.error('Save error:', error);
    showStatus('Error saving article', 'error');
  }
}

// Load statistics
async function loadStats() {
  try {
    const savedItems = await chrome.runtime.sendMessage({ action: 'getSavedItems' });
    const totalItems = savedItems.length;
    const unreadItems = savedItems.filter(item => !item.read).length;
    
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('unread-items').textContent = unreadItems;
  } catch (error) {
    console.error('Error loading stats:', error);
    // Set default values on error
    document.getElementById('total-items').textContent = '0';
    document.getElementById('unread-items').textContent = '0';
  }
}

// Update shortcut display based on platform
function updateShortcutDisplay() {
  // Using Ctrl for all platforms now
  document.getElementById('save-shortcut').textContent = 'Ctrl+Shift+A';
  document.getElementById('view-shortcut').textContent = 'Ctrl+Shift+O';
}



// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
  
  // Auto-hide after 3 seconds for non-error messages
  if (type !== 'error') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Listen for text selection updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'textSelected' && sender?.tab?.id === currentTab?.id) {
    selectedText = request.text;
    document.getElementById('save-selection').disabled = false;
    document.getElementById('save-selection').innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
      </svg>
      Save Selected Text (${request.text.length} chars)
    `;
  }
}); 