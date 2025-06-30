// Saved items page functionality

let allItems = [];
let filteredItems = [];
let currentView = 'grid';
let currentItem = null;
let selectedTag = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  initializeDarkMode();
  await loadItems();
  setupEventListeners();
  updateShortcutDisplay();
  updateItemCount();
  buildTagCloud();
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
  
  // Search
  document.getElementById('search-input').addEventListener('input', debounce(filterAndDisplayItems, 300));
  
  // Filters
  document.getElementById('filter-status').addEventListener('change', filterAndDisplayItems);
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
      (filterStatus === 'unread' && !item.read);
    
    // Tag filter
    const matchesTag = !selectedTag || 
      (item.tags && item.tags.includes(selectedTag));
    
    return matchesSearch && matchesStatus && matchesTag;
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
  const domain = new URL(item.url).hostname;
  const isReddit = domain.includes('reddit.com');
  const isTwitter = domain.includes('twitter.com') || domain.includes('x.com');
  
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
  }
  
  return {
    icon,
    favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    domain
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
  container.innerHTML = filteredItems.map(item => createItemHTML(item)).join('');
  
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
        </div>
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
  
  // Populate modal
  document.getElementById('modal-title').textContent = currentItem.title;
  document.getElementById('modal-author').textContent = currentItem.author;
  document.getElementById('modal-date').textContent = new Date(currentItem.savedAt).toLocaleString();
  document.getElementById('modal-url').href = currentItem.url;
  document.getElementById('modal-highlights').textContent = currentItem.highlights || 'No highlights saved';
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
  await chrome.runtime.sendMessage({
    action: 'updateSavedItem',
    id: currentItem.id,
    updates: { notes }
  });
  
  // Update local data
  currentItem.notes = notes;
  
  closeModal();
  filterAndDisplayItems();
}

// Delete current item
async function deleteCurrentItem() {
  if (!currentItem || !confirm('Are you sure you want to delete this item?')) return;
  
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
}

// Toggle read status
async function toggleReadStatus(id) {
  const item = allItems.find(item => item.id === id);
  if (!item) return;
  
  item.read = !item.read;
  
  await chrome.runtime.sendMessage({
    action: 'updateSavedItem',
    id: id,
    updates: { read: item.read }
  });
  
  displayItems();
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
      alert('No new items to import');
      return;
    }
    
    // Add new items
    allItems = [...allItems, ...newItems];
    await chrome.storage.local.set({ savedItems: allItems });
    
    alert(`Imported ${newItems.length} new items`);
    loadItems();
    updateItemCount();
    buildTagCloud();
  } catch (error) {
    alert('Error importing file: ' + error.message);
  }
  
  // Reset file input
  e.target.value = '';
}

// Update shortcut display based on platform
function updateShortcutDisplay() {
  const shortcuts = document.querySelector('.empty-shortcuts');
  if (!shortcuts) return;
  
  // The shortcuts are already displayed with ⌥ symbol which works for Mac
  // For Windows/Linux, we could update to show Alt instead
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (!isMac) {
    shortcuts.innerHTML = `
      <div class="shortcut-item">
        <kbd>Alt + E</kbd> Save full article
      </div>
      <div class="shortcut-item">
        <kbd>Alt + L</kbd> Save selection
      </div>
      <div class="shortcut-item">
        <kbd>Alt + R</kbd> Open this page
      </div>
    `;
  }
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


 