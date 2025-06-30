// Saved items page functionality

let allItems = [];
let filteredItems = [];
let currentView = 'grid';
let currentItem = null;
let selectedTag = null;
let selectedDomain = null;

// User Analytics Class
class UserAnalytics {
  constructor() {
    this.userId = null;
    this.stats = {
      totalArticles: 0,
      readArticles: 0,
      readStreak: 0,
      longestStreak: 0,
      totalReadingTime: 0, // in minutes
      lastReadDate: null,
      achievements: []
    };
  }

  // Initialize the user ID (call this before using other methods)
  async initialize() {
    this.userId = await this.getUserId();
    console.log('UserAnalytics initialized with userId:', this.userId);
  }

  // Generate or get existing user ID
  async getUserId() {
    try {
      const result = await chrome.storage.local.get(['readLaterUserId']);
      let userId = result.readLaterUserId;
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ readLaterUserId: userId });
      }
      return userId;
    } catch (error) {
      console.error('Error getting user ID:', error);
      // Fallback to localStorage if chrome.storage fails
      let userId = localStorage.getItem('readLaterUserId');
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('readLaterUserId', userId);
      }
      return userId;
    }
  }

  // Load user stats from storage
  async loadStats() {
    try {
      console.log('Loading user stats for userId:', this.userId);
      const result = await chrome.storage.local.get([`userStats_${this.userId}`]);
      console.log('Loaded user stats result:', result);
      if (result[`userStats_${this.userId}`]) {
        this.stats = { ...this.stats, ...result[`userStats_${this.userId}`] };
        console.log('Updated stats object:', this.stats);
      } else {
        console.log('No existing user stats found, using defaults');
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  }

  // Save user stats to storage
  async saveStats() {
    try {
      await chrome.storage.local.set({ [`userStats_${this.userId}`]: this.stats });
    } catch (error) {
      console.error('Error saving user stats:', error);
    }
  }

  // Update stats when article is saved
  async articleSaved(article) {
    this.stats.totalArticles++;
    await this.saveStats();
  }

  // Update stats when article is read
  async articleRead(article) {
    if (!article.read) {
      this.stats.readArticles++;
      
      // Update reading time
      if (article.readingTime) {
        this.stats.totalReadingTime += article.readingTime;
      }
      
      // Update read streak
      const today = new Date().toDateString();
      const lastRead = this.stats.lastReadDate ? new Date(this.stats.lastReadDate).toDateString() : null;
      
      if (lastRead === today) {
        // Already read today, no streak change
      } else if (lastRead === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) {
        // Read yesterday, increment streak
        this.stats.readStreak++;
      } else {
        // Gap in reading, reset streak to 1
        this.stats.readStreak = 1;
      }
      
      this.stats.lastReadDate = new Date().toISOString();
      
      // Update longest streak
      if (this.stats.readStreak > this.stats.longestStreak) {
        this.stats.longestStreak = this.stats.readStreak;
      }
      
      await this.saveStats();
      await this.checkAchievements();
    }
  }

  // Check for achievements
  async checkAchievements() {
    const newAchievements = [];
    
    // Reading streak achievements
    if (this.stats.readStreak >= 7 && !this.stats.achievements.includes('week_warrior')) {
      newAchievements.push('week_warrior');
    }
    if (this.stats.readStreak >= 30 && !this.stats.achievements.includes('month_master')) {
      newAchievements.push('month_master');
    }
    if (this.stats.readStreak >= 100 && !this.stats.achievements.includes('century_club')) {
      newAchievements.push('century_club');
    }
    
    // Reading time achievements
    if (this.stats.totalReadingTime >= 60 && !this.stats.achievements.includes('hour_reader')) {
      newAchievements.push('hour_reader');
    }
    if (this.stats.totalReadingTime >= 600 && !this.stats.achievements.includes('ten_hour_reader')) {
      newAchievements.push('ten_hour_reader');
    }
    
    // Article count achievements
    if (this.stats.totalArticles >= 10 && !this.stats.achievements.includes('collector')) {
      newAchievements.push('collector');
    }
    if (this.stats.totalArticles >= 100 && !this.stats.achievements.includes('hoarder')) {
      newAchievements.push('hoarder');
    }
    
    if (newAchievements.length > 0) {
      this.stats.achievements.push(...newAchievements);
      await this.saveStats();
      this.showAchievementNotification(newAchievements);
    }
  }

  // Show achievement notification
  showAchievementNotification(achievements) {
    const achievementNames = {
      'week_warrior': 'Week Warrior',
      'month_master': 'Month Master', 
      'century_club': 'Century Club',
      'hour_reader': 'Hour Reader',
      'ten_hour_reader': 'Ten Hour Reader',
      'collector': 'Collector',
      'hoarder': 'Hoarder'
    };
    
    achievements.forEach(achievement => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: '🏆 Achievement Unlocked!',
        message: `You've earned the "${achievementNames[achievement]}" badge!`
      });
    });
  }

  // Get current stats
  getStats() {
    const stats = {
      ...this.stats,
      readPercentage: this.stats.totalArticles > 0 ? Math.round((this.stats.readArticles / this.stats.totalArticles) * 100) : 0
    };
    console.log('getStats() called, returning:', stats);
    return stats;
  }

  // Reset stats (for testing)
  async resetStats() {
    this.stats = {
      totalArticles: 0,
      readArticles: 0,
      readStreak: 0,
      longestStreak: 0,
      totalReadingTime: 0,
      lastReadDate: null,
      achievements: []
    };
    await this.saveStats();
  }
}

