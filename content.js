// Content script to extract page data and handle text selection

// Extract page metadata
function extractPageMetadata() {
  const metadata = {
    title: '',
    author: '',
    url: window.location.href,
    selectedText: '',
    fullContent: '',
    timestamp: new Date().toISOString()
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

  // Extract main content (for full article save)
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
  // Generic content extraction
  else {
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

  // If no specific content area found, get body text
  if (!metadata.fullContent) {
    metadata.fullContent = document.body.textContent?.trim() || '';
  }

  return metadata;
}

// Check if extension context is valid
function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Listen for messages from the background script
if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
      const data = extractPageMetadata();
      sendResponse(data);
    } else if (request.action === 'getSelectedText') {
      const selection = window.getSelection();
      sendResponse({ selectedText: selection ? selection.toString().trim() : '' });
    }
    return true; // Keep the message channel open for async response
  });
}

// Send selected text to background script when user selects text
document.addEventListener('mouseup', () => {
  // Check if extension context is still valid before sending message
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping message');
    return;
  }
  
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    try {
      chrome.runtime.sendMessage({
        action: 'textSelected',
        text: selection.toString().trim()
      }).catch(error => {
        // Silently fail if extension context is invalidated
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('Extension reloaded, message not sent');
        }
      });
    } catch (error) {
      // Silently fail if extension context is invalidated
      console.log('Extension context error:', error.message);
    }
  }
}); 