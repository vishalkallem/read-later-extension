// Content script to extract page data and handle text selection

// Wrap everything in an IIFE to avoid global scope pollution
(function() {
  'use strict';
  
  // Check if already injected
  if (window.__readLaterContentScriptInjected) {
    console.log('Read Later content script already injected, skipping...');
    return;
  }
  window.__readLaterContentScriptInjected = true;
  
  console.log('Read Later content script loaded for:', window.location.href);

  // Calculate reading time based on word count
  function calculateReadingTime(text) {
    if (!text) return 0;
    
    // Average reading speed: 225 words per minute
    const wordsPerMinute = 225;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    
    return minutes;
  }

  // Extract page metadata
  function extractPageMetadata() {
  const metadata = {
    title: '',
    author: '',
    url: window.location.href,
    selectedText: '',
    fullContent: '',
    timestamp: new Date().toISOString(),
    readingTime: 0
  };

  // Get page title
  metadata.title = document.title || 
    document.querySelector('meta[property="og:title"]')?.content || 
    document.querySelector('h1')?.textContent?.trim() || 
    'Untitled';

  // Try to extract author from various sources
  const authorSelectors = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
    '[rel="author"]',
    '.author-name',
    '.by-author',
    '.article-author',
    '[itemprop="author"]',
    // Reddit specific
    '[data-testid="post_author_link"]',
    'a[href^="/user/"]',
    // X/Twitter specific
    '[data-testid="User-Name"] span',
    'div[data-testid="UserName"] span'
  ];

  // Special handling for Reddit
  if (window.location.hostname.includes('reddit.com')) {
    const authorLink = document.querySelector('[data-testid="post_author_link"]');
    if (authorLink) {
      metadata.author = 'u/' + authorLink.textContent?.trim();
    }
  }
  // Special handling for X/Twitter
  else if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) {
    const userNameElement = document.querySelector('[data-testid="User-Name"] span');
    if (userNameElement) {
      metadata.author = '@' + userNameElement.textContent?.trim().replace('@', '');
    }
  }
  // Generic author extraction
  else {
    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        metadata.author = element.content || element.textContent?.trim() || '';
        break;
      }
    }
  }

  // Get selected text if any
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    metadata.selectedText = selection.toString().trim();
  }

  // Extract main content using readability.js for better results
  // Special handling for Reddit
  if (window.location.hostname.includes('reddit.com')) {
    // Get post title
    const postTitle = document.querySelector('h1[slot="title"]');
    if (postTitle) {
      metadata.title = postTitle.textContent?.trim() || metadata.title;
    }
    
    // Get post content
    const postContent = document.querySelector('[data-testid="post-content"]');
    if (postContent) {
      metadata.fullContent = postContent.textContent?.trim() || '';
    }
    
    // For comments, get the specific comment
    if (window.location.pathname.includes('/comments/')) {
      const focusedComment = document.querySelector('.Comment.focused') || 
                            document.querySelector('[data-testid="comment"]');
      if (focusedComment && metadata.selectedText) {
        metadata.fullContent = metadata.selectedText;
      }
    }
  }
  // Special handling for X/Twitter
  else if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) {
    // Get tweet content
    const tweetArticle = document.querySelector('article[data-testid="tweet"]');
    if (tweetArticle) {
      const tweetText = tweetArticle.querySelector('[data-testid="tweetText"]');
      if (tweetText) {
        metadata.fullContent = tweetText.textContent?.trim() || '';
      }
      
      // Get thread if it's a thread
      const thread = document.querySelectorAll('article[data-testid="tweet"]');
      if (thread.length > 1) {
        const threadTexts = [];
        thread.forEach(tweet => {
          const text = tweet.querySelector('[data-testid="tweetText"]');
          if (text) {
            threadTexts.push(text.textContent?.trim());
          }
        });
        metadata.fullContent = threadTexts.join('\n\n---\n\n');
      }
    }
  }
  // Use readability.js for better content extraction
  else {
    try {
      // Check if readability is available
      if (typeof Readability !== 'undefined') {
        const documentClone = document.cloneNode(true);
        const article = new Readability(documentClone).parse();
        
        if (article && article.textContent) {
          metadata.fullContent = article.textContent.trim();
          // Use readability title if it's better
          if (article.title && article.title.length > metadata.title.length) {
            metadata.title = article.title;
          }
        }
      } else {
        // Fallback to manual extraction
        const contentSelectors = [
          'article',
          '[role="main"]',
          'main',
          '.post-content',
          '.article-content',
          '.entry-content',
          '#content',
          '.content'
        ];

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            metadata.fullContent = element.textContent?.trim() || '';
            break;
          }
        }
      }
    } catch (error) {
      console.log('Readability extraction failed, using fallback:', error);
      // Fallback to manual extraction
      const contentSelectors = [
        'article',
        '[role="main"]',
        'main',
        '.post-content',
        '.article-content',
        '.entry-content',
        '#content',
        '.content'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          metadata.fullContent = element.textContent?.trim() || '';
          break;
        }
      }
    }
  }

  // If no specific content area found, get body text
  if (!metadata.fullContent) {
    metadata.fullContent = document.body.textContent?.trim() || '';
  }

  // Calculate reading time based on content
  const contentToMeasure = metadata.selectedText || metadata.fullContent;
  metadata.readingTime = calculateReadingTime(contentToMeasure);

  return metadata;
}

// Check if extension context is valid
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime.id - will throw if context is invalid
    return chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Clean up function to stop sending messages when context is invalid
let contextValid = true;
function checkContextPeriodically() {
  if (!isExtensionContextValid()) {
    contextValid = false;
    // Remove event listeners to prevent errors
    document.removeEventListener('mouseup', handleMouseUp);
  }
}

// Check context every 5 seconds
setInterval(checkContextPeriodically, 5000);

// Message handler function
function handleMessage(request, sender, sendResponse) {
  // Double-check context is still valid
  if (!isExtensionContextValid() || !contextValid) {
    console.log('Extension context invalid, ignoring message');
    return false;
  }
  
  try {
    console.log('Content script received message:', request.action);
    
    if (request.action === 'extractData') {
      const data = extractPageMetadata();
      console.log('Extracted data:', { title: data.title, author: data.author, readingTime: data.readingTime });
      sendResponse(data);
    } else if (request.action === 'getSelectedText') {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';
      console.log('Selected text length:', selectedText.length);
      sendResponse({ selectedText });
    }
    return true; // Keep the message channel open for async response
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
    return false;
  }
}

// Listen for messages from the background script
if (isExtensionContextValid()) {
  try {
    chrome.runtime.onMessage.addListener(handleMessage);
  } catch (error) {
    // Failed to add listener - extension context likely invalid
  }
}

// Handle mouseup events for text selection
function handleMouseUp() {
  // Check if extension context is still valid before sending message
  if (!isExtensionContextValid() || !contextValid) {
    return; // Silently skip if context is invalid
  }
  
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    try {
      // Use callback instead of promise to handle errors
      chrome.runtime.sendMessage({
        action: 'textSelected',
        text: selection.toString().trim()
      }, response => {
        // Check for errors in callback
        if (chrome.runtime.lastError) {
          // Silently ignore - extension was likely reloaded
          return;
        }
      });
    } catch (error) {
      // Silently fail if extension context is invalidated
      // This happens when the extension is reloaded
    }
  }
}

  // Send selected text to background script when user selects text
  document.addEventListener('mouseup', handleMouseUp);
  
})(); // End of IIFE 