// Initialize user analytics
let userAnalytics = new UserAnalytics();

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - starting initialization');
  initializeDarkMode();
  console.log('Dark mode initialized');
  
  await userAnalytics.initialize();
  console.log('User analytics initialized');
  
  await userAnalytics.loadStats();
  console.log('User analytics loaded');
  
  await loadItems();
  console.log('Items loaded');
  
  setupEventListeners();
  console.log('Event listeners set up');
  
  updateShortcutDisplay();
  updateItemCount();
  buildTagCloud();
  buildDomainFilter();
  
  console.log('About to update analytics display');
  updateAnalyticsDisplay();
  
  // Check for analytics inconsistencies
  await checkAndFixAnalytics();
  
  console.log('Initialization complete');
});

// Initialize dark mode
function initializeDarkMode() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggle(savedTheme);
}

// Toggle dark mode
function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeToggle(newTheme);
}

// Update theme toggle button
function updateThemeToggle(theme) {
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  if (theme === 'dark') {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  } else {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  }
}

// Load items from storage
async function loadItems() {
  allItems = await chrome.runtime.sendMessage({ action: 'getSavedItems' });
  
  console.log('Loaded items from storage:', allItems.length);
  
  // Reset analytics and recalculate from existing items
  await userAnalytics.resetStats();
  
  // Initialize analytics with existing items
  for (const item of allItems) {
    await userAnalytics.articleSaved(item);
    if (item.read) {
      await userAnalytics.articleRead(item);
    }
  }
  
  console.log('Analytics updated from existing items');
  
  // Debug: Log items with tags
  const itemsWithTags = allItems.filter(item => item.tags && item.tags.length > 0);
  console.log('Items with tags:', itemsWithTags.length);
  if (itemsWithTags.length > 0) {
    console.log('Sample item with tags:', itemsWithTags[0]);
  }
  
  filterAndDisplayItems();
}

// Set up event listeners
function setupEventListeners() {
  // Dark mode toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleDarkMode);
  
  // Refresh analytics (debug button)
  document.getElementById('refresh-analytics').addEventListener('click', async () => {
    console.log('Manual refresh analytics clicked');
    await syncAnalyticsWithItems();
  });
  
  // Search
  document.getElementById('search-input').addEventListener('input', debounce(filterAndDisplayItems, 300));
  
  // Filters
  document.getElementById('filter-status').addEventListener('change', filterAndDisplayItems);
  document.getElementById('filter-domain').addEventListener('change', handleDomainFilterChange);
  document.getElementById('sort-by').addEventListener('change', handleSortChange);
  document.getElementById('filter-tag').addEventListener('change', handleTagFilterChange);
  
  // View controls
  document.getElementById('view-grid').addEventListener('click', () => setView('grid'));
  document.getElementById('view-list').addEventListener('click', () => setView('list'));
  
  // Export/Import
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('import-data').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('import-kindle').addEventListener('click', () => {
    document.getElementById('import-kindle-file').click();
  });
  document.getElementById('import-kindle-file').addEventListener('change', importKindleData);
  
  // Modal
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveItemChanges);
  document.getElementById('modal-delete').addEventListener('click', deleteCurrentItem);
  document.getElementById('modal-tags-input').addEventListener('keypress', handleTagInput);
  
  // Close modal on backdrop click
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
}

// Handle sort change
function handleSortChange() {
  const sortBy = document.getElementById('sort-by').value;
  const tagFilter = document.getElementById('filter-tag');
  const tagCloud = document.getElementById('tag-cloud');
  
  if (sortBy === 'tag') {
    tagFilter.classList.remove('hidden');
    tagCloud.classList.add('visible');
    buildTagCloud();
  } else {
    tagFilter.classList.add('hidden');
    tagFilter.value = 'all';
    tagCloud.classList.remove('visible');
    selectedTag = null;
  }
  
  filterAndDisplayItems();
}

// Handle tag filter change
function handleTagFilterChange() {
  const tagValue = document.getElementById('filter-tag').value;
  selectedTag = tagValue === 'all' ? null : tagValue;
  
  // Update tag cloud active state
  document.querySelectorAll('.tag-chip').forEach(chip => {
    if (chip.dataset.tag === selectedTag) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  
  filterAndDisplayItems();
}

// Handle domain filter change
function handleDomainFilterChange() {
  const domainValue = document.getElementById('filter-domain').value;
  selectedDomain = domainValue === 'all' ? null : domainValue;
  filterAndDisplayItems();
}

// Build tag cloud
function buildTagCloud() {
  const tagCounts = {};
  
  // Count tags
  allItems.forEach(item => {
    (item.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  // Sort tags by count
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20); // Show top 20 tags
  
  // Update tag filter dropdown
  const tagFilter = document.getElementById('filter-tag');
  tagFilter.innerHTML = '<option value="all">All Tags</option>' +
    sortedTags.map(([tag, count]) => 
      `<option value="${escapeHtml(tag)}">${escapeHtml(tag)} (${count})</option>`
    ).join('');
  
  // Build tag cloud UI
  const tagCloudContent = document.createElement('div');
  tagCloudContent.className = 'tag-cloud-content';
  tagCloudContent.innerHTML = sortedTags.map(([tag, count]) => 
    `<span class="tag-chip ${selectedTag === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
      ${escapeHtml(tag)} <span class="tag-chip-count">${count}</span>
    </span>`
  ).join('');
  
  const tagCloud = document.getElementById('tag-cloud');
  tagCloud.innerHTML = '';
  tagCloud.appendChild(tagCloudContent);
  
  // Add click listeners
  tagCloudContent.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      document.getElementById('filter-tag').value = tag;
      handleTagFilterChange();
    });
  });
}

