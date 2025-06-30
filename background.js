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
  
  if (command === 'save-article') {
    // Save full article
    saveItem(tab, null);
  } else if (command === 'save-selection') {
    // Save selected text
    try {
      // Check if tab exists and is valid
      if (!tab || !tab.id) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Error',
          message: 'No active tab found. Please try again.'
        });
        return;
      }
      
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
          files: ['DOMPurify.js', 'readability.js', 'content.js']
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
          chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Error',
          message: 'Unable to access page content. Try refreshing the page.'
        });
      }
    }
  } else if (command === 'open-saved') {
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
    // Validate tab
    if (!tab || !tab.id) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Error',
        message: 'No valid tab found. Please try again.'
      });
      return;
    }
    
    let response;
    
    // Handle special pages (chrome://, extension://, etc.)
    if (isSpecialPage) {
      response = {
        title: tab.title || 'Special Page',
        author: 'Browser',
        url: tab.url,
        selectedText: selectedText || '',
        fullContent: selectedText || 'Content cannot be extracted from this type of page',
        readingTime: 0
      };
    } else {
      try {
        // Try to get page data from content script
        response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
      } catch (error) {
        console.log('Content script not loaded, injecting...', error.message);
        
        // If content script isn't loaded, inject it first
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['DOMPurify.js', 'readability.js', 'content.js']
          });
          
          // Wait a moment for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Try again after injection
          response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
        } catch (injectionError) {
          console.log('Content script injection failed, using fallback data:', injectionError.message);
          // Fall back to basic data
          response = {
            title: tab.title || 'Untitled',
            author: 'Unknown',
            url: tab.url,
            selectedText: selectedText || '',
            fullContent: '',
            readingTime: 0
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
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9), // More unique ID
      title: response.title || 'Untitled',
      author: response.author || 'Unknown',
      url: response.url,
      highlights: response.selectedText || '',
      savedAt: new Date().toISOString(),
      tags: [],
      notes: '',
      read: false,
      readingTime: response.readingTime || 0
    };
    
    // Get existing items
    const { savedItems } = await chrome.storage.local.get(['savedItems']);
    const items = savedItems || [];
    
    // Check for duplicates based on URL
    const isDuplicate = items.some(existingItem => existingItem.url === item.url);
    if (isDuplicate) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Already Saved',
        message: `"${item.title}" has already been saved!`,
        requireInteraction: false
      });
      return;
    }
    
    // Add new item to the beginning
    items.unshift(item);
    
    // Save to storage
    await chrome.storage.local.set({ savedItems: items });
    
    // Update user analytics (don't await to avoid blocking)
    updateUserAnalytics('articleSaved', item).catch(error => {
      console.error('Analytics update failed:', error);
    });
    
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
    if (tab && tab.id) {
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        // Check if tab still exists before clearing badge
        chrome.tabs.get(tab.id, (existingTab) => {
          if (!chrome.runtime.lastError && existingTab) {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
          }
        });
      }, 3000);
    }
    
  } catch (error) {
    console.error('Save item error:', error);
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Error',
      message: 'Failed to save item. Please try again.'
    });
    
    // Update badge to show error
    if (tab && tab.id) {
      chrome.action.setBadgeText({ text: '!', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#F44336', tabId: tab.id });
    }
  }
}

// Delete saved item
async function deleteSavedItem(id) {
  const { savedItems } = await chrome.storage.local.get(['savedItems']);
  const items = savedItems || [];
  
  const filteredItems = items.filter(item => item.id !== id);
  
  await chrome.storage.local.set({ savedItems: filteredItems });
}

// Update saved item
async function updateSavedItem(id, updates) {
  const { savedItems } = await chrome.storage.local.get(['savedItems']);
  const items = savedItems || [];
  
  const itemIndex = items.findIndex(item => item.id === id);
  if (itemIndex !== -1) {
    items[itemIndex] = { ...items[itemIndex], ...updates };
    
    await chrome.storage.local.set({ savedItems: items });
  }
}

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  // Ensure storage is initialized
  const { savedItems } = await chrome.storage.local.get(['savedItems']);
  if (!savedItems) {
    chrome.storage.local.set({ savedItems: [] });
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Open saved items page
    chrome.tabs.create({ url: chrome.runtime.getURL('saved-items.html') });
  }
});

// Update user analytics
async function updateUserAnalytics(action, item) {
  try {
    // Get current user stats
    const userId = await getUserId();
    const result = await chrome.storage.local.get([`userStats_${userId}`]);
    let stats = result[`userStats_${userId}`] || {
      totalArticles: 0,
      readArticles: 0,
      readStreak: 0,
      longestStreak: 0,
      totalReadingTime: 0,
      lastReadDate: null,
      achievements: []
    };
    
    if (action === 'articleSaved') {
      stats.totalArticles++;
      console.log('Updated total articles:', stats.totalArticles);
    } else if (action === 'articleRead') {
      if (!item.read) {
        stats.readArticles++;
        
        // Update reading time
        if (item.readingTime) {
          stats.totalReadingTime += item.readingTime;
        }
        
        // Update read streak
        const today = new Date().toDateString();
        const lastRead = stats.lastReadDate ? new Date(stats.lastReadDate).toDateString() : null;
        
        if (lastRead === today) {
          // Already read today, no streak change
        } else if (lastRead === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) {
          // Read yesterday, increment streak
          stats.readStreak++;
        } else {
          // Gap in reading, reset streak to 1
          stats.readStreak = 1;
        }
        
        stats.lastReadDate = new Date().toISOString();
        
        // Update longest streak
        if (stats.readStreak > stats.longestStreak) {
          stats.longestStreak = stats.readStreak;
        }
        
        console.log('Updated read articles:', stats.readArticles, 'streak:', stats.readStreak);
      }
    }
    
    // Save updated stats
    await chrome.storage.local.set({ [`userStats_${userId}`]: stats });
    console.log('User analytics updated successfully');
    
  } catch (error) {
    console.error('Error updating user analytics:', error);
    // Don't throw - analytics failure shouldn't break saving
  }
}

// Get or create user ID
async function getUserId() {
  const result = await chrome.storage.local.get(['readLaterUserId']);
  let userId = result.readLaterUserId;
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ readLaterUserId: userId });
  }
  return userId;
}