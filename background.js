// Background service worker for handling context menus and local storage

// Initialize storage structure
chrome.runtime.onInstalled.addListener(async () => {
  // Create context menus
  chrome.contextMenus.create({
    id: 'saveToReadLater',
    title: 'Save Selection to Read Later',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'saveFullArticle', 
    title: 'Save Page to Read Later',
    contexts: ['page', 'link', 'image']
  });

  // Initialize storage if empty
  const { savedItems } = await chrome.storage.local.get(['savedItems']);
  if (!savedItems) {
    chrome.storage.local.set({ savedItems: [] });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveToReadLater') {
    saveItem(tab, info.selectionText);
  } else if (info.menuItemId === 'saveFullArticle') {
    saveItem(tab, null);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (command === 'save-full-article') {
    // Save full article
    saveItem(tab, null);
  } else if (command === 'save-selection') {
    // Save selected text
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
      if (response.selectedText) {
        saveItem(tab, response.selectedText);
      } else {
        // Show notification if no text selected
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'No Text Selected',
          message: 'Please select some text before using this shortcut.'
        });
      }
    } catch (error) {
      // If content script isn't loaded, inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Try again after injection
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        if (response.selectedText) {
          saveItem(tab, response.selectedText);
        } else {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: 'No Text Selected',
            message: 'Please select some text before using this shortcut.'
          });
        }
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Error',
          message: 'Unable to access page content. Try refreshing the page.'
        });
      }
    }
  } else if (command === 'open-saved-items') {
    // Open the saved items page
    chrome.tabs.create({ url: chrome.runtime.getURL('saved-items.html') });
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveArticle') {
    const tab = request.tab || sender.tab;
    saveItem(tab, request.selectedText, request.isSpecialPage);
    sendResponse({ success: true });
  } else if (request.action === 'getSavedItems') {
    chrome.storage.local.get(['savedItems'], (result) => {
      sendResponse(result.savedItems || []);
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'deleteSavedItem') {
    deleteSavedItem(request.id);
    sendResponse({ success: true });
  } else if (request.action === 'updateSavedItem') {
    updateSavedItem(request.id, request.updates);
    sendResponse({ success: true });
  }
});

// Save item to local storage
async function saveItem(tab, selectedText, isSpecialPage = false) {
  try {
    let response;
    
    // Handle special pages (chrome://, extension://, etc.)
    if (isSpecialPage) {
      response = {
        title: tab.title || 'Special Page',
        author: 'Browser',
        url: tab.url,
        selectedText: selectedText || '',
        fullContent: selectedText || 'Content cannot be extracted from this type of page'
      };
    } else {
      try {
        // Try to get page data from content script
        response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
      } catch (error) {
        // If content script isn't loaded, inject it first
        console.log('Content script not loaded, injecting...');
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Try again after injection
          response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
        } catch (injectionError) {
          console.error('Failed to inject content script:', injectionError);
          // Fall back to basic data
          response = {
            title: tab.title || 'Untitled',
            author: 'Unknown',
            url: tab.url,
            selectedText: selectedText || '',
            fullContent: ''
          };
        }
      }
    }
    
    // Use provided selected text or the one from the response
    if (selectedText) {
      response.selectedText = selectedText;
    }
    
    // Create item object
    const item = {
      id: Date.now().toString(), // Simple ID generation
      title: response.title,
      author: response.author || 'Unknown',
      url: response.url,
      highlights: response.selectedText || '',
      savedAt: new Date().toISOString(),
      tags: [],
      notes: '',
      read: false
    };
    
    // Get existing items
    const { savedItems } = await chrome.storage.local.get(['savedItems']);
    const items = savedItems || [];
    
    // Add new item to the beginning
    items.unshift(item);
    
    // Save to storage (both local and sync)
    await chrome.storage.local.set({ savedItems: items });
    
    // Try to sync (may fail due to quota limits)
    try {
      await chrome.storage.sync.set({ savedItems: items });
    } catch (syncError) {
      console.log('Sync storage failed, using local only:', syncError);
    }
    
    // Note: Firebase sync happens from the saved-items page when user is signed in
    
    // Show success notification with more details
    const notificationMessage = response.selectedText 
      ? `Selection from "${response.title}" has been saved!`
      : `"${response.title}" has been saved!`;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: '✓ Saved Successfully',
      message: notificationMessage,
      buttons: [
        { title: 'View Saved Items' }
      ],
      requireInteraction: false
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
    
  } catch (error) {
    console.error('Error saving item:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Error',
      message: 'Failed to save item. Please try again.'
    });
    
    // Update badge to show error
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#F44336', tabId: tab.id });
  }
}

// Delete saved item
async function deleteSavedItem(id) {
  const { savedItems } = await chrome.storage.local.get(['savedItems']);
  const items = savedItems || [];
  
  const filteredItems = items.filter(item => item.id !== id);
  
  await chrome.storage.local.set({ savedItems: filteredItems });
  
  // Try to sync
  try {
    await chrome.storage.sync.set({ savedItems: filteredItems });
  } catch (syncError) {
    console.log('Sync storage failed:', syncError);
  }
}

// Update saved item
async function updateSavedItem(id, updates) {
  const { savedItems } = await chrome.storage.local.get(['savedItems']);
  const items = savedItems || [];
  
  const itemIndex = items.findIndex(item => item.id === id);
  if (itemIndex !== -1) {
    items[itemIndex] = { ...items[itemIndex], ...updates };
    
    await chrome.storage.local.set({ savedItems: items });
    
    // Try to sync
    try {
      await chrome.storage.sync.set({ savedItems: items });
    } catch (syncError) {
      console.log('Sync storage failed:', syncError);
    }
  }
}

// Sync data on startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    // Try to get synced data
    const syncData = await chrome.storage.sync.get(['savedItems']);
    const localData = await chrome.storage.local.get(['savedItems']);
    
    // If sync has data and it's newer, use it
    if (syncData.savedItems && syncData.savedItems.length > 0) {
      // Simple merge strategy: use sync data if available
      await chrome.storage.local.set({ savedItems: syncData.savedItems });
    }
  } catch (error) {
    console.log('Error syncing data on startup:', error);
  }
});



// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Open saved items page
    chrome.tabs.create({ url: chrome.runtime.getURL('saved-items.html') });
  }
}); 