// Build domain filter
function buildDomainFilter() {
  const domainCounts = {};
  
  // Count domains
  allItems.forEach(item => {
    if (item.url) {
      try {
        // Handle Kindle URLs specially
        if (item.source === 'kindle' || item.url.startsWith('kindle://')) {
          domainCounts['Kindle Books'] = (domainCounts['Kindle Books'] || 0) + 1;
        } else {
          const domain = new URL(item.url).hostname;
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
      } catch (error) {
        console.warn('Invalid URL for domain filter:', item.url, error);
        domainCounts['Invalid URL'] = (domainCounts['Invalid URL'] || 0) + 1;
      }
    }
  });
  
  // Sort domains by count
  const sortedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20); // Show top 20 domains
  
  // Update domain filter dropdown
  const domainFilter = document.getElementById('filter-domain');
  domainFilter.innerHTML = '<option value="all">All Domains</option>' +
    sortedDomains.map(([domain, count]) => 
      `<option value="${escapeHtml(domain)}">${escapeHtml(domain)} (${count})</option>`
    ).join('');
}

// Update item count
function updateItemCount() {
  const count = document.querySelector('.item-count');
  if (count) {
    count.textContent = `(${allItems.length} items)`;
  }
}

// Filter and display items
function filterAndDisplayItems() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  const filterStatus = document.getElementById('filter-status').value;
  const sortBy = document.getElementById('sort-by').value;
  
  // Filter items
  filteredItems = allItems.filter(item => {
    // Search filter
    const matchesSearch = !searchTerm || 
      item.title.toLowerCase().includes(searchTerm) ||
      item.author.toLowerCase().includes(searchTerm) ||
      item.highlights.toLowerCase().includes(searchTerm) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm)) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
    
    // Status filter
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'read' && item.read) ||
      (filterStatus === 'unread' && !item.read) ||
      (filterStatus === 'kindle' && (item.source === 'kindle' || item.url.startsWith('kindle://')));
    
    // Tag filter
    const matchesTag = !selectedTag || 
      (item.tags && item.tags.includes(selectedTag));
    
    // Domain filter
    const matchesDomain = !selectedDomain || 
      (item.url && (() => {
        try {
          // Handle Kindle URLs specially
          if (item.source === 'kindle' || item.url.startsWith('kindle://')) {
            return selectedDomain === 'Kindle Books';
          } else {
            return new URL(item.url).hostname === selectedDomain;
          }
        } catch (error) {
          console.warn('Invalid URL for domain filtering:', item.url, error);
          return selectedDomain === 'Invalid URL';
        }
      })());
    
    return matchesSearch && matchesStatus && matchesTag && matchesDomain;
  });
  
  // Sort items
  filteredItems.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.savedAt) - new Date(a.savedAt);
      case 'oldest':
        return new Date(a.savedAt) - new Date(b.savedAt);
      case 'title':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'domain':
        const getDomain = (item) => {
          try {
            if (item.source === 'kindle' || item.url.startsWith('kindle://')) {
              return 'Kindle Books';
            } else {
              return new URL(item.url).hostname;
            }
          } catch (error) {
            return 'Invalid URL';
          }
        };
        const domainA = getDomain(a);
        const domainB = getDomain(b);
        return domainA.localeCompare(domainB);
      case 'read-status':
        // Unread first, then read
        if (a.read !== b.read) {
          return a.read ? 1 : -1;
        }
        // Then by date (newest first)
        return new Date(b.savedAt) - new Date(a.savedAt);
      case 'kindle-author':
        // Sort Kindle items by author, then by title
        const aIsKindle = a.source === 'kindle' || a.url.startsWith('kindle://');
        const bIsKindle = b.source === 'kindle' || b.url.startsWith('kindle://');
        
        if (aIsKindle && bIsKindle) {
          const authorCompare = a.author.localeCompare(b.author);
          if (authorCompare !== 0) return authorCompare;
          return a.title.localeCompare(b.title);
        }
        // Put Kindle items first
        if (aIsKindle && !bIsKindle) return -1;
        if (!aIsKindle && bIsKindle) return 1;
        // Then sort by date
        return new Date(b.savedAt) - new Date(a.savedAt);
      case 'tag':
        // Sort by number of tags, then alphabetically
        const aTagCount = (a.tags || []).length;
        const bTagCount = (b.tags || []).length;
        if (aTagCount !== bTagCount) return bTagCount - aTagCount;
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
  
  displayItems();
}

// Get link preview data
function getLinkPreviewData(item) {
  let domain = 'Unknown';
  let isReddit = false;
  let isTwitter = false;
  let isKindle = item.source === 'kindle' || (item.url && item.url.startsWith('kindle://'));
  
  // Safely extract domain from URL
  try {
    if (item.url && !isKindle) {
      const url = new URL(item.url);
      domain = url.hostname;
      isReddit = domain.includes('reddit.com');
      isTwitter = domain.includes('twitter.com') || domain.includes('x.com');
    }
  } catch (error) {
    console.warn('Invalid URL for item:', item.url, error);
    domain = 'Invalid URL';
  }
  
  let icon = `
    <svg class="link-preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  `;
  
  if (isReddit) {
    icon = `<img src="https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png" class="link-preview-favicon" alt="Reddit">`;
  } else if (isTwitter) {
    icon = `<img src="https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png" class="link-preview-favicon" alt="X">`;
  } else if (isKindle) {
    icon = `
      <svg class="link-preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    `;
  }
  
  return {
    icon,
    favicon: isKindle ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTkuNUMyLjUgMTkuNSAxLjUgMTguNSAxLjUgMTdWNUMyLjUgMy41IDMuNSAyLjUgNSAyLjVIMTlDMTkuNSAyLjUgMjAgMyAyMCAzLjVWMjBDMjAgMjAuNSAxOS41IDIxIDE5IDIxSDVDNC41IDIxIDQgMjAuNSA0IDIwVjE5LjVaIiBmaWxsPSIjRkY5ODAwIi8+CjxwYXRoIGQ9Ik02IDVIMTgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNNiA5SDE4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTYgMTNIMTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K' : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    domain: isKindle ? 'Kindle Book' : domain
  };
}

// Display items
function displayItems() {
  const container = document.getElementById('items-container');
  const emptyState = document.getElementById('empty-state');
  
  if (filteredItems.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  const sortBy = document.getElementById('sort-by').value;
  
  if (sortBy === 'domain') {
    // Group by domain
    const groupedItems = groupItemsByDomain(filteredItems);
    container.innerHTML = createGroupedItemsHTML(groupedItems);
  } else {
    // Regular display
    container.innerHTML = filteredItems.map(item => createItemHTML(item)).join('');
  }
  
  // Add click listeners to items
  container.querySelectorAll('.item-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.item-action')) {
        openItem(el.dataset.id);
      }
    });
  });
  
  // Add click listeners to action buttons
  container.querySelectorAll('.item-mark-read').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReadStatus(el.dataset.id);
    });
  });
  
  container.querySelectorAll('.item-open').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.create({ url: el.dataset.url });
    });
  });
  
  // Add click listeners to tags
  container.querySelectorAll('.item-tag').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = el.textContent;
      document.getElementById('sort-by').value = 'tag';
      handleSortChange();
      document.getElementById('filter-tag').value = tag;
      handleTagFilterChange();
    });
  });
}

// Create item HTML
function createItemHTML(item) {
  const date = new Date(item.savedAt).toLocaleDateString();
  const previewData = getLinkPreviewData(item);
  const readClass = item.read ? 'read' : '';
  
  // Format reading time
  let readingTimeText = '';
  if (item.readingTime) {
    if (item.readingTime < 1) {
      readingTimeText = '< 1 min read';
    } else if (item.readingTime === 1) {
      readingTimeText = '1 min read';
    } else {
      readingTimeText = `${item.readingTime} min read`;
    }
  }
  
  // Format metadata for clipping.io items
  let metadataText = '';
  if (item.metadata && Object.keys(item.metadata).length > 0) {
    const metadataParts = [];
    if (item.metadata['Added on']) metadataParts.push(`Added: ${item.metadata['Added on']}`);
    if (item.metadata['Location']) metadataParts.push(`Loc: ${item.metadata['Location']}`);
    if (item.metadata['Page']) metadataParts.push(`Pg: ${item.metadata['Page']}`);
    metadataText = metadataParts.join(' • ');
  }
  
  return `
    <div class="item-card ${readClass}" data-id="${item.id}">
      <div class="link-preview">
        ${previewData.icon}
        <img src="${previewData.favicon}" class="link-preview-favicon" alt="">
      </div>
      <div class="item-content">
        <div class="item-header">
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
        </div>
        <div class="item-meta">
          <span class="item-author">${escapeHtml(item.author)}</span>
          <span>•</span>
          <span>${previewData.domain}</span>
          <span>•</span>
          <span>${date}</span>
          ${readingTimeText ? `<span>•</span><span class="item-reading-time">${readingTimeText}</span>` : ''}
        </div>
        ${metadataText ? `<div class="item-metadata">${escapeHtml(metadataText)}</div>` : ''}
        ${item.highlights ? `<div class="item-highlight">${escapeHtml(truncate(item.highlights, 150))}</div>` : ''}
        ${item.notes ? `<div class="item-notes">${escapeHtml(truncate(item.notes, 100))}</div>` : ''}
        ${item.tags && item.tags.length > 0 ? `<div class="item-tags">${item.tags.map(tag => `<span class="item-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="item-action item-mark-read" data-id="${item.id}" title="${item.read ? 'Mark as unread' : 'Mark as read'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${item.read ? 
              '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle>' : 
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'}
          </svg>
        </button>
        <button class="item-action item-open" data-url="${item.url}" title="Open in new tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// Set view mode
function setView(view) {
  currentView = view;
  const container = document.getElementById('items-container');
  
  if (view === 'grid') {
    container.className = 'items-grid';
    document.getElementById('view-grid').classList.add('active');
    document.getElementById('view-list').classList.remove('active');
  } else {
    container.className = 'items-list';
    document.getElementById('view-list').classList.add('active');
    document.getElementById('view-grid').classList.remove('active');
  }
  
  displayItems();
}

// Open item modal
function openItem(id) {
  currentItem = allItems.find(item => item.id === id);
  if (!currentItem) return;
  
  // Mark as read
  if (!currentItem.read) {
    toggleReadStatus(id);
  }
  
  // Format reading time
  let readingTimeText = '';
  if (currentItem.readingTime) {
    if (currentItem.readingTime < 1) {
      readingTimeText = '< 1 min read';
    } else if (currentItem.readingTime === 1) {
      readingTimeText = '1 min read';
    } else {
      readingTimeText = `${currentItem.readingTime} min read`;
    }
  }
  
  // Populate modal
  document.getElementById('modal-title').textContent = currentItem.title;
  document.getElementById('modal-author').textContent = currentItem.author;
  document.getElementById('modal-date').textContent = new Date(currentItem.savedAt).toLocaleString() + 
    (readingTimeText ? ` • ${readingTimeText}` : '');
  document.getElementById('modal-url').href = currentItem.url;
  
  // Display highlights and metadata
  let highlightsText = currentItem.highlights || 'No highlights saved';
  if (currentItem.metadata && Object.keys(currentItem.metadata).length > 0) {
    const metadataText = Object.entries(currentItem.metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    highlightsText += '\n\n--- Metadata ---\n' + metadataText;
  }
  document.getElementById('modal-highlights').textContent = highlightsText;
  
  document.getElementById('modal-notes-input').value = currentItem.notes || '';
  
  // Display tags
  const tagsContainer = document.getElementById('modal-tags-list');
  tagsContainer.innerHTML = (currentItem.tags || []).map(tag => 
    `<span class="modal-tag">${escapeHtml(tag)} <span class="modal-tag-remove" data-tag="${escapeHtml(tag)}">&times;</span></span>`
  ).join('');
  
  // Add tag remove listeners
  tagsContainer.querySelectorAll('.modal-tag-remove').forEach(el => {
    el.addEventListener('click', () => removeTag(el.dataset.tag));
  });
  
  // Show modal
  document.getElementById('item-modal').classList.remove('hidden');
}

// Close modal
function closeModal() {
  document.getElementById('item-modal').classList.add('hidden');
  currentItem = null;
}

// Save item changes
async function saveItemChanges() {
  if (!currentItem) return;
  
  const notes = document.getElementById('modal-notes-input').value;
  const tags = Array.from(document.querySelectorAll('#modal-tags-list .modal-tag'))
    .map(tag => tag.textContent.replace('×', '').trim());
  
  // Check if item was marked as read
  const wasUnread = !currentItem.read;
  const isNowRead = document.getElementById('modal-title').classList.contains('read');
  
  currentItem.notes = notes;
  currentItem.tags = tags;
  currentItem.read = isNowRead;
  
  // Track analytics for read status change
  if (wasUnread && isNowRead) {
    // Item was marked as read - increment read count
    const itemForAnalytics = { ...currentItem, read: false };
    await userAnalytics.articleRead(itemForAnalytics);
  } else if (!wasUnread && !isNowRead) {
    // Item was marked as unread - decrement read count
    userAnalytics.stats.readArticles = Math.max(0, userAnalytics.stats.readArticles - 1);
    if (currentItem.readingTime) {
      userAnalytics.stats.totalReadingTime = Math.max(0, userAnalytics.stats.totalReadingTime - currentItem.readingTime);
    }
    await userAnalytics.saveStats();
  }
  
  // Update item in storage
  const index = allItems.findIndex(item => item.id === currentItem.id);
  if (index !== -1) {
    allItems[index] = currentItem;
    await chrome.storage.local.set({ savedItems: allItems });
  }
  
  closeModal();
  filterAndDisplayItems();
  updateItemCount();
  buildTagCloud();
  buildDomainFilter();
  updateAnalyticsDisplay();
}

// Delete current item
async function deleteCurrentItem() {
  if (!currentItem || !confirm('Are you sure you want to delete this item?')) return;
  
  // Track analytics for deletion
  if (currentItem.read) {
    // Decrement read count if item was read
    userAnalytics.stats.readArticles = Math.max(0, userAnalytics.stats.readArticles - 1);
    if (currentItem.readingTime) {
      userAnalytics.stats.totalReadingTime = Math.max(0, userAnalytics.stats.totalReadingTime - currentItem.readingTime);
    }
  }
  // Decrement total count
  userAnalytics.stats.totalArticles = Math.max(0, userAnalytics.stats.totalArticles - 1);
  
  // Save updated analytics
  await userAnalytics.saveStats();
  
  await chrome.runtime.sendMessage({
    action: 'deleteSavedItem',
    id: currentItem.id
  });
  
  // Update local data
  allItems = allItems.filter(item => item.id !== currentItem.id);
  
  closeModal();
  filterAndDisplayItems();
  updateItemCount();
  buildTagCloud();
  buildDomainFilter();
  updateAnalyticsDisplay();
}

// Toggle read status
async function toggleReadStatus(id) {
  const item = allItems.find(item => item.id === id);
  if (!item) return;
  
  const wasUnread = !item.read;
  item.read = !item.read;
  
  // Track analytics
  if (wasUnread && item.read) {
    // Item was marked as read - increment read count
    const itemForAnalytics = { ...item, read: false };
    await userAnalytics.articleRead(itemForAnalytics);
  } else if (!wasUnread && !item.read) {
    // Item was marked as unread - decrement read count
    userAnalytics.stats.readArticles = Math.max(0, userAnalytics.stats.readArticles - 1);
    if (item.readingTime) {
      userAnalytics.stats.totalReadingTime = Math.max(0, userAnalytics.stats.totalReadingTime - item.readingTime);
    }
    await userAnalytics.saveStats();
  }
  
  await chrome.runtime.sendMessage({
    action: 'updateSavedItem',
    id: id,
    updates: { read: item.read }
  });
  
  displayItems();
  updateAnalyticsDisplay();
}

// Handle tag input
function handleTagInput(e) {
  if (e.key === 'Enter' && currentItem) {
    e.preventDefault();
    const input = e.target;
    const tag = input.value.trim();
    
    if (tag && (!currentItem.tags || !currentItem.tags.includes(tag))) {
      currentItem.tags = currentItem.tags || [];
      currentItem.tags.push(tag);
      
      chrome.runtime.sendMessage({
        action: 'updateSavedItem',
        id: currentItem.id,
        updates: { tags: currentItem.tags }
      });
      
      // Re-render tags
      openItem(currentItem.id);
      input.value = '';
      
      // Update tag cloud
      buildTagCloud();
    }
  }
}

// Remove tag
function removeTag(tag) {
  if (!currentItem || !currentItem.tags) return;
  
  currentItem.tags = currentItem.tags.filter(t => t !== tag);
  
  chrome.runtime.sendMessage({
    action: 'updateSavedItem',
    id: currentItem.id,
    updates: { tags: currentItem.tags }
  });
  
  // Re-render tags
  openItem(currentItem.id);
  
  // Update tag cloud
  buildTagCloud();
}

// Export data
function exportData() {
  const dataStr = JSON.stringify(allItems, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `read-later-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Import data
async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedItems = JSON.parse(text);
    
    if (!Array.isArray(importedItems)) {
      alert('Invalid file format');
      return;
    }
    
    // Merge with existing items (avoid duplicates based on URL)
    const existingUrls = new Set(allItems.map(item => item.url));
    const newItems = importedItems.filter(item => !existingUrls.has(item.url));
    
    if (newItems.length === 0) {
      alert('No new items to import - all items already exist');
      return;
    }
    
    // Add new items
    allItems = [...allItems, ...newItems];
    await chrome.storage.local.set({ savedItems: allItems });
    
    // Update analytics for new items
    for (const item of newItems) {
      await userAnalytics.articleSaved(item);
    }
    
    alert(`Imported ${newItems.length} new items`);
    loadItems();
    updateItemCount();
    buildTagCloud();
    updateAnalyticsDisplay();
  } catch (error) {
    alert('Error importing file: ' + error.message);
  }
  
  // Reset file input
  e.target.value = '';
}

// Import Kindle data
async function importKindleData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const items = parseKindleExport(text);
    
    if (items.length === 0) {
      alert('No Kindle highlights found in the file.');
      return;
    }
    
    // Show import options dialog
    showImportOptions(items, 'kindle');
    
  } catch (error) {
    console.error('Error importing Kindle data:', error);
    alert('Error importing Kindle data. Please check the file format.');
  }
  
  // Reset file input
  event.target.value = '';
}

// Show import options dialog
function showImportOptions(items, type) {
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Import ${type === 'kindle' ? 'Kindle' : 'Data'} Options</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="import-note">
          Found ${items.length} items to import. ${type === 'kindle' ? 'Supports both Amazon Notebook exports and clipping.io format.' : ''}
        </div>
        <div class="import-options">
          <label>
            <input type="checkbox" id="auto-tag" checked>
            Auto-tag with "${type === 'kindle' ? 'kindle' : 'imported'}"
          </label>
          <label>
            <input type="checkbox" id="author-tag" ${type === 'kindle' ? 'checked' : ''}>
            ${type === 'kindle' ? 'Add author as tag' : 'Add source as tag'}
          </label>
          <label>
            <input type="checkbox" id="skip-duplicates" checked>
            Skip duplicates
          </label>
        </div>
        <div class="preview-items">
          <h3>Preview (first 3 items):</h3>
          ${items.slice(0, 3).map(item => `
            <div class="preview-item">
              <strong>${item.title}</strong>
              ${item.author ? `<br><small>by ${item.author}</small>` : ''}
              ${item.highlight ? `<div class="preview-highlight">${item.highlight.substring(0, 100)}...</div>` : ''}
              ${item.metadata ? `<div class="preview-metadata">${item.metadata}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button id="confirm-import" class="btn btn-primary">Import ${items.length} Items</button>
        <button id="cancel-import" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Event listeners
  dialog.querySelector('.modal-close').addEventListener('click', () => dialog.remove());
  dialog.querySelector('#cancel-import').addEventListener('click', () => dialog.remove());
  dialog.querySelector('#confirm-import').addEventListener('click', () => {
    const autoTag = dialog.querySelector('#auto-tag').checked;
    const authorTag = dialog.querySelector('#author-tag').checked;
    const skipDuplicates = dialog.querySelector('#skip-duplicates').checked;
    
    processImport(items, { autoTag, authorTag, skipDuplicates, type });
    dialog.remove();
  });
  
  // Close on backdrop click
  dialog.querySelector('.modal-backdrop').addEventListener('click', () => dialog.remove());
}

// Process import with options
async function processImport(items, options) {
  const { autoTag, authorTag, skipDuplicates, type } = options;
  let importedCount = 0;
  let skippedCount = 0;
  
  for (const item of items) {
    // Check for duplicates
    if (skipDuplicates) {
      const isDuplicate = allItems.some(existing => 
        existing.title === item.title && existing.url === item.url
      );
      if (isDuplicate) {
        skippedCount++;
        continue;
      }
    }
    
    // Add tags based on options
    const tags = [...(item.tags || [])];
    if (autoTag) {
      tags.push(type === 'kindle' ? 'kindle' : 'imported');
    }
    if (authorTag && item.author) {
      tags.push(item.author.toLowerCase().replace(/\s+/g, '-'));
    }
    
    const importItem = {
      ...item,
      tags: [...new Set(tags)], // Remove duplicates
      imported: true,
      importDate: new Date().toISOString()
    };
    
    // Add to items
    allItems.push(importItem);
    importedCount++;
    
    // Track analytics for new article
    await userAnalytics.articleSaved(importItem);
  }
  
  // Save to storage
  await chrome.storage.local.set({ savedItems: allItems });
  
  // Update UI
  filterAndDisplayItems();
  updateItemCount();
  buildTagCloud();
  buildDomainFilter();
  updateAnalyticsDisplay();
  
  const message = `Successfully imported ${importedCount} items!${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}`;
  alert(message);
}

// Update shortcut display based on platform
function updateShortcutDisplay() {
  const shortcuts = document.querySelector('.empty-shortcuts');
  if (!shortcuts) return;
  
  // The shortcuts are already displayed with ⌥ symbol which works for Mac
  // For Windows/Linux, we could update to show Alt instead
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  // Using Ctrl shortcuts for all platforms now
  shortcuts.innerHTML = `
    <div class="shortcut-item">
      <kbd>Ctrl+Shift+A</kbd> Save full article
    </div>
    <div class="shortcut-item">
      <kbd>Ctrl+Shift+S</kbd> Save selection
    </div>
    <div class="shortcut-item">
      <kbd>Ctrl+Shift+O</kbd> Open this page
    </div>
  `;
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(text, length) {
  return text.length > length ? text.substring(0, length) + '...' : text;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Group items by domain
function groupItemsByDomain(items) {
  const groups = {};
  
  items.forEach(item => {
    let domain = 'Unknown';
    try {
      if (item.source === 'kindle' || item.url.startsWith('kindle://')) {
        domain = 'Kindle Books';
      } else {
        domain = new URL(item.url).hostname;
      }
    } catch (error) {
      console.warn('Invalid URL for grouping:', item.url, error);
      domain = 'Invalid URL';
    }
    
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(item);
  });
  
  return groups;
}

// Create grouped items HTML
function createGroupedItemsHTML(groups) {
  const groupedItemsHTML = Object.entries(groups).map(([domain, items]) => {
    const domainItemsHTML = items.map(item => createItemHTML(item)).join('');
    return `
      <div class="grouped-item">
        <h3 class="grouped-item-title">${escapeHtml(domain)}</h3>
        <div class="grouped-item-content">
          ${domainItemsHTML}
        </div>
      </div>
    `;
  }).join('');
  
  return groupedItemsHTML;
}

// Parse Kindle export from Amazon Notebook or clipping.io
function parseKindleExport(text) {
  const items = [];
  const lines = text.split('\n');
  
  // Detect format
  const isClippingIO = detectClippingIOFormat(lines);
  
  if (isClippingIO) {
    return parseClippingIOFormat(lines);
  } else {
    return parseAmazonFormat(lines);
  }
}

// Detect if the file is from clipping.io
function detectClippingIOFormat(lines) {
  // clipping.io typically has a more structured format with clear separators
  // and often includes metadata like "Added on" dates
  const clippingIOIndicators = [
    /^#\s+/, // Headers starting with #
    /Added on/, // "Added on" timestamps
    /Location\s+\d+/, // Location markers
    /Page\s+\d+/, // Page markers
    /^---$/, // Separator lines
    /^##\s+/ // Secondary headers
  ];
  
  let clippingIOCount = 0;
  let totalLines = Math.min(lines.length, 20); // Check first 20 lines
  
  for (let i = 0; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    for (const indicator of clippingIOIndicators) {
      if (indicator.test(line)) {
        clippingIOCount++;
        break;
      }
    }
  }
  
  // If more than 30% of lines match clipping.io patterns, assume it's clipping.io
  return clippingIOCount / totalLines > 0.3;
}

// Parse clipping.io format
function parseClippingIOFormat(lines) {
  const items = [];
  let currentItem = null;
  let currentHighlight = '';
  let currentMetadata = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Look for book title (usually starts with #)
    if (line.startsWith('# ')) {
      // Save previous item if exists
      if (currentItem && currentHighlight.trim()) {
        currentItem.highlights = currentHighlight.trim();
        currentItem.metadata = currentMetadata;
        items.push(currentItem);
      }
      
      // Start new item
      const title = line.replace(/^#\s+/, '').trim();
      currentItem = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        title: title,
        author: 'Unknown Author', // Will be updated if found
        url: `kindle://book/${encodeURIComponent(title)}`,
        highlights: '',
        savedAt: new Date().toISOString(),
        tags: ['kindle', 'book'],
        notes: '',
        read: false,
        readingTime: 0,
        source: 'kindle',
        metadata: {}
      };
      currentHighlight = '';
      currentMetadata = {};
    }
    // Look for author information
    else if (line.startsWith('## ') && line.includes('by')) {
      const authorMatch = line.match(/by\s+(.+)/);
      if (authorMatch && currentItem) {
        currentItem.author = authorMatch[1].trim();
      }
    }
    // Look for metadata like "Added on", "Location", "Page"
    else if (line.match(/^(Added on|Location|Page):/)) {
      const [key, value] = line.split(':').map(s => s.trim());
      currentMetadata[key] = value;
    }
    // Look for separator lines
    else if (line === '---' || line === '***') {
      // This separates highlights, but we continue collecting
      continue;
    }
    // If we're in a highlight section, collect the text
    else if (currentItem && !line.startsWith('#') && !line.startsWith('##')) {
      // Skip empty lines and metadata lines
      if (line.match(/^(Added on|Location|Page):/)) {
        continue;
      }
      
      // If we hit another book title, we're done with this highlight
      if (line.startsWith('# ')) {
        if (currentHighlight.trim()) {
          currentItem.highlights = currentHighlight.trim();
          currentItem.metadata = currentMetadata;
          items.push(currentItem);
        }
        
        // Start new item
        const title = line.replace(/^#\s+/, '').trim();
        currentItem = {
          id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
          title: title,
          author: 'Unknown Author',
          url: `kindle://book/${encodeURIComponent(title)}`,
          highlights: '',
          savedAt: new Date().toISOString(),
          tags: ['kindle', 'book'],
          notes: '',
          read: false,
          readingTime: 0,
          source: 'kindle',
          metadata: {}
        };
        currentHighlight = '';
        currentMetadata = {};
      } else {
        currentHighlight += line + '\n';
      }
    }
  }
  
  // Don't forget the last item
  if (currentItem && currentHighlight.trim()) {
    currentItem.highlights = currentHighlight.trim();
    currentItem.metadata = currentMetadata;
    items.push(currentItem);
  }
  
  return items;
}

// Parse Amazon format (original function)
function parseAmazonFormat(lines) {
  const items = [];
  let currentItem = null;
  let currentHighlight = '';
  let inHighlight = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Look for book title (usually starts with "=" or is in quotes)
    if (line.startsWith('=') || (line.startsWith('"') && line.endsWith('"')) || 
        line.includes(' by ') || line.includes(' (Author)')) {
      
      // Save previous item if exists
      if (currentItem && currentHighlight.trim()) {
        currentItem.highlights = currentHighlight.trim();
        items.push(currentItem);
      }
      
      // Start new item
      const title = line.replace(/^=+\s*/, '').replace(/^"|"$/g, '').replace(/\s+by\s+.*$/, '').trim();
      currentItem = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        title: title,
        author: extractAuthor(line),
        url: `kindle://book/${encodeURIComponent(title)}`,
        highlights: '',
        savedAt: new Date().toISOString(),
        tags: ['kindle', 'book'],
        notes: '',
        read: false,
        readingTime: 0,
        source: 'kindle'
      };
      currentHighlight = '';
      inHighlight = false;
    }
    // Look for highlight markers
    else if (line.includes('Highlight') || line.includes('Note') || 
             line.includes('Location') || line.includes('Page')) {
      inHighlight = true;
      continue;
    }
    // If we're in a highlight section, collect the text
    else if (inHighlight && currentItem) {
      // Skip location/page numbers
      if (line.match(/^(Location|Page)\s+\d+/) || line.match(/^\d+$/)) {
        continue;
      }
      
      // If we hit another book title, we're done with this highlight
      if (line.startsWith('=') || line.includes(' by ') || line.includes(' (Author)')) {
        if (currentHighlight.trim()) {
          currentItem.highlights = currentHighlight.trim();
          items.push(currentItem);
        }
        
        // Start new item
        const title = line.replace(/^=+\s*/, '').replace(/^"|"$/g, '').replace(/\s+by\s+.*$/, '').trim();
        currentItem = {
          id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
          title: title,
          author: extractAuthor(line),
          url: `kindle://book/${encodeURIComponent(title)}`,
          highlights: '',
          savedAt: new Date().toISOString(),
          tags: ['kindle', 'book'],
          notes: '',
          read: false,
          readingTime: 0,
          source: 'kindle'
        };
        currentHighlight = '';
        inHighlight = false;
      } else {
        currentHighlight += line + '\n';
      }
    }
  }
  
  // Don't forget the last item
  if (currentItem && currentHighlight.trim()) {
    currentItem.highlights = currentHighlight.trim();
    items.push(currentItem);
  }
  
  return items;
}

// Extract author from Kindle line
function extractAuthor(line) {
  // Look for "by Author Name" pattern
  const byMatch = line.match(/\s+by\s+([^(]+)/);
  if (byMatch) {
    return byMatch[1].trim();
  }
  
  // Look for "(Author)" pattern
  const authorMatch = line.match(/\(([^)]+)\)/);
  if (authorMatch && authorMatch[1].toLowerCase().includes('author')) {
    return authorMatch[1].replace(/\s*\(Author\)\s*/i, '').trim();
  }
  
  return 'Unknown Author';
}

// Update analytics display
function updateAnalyticsDisplay() {
  const stats = userAnalytics.getStats();
  console.log('Updating analytics display with stats:', stats);
  
  // Update stats in the header
  const analyticsElements = document.querySelectorAll('[data-analytics]');
  console.log('Found analytics elements:', analyticsElements.length);
  
  analyticsElements.forEach(element => {
    const statType = element.dataset.analytics;
    console.log('Updating element with data-analytics="' + statType + '" to value:', stats[statType]);
    if (stats[statType] !== undefined) {
      element.textContent = stats[statType];
    }
  });
  
  // Also update the read percentage display
  const readPercentageElement = document.querySelector('.read-percentage');
  if (readPercentageElement) {
    readPercentageElement.textContent = `${stats.readPercentage}%`;
  }
}

// Sync analytics with current saved items
async function syncAnalyticsWithItems() {
  console.log('Syncing analytics with current items...');
  
  // Reset analytics
  await userAnalytics.resetStats();
  
  // Recalculate from all current items
  for (const item of allItems) {
    await userAnalytics.articleSaved(item);
    if (item.read) {
      await userAnalytics.articleRead(item);
    }
  }
  
  console.log('Analytics synced. Current stats:', userAnalytics.getStats());
  updateAnalyticsDisplay();
}

// Check and fix analytics inconsistencies
async function checkAndFixAnalytics() {
  console.log('Checking analytics consistency...');
  
  const stats = userAnalytics.getStats();
  const actualTotal = allItems.length;
  const actualRead = allItems.filter(item => item.read).length;
  
  console.log('Analytics stats:', stats);
  console.log('Actual items:', actualTotal);
  console.log('Actual read items:', actualRead);
  
  // Check for inconsistencies
  if (stats.totalArticles !== actualTotal || stats.readArticles !== actualRead) {
    console.log('Analytics inconsistency detected, fixing...');
    await syncAnalyticsWithItems();
    return true; // Fixed
  }
  
  console.log('Analytics are consistent');
  return false; // No fix needed
}


 