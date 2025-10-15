// Global variables
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};
let currentSort = {
    column: 'total_rows',
    direction: 'desc'
};
let currentView = 'summary'; // 'detailed' or 'summary'

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeSortListeners();
    initializeBrowserHistory();
    loadLogLevels();
    loadStats();
    loadData();
});

// Event listeners
function initializeEventListeners() {
    // View tabs
    document.getElementById('detailedViewTab').addEventListener('click', () => switchView('detailed'));
    document.getElementById('summaryViewTab').addEventListener('click', () => switchView('summary'));
    
    // Filter controls
    document.getElementById('levelFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 500));
    document.getElementById('startDate').addEventListener('change', applyFilters);
    document.getElementById('endDate').addEventListener('change', applyFilters);
    
    // Buttons
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadStats();
        loadData();
    });
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
}

// Initialize browser history management
function initializeBrowserHistory() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        if (event.state) {
            // Restore state from history
            currentView = event.state.view || 'summary';
            currentPage = event.state.page || 1;
            currentFilters = event.state.filters || {};
            currentSort = event.state.sort || { column: 'total_rows', direction: 'desc' };
            
            // Update UI to match state
            restoreUIState();
            loadData();
        } else {
            // No state, redirect back to summary view
            currentView = 'summary';
            currentPage = 1;
            currentFilters = {};
            currentSort = { column: 'total_rows', direction: 'desc' };
            restoreUIState();
            loadData();
        }
    });
    
    // Set initial state
    updateBrowserHistory();
}

// Update browser history with current state
function updateBrowserHistory() {
    const state = {
        view: currentView,
        page: currentPage,
        filters: currentFilters,
        sort: currentSort
    };
    
    const url = buildCurrentURL();
    history.pushState(state, '', url);
}

// Build URL reflecting current state
function buildCurrentURL() {
    const params = new URLSearchParams();
    
    if (currentView !== 'summary') {
        params.set('view', currentView);
    }
    
    if (currentPage > 1) {
        params.set('page', currentPage);
    }
    
    // Add filters
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] && currentFilters[key] !== 'all') {
            params.set(key, currentFilters[key]);
        }
    });
    
    // Add sort
    if (currentSort.column && currentSort.direction) {
        params.set('sort', `${currentSort.column}-${currentSort.direction}`);
    }
    
    const queryString = params.toString();
    return queryString ? `?${queryString}` : window.location.pathname;
}

// Restore UI state from history
function restoreUIState() {
    // Update view tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(currentView === 'detailed' ? 'detailedViewTab' : 'summaryViewTab').classList.add('active');
    
    // Update table title
    const tableTitle = document.getElementById('tableTitle');
    if (currentView === 'detailed') {
        tableTitle.innerHTML = '<i class="fas fa-list"></i> Detailed Logs';
    } else {
        tableTitle.innerHTML = '<i class="fas fa-user-friends"></i> User Summary';
    }
    
    // Restore filters
    document.getElementById('levelFilter').value = currentFilters.level || 'all';
    document.getElementById('searchInput').value = currentFilters.search || '';
    document.getElementById('startDate').value = currentFilters.startDate || '';
    document.getElementById('endDate').value = currentFilters.endDate || '';
    
    // Update sort UI
    updateSortUI();
}

// Initialize sort listeners
function initializeSortListeners() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', handleSort);
    });
}

// Handle column sorting
function handleSort(event) {
    const column = event.currentTarget.dataset.column;
    
    // Update sort state
    if (currentSort.column === column) {
        // Same column clicked, toggle direction
        if (currentSort.direction === 'asc') {
            currentSort.direction = 'desc';
        } else if (currentSort.direction === 'desc') {
            currentSort.direction = null;
            currentSort.column = null;
        } else {
            currentSort.direction = 'asc';
        }
    } else {
        // Different column clicked
        currentSort.column = column;
        // For rows_returned and total_downloads/total_rows, default to desc (highest first)
        if (column === 'rows_returned' || column === 'total_downloads' || column === 'total_rows') {
            currentSort.direction = 'desc';
        } else {
            currentSort.direction = 'asc';
        }
    }
    
    // Update UI
    updateSortUI();
    
    // Reset to first page and reload data
    currentPage = 1;
    
    // Update browser history
    updateBrowserHistory();
    
    loadData();
}

// Update sort UI indicators
function updateSortUI() {
    // Remove all existing sort classes
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('active', 'asc', 'desc');
    });
    
    // Add classes to active column
    if (currentSort.column) {
        const activeHeader = document.querySelector(`[data-column="${currentSort.column}"]`);
        if (activeHeader) {
            activeHeader.classList.add('active', currentSort.direction);
        }
    }
}

// Switch between different views
function switchView(view) {
    if (currentView === view) return;
    
    currentView = view;
    currentPage = 1;
    
    // Update tab UI
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(view === 'detailed' ? 'detailedViewTab' : 'summaryViewTab').classList.add('active');
    
    // Update table title based on view
    const tableTitle = document.getElementById('tableTitle');
    if (view === 'detailed') {
        tableTitle.innerHTML = '<i class="fas fa-list"></i> Detailed Logs';
        // Reset sort state when switching to detailed view
        currentSort = { column: null, direction: null };
    } else {
        tableTitle.innerHTML = '<i class="fas fa-user-friends"></i> User Summary';
        // Set default sort for summary view: Total Rows descending
        currentSort = { column: 'total_rows', direction: 'desc' };
    }
    
    // Update browser history
    updateBrowserHistory();
    
    // Update table headers and load appropriate data
    updateTableHeaders();
    loadData();
}

// Update table headers based on current view
function updateTableHeaders() {
    const thead = document.querySelector('.logs-table thead tr');
    
    if (currentView === 'detailed') {
        thead.innerHTML = `
            <th class="sortable" data-column="date_inserted">
                Date Inserted <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="email">
                Email <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="ip_address">
                IP Address <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="queue_name">
                Queue Name <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="rows_returned">
                Rows Returned <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="role">
                Role <i class="fas fa-sort sort-icon"></i>
            </th>
            <th>
                Permalink
            </th>
        `;
    } else {
        thead.innerHTML = `
            <th class="sortable" data-column="email">
                Email <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="role">
                Role <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="total_downloads">
                Total Downloads <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="total_rows">
                Total Rows <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="first_download">
                First Download <i class="fas fa-sort sort-icon"></i>
            </th>
            <th class="sortable" data-column="last_download">
                Most Recent <i class="fas fa-sort sort-icon"></i>
            </th>
        `;
    }
    
    // Re-initialize sort listeners for new headers
    initializeSortListeners();
    updateSortUI();
}

// Load data based on current view
function loadData() {
    if (currentView === 'detailed') {
        loadLogs();
    } else {
        loadUserSummary();
    }
}

// Debounce function for search input
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

// Load available roles
async function loadLogLevels() {
    try {
        const response = await fetch('/api/levels');
        if (!response.ok) throw new Error('Failed to load roles');
        
        const roles = await response.json();
        const levelFilter = document.getElementById('levelFilter');
        
        // Clear existing options (except "All Roles")
        while (levelFilter.children.length > 1) {
            levelFilter.removeChild(levelFilter.lastChild);
        }
        
        // Add role options
        roles.forEach(role => {
            if (role) { // Only add non-null roles
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role;
                levelFilter.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error loading roles:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Failed to load statistics');
        
        const stats = await response.json();
        displayStats(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
        showError('Failed to load statistics');
    }
}

// Display statistics
function displayStats(stats) {
    const statsContainer = document.getElementById('statsCards');
    
    // Total rows downloaded card
    const totalRowsCard = createStatCard('Total Rows Downloaded', formatNumber(stats.totalRows), 'fas fa-download');
    
    // Role breakdown cards with both user count and rows
    const roleCards = stats.byLevel.map(item => 
        createRoleStatCard(item.role || 'UNKNOWN', item.user_count, item.total_rows, getRoleIcon(item.role))
    );
    
    // Recent activity card - total rows downloaded in last 7 days
    const recentRows = stats.last7Days.reduce((sum, day) => sum + (parseInt(day.total_rows) || 0), 0);
    const recentCard = createStatCard('Last 7 Days Rows Downloaded', formatNumber(recentRows), 'fas fa-clock');
    
    statsContainer.innerHTML = '';
    statsContainer.appendChild(totalRowsCard);
    roleCards.forEach(card => statsContainer.appendChild(card));
    statsContainer.appendChild(recentCard);
}

// Create a statistics card
function createStatCard(title, value, iconClass) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const formattedValue = typeof value === 'string' ? value : value.toLocaleString();
    card.innerHTML = `
        <h3><i class="${iconClass}"></i> ${title}</h3>
        <div class="stat-value">${formattedValue}</div>
    `;
    return card;
}

// Create a role statistics card with both user count and total rows
function createRoleStatCard(role, userCount, totalRows, iconClass) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const roleColors = getRoleColors(role);
    card.style.background = `linear-gradient(135deg, ${roleColors.primary} 0%, ${roleColors.secondary} 100%)`;
    card.innerHTML = `
        <h3><i class="${iconClass}"></i> ${role}</h3>
        <div class="stat-value">${userCount.toLocaleString()}</div>
        <div class="stat-subtitle">users</div>
        <div class="stat-secondary">${formatNumber(totalRows)} rows</div>
    `;
    return card;
}

// Get role-specific colors from IHME palette
function getRoleColors(role) {
    if (!role) return { primary: '#02262E', secondary: '#17B9CF' };
    
    const colorMap = {
        'noncollabuser': { primary: '#02262E', secondary: '#17B9CF' }, // Teal gradient
        'gbdcollaborator': { primary: '#32CA81', secondary: '#89FFA8' }, // Green gradient  
        'chinacollaborator': { primary: '#FF8B66', secondary: '#FED3C6' }, // Orange gradient
        'admin': { primary: '#142027', secondary: '#4A4B4B' }, // Dark blue gradient
        'user': { primary: '#064654', secondary: '#0F7C95' }, // Mid blue gradient
        'collaborator': { primary: '#32CA81', secondary: '#D4FFDB' }, // Light green gradient
        'guest': { primary: '#767878', secondary: '#9EA0A1' } // Gray gradient
    };
    
    return colorMap[role.toLowerCase()] || { primary: '#02262E', secondary: '#17B9CF' };
}

// Get icon for role
function getRoleIcon(role) {
    if (!role) return 'fas fa-question-circle';
    
    const icons = {
        'admin': 'fas fa-user-shield',
        'user': 'fas fa-user',
        'collaborator': 'fas fa-users',
        'noncollabuser': 'fas fa-user-circle',
        'gbdcollaborator': 'fas fa-users',
        'chinacollaborator': 'fas fa-globe-asia',
        'noncollab': 'fas fa-user-circle',
        'guest': 'fas fa-user-clock'
    };
    return icons[role.toLowerCase()] || 'fas fa-user-tag';
}

// Get icon for outcome (still needed for outcome column display)
function getOutcomeIcon(outcome) {
    if (!outcome) return 'fas fa-question-circle';
    
    const icons = {
        'success': 'fas fa-check-circle',
        'completed': 'fas fa-check-circle',
        'failed': 'fas fa-times-circle',
        'error': 'fas fa-exclamation-triangle',
        'pending': 'fas fa-clock',
        'running': 'fas fa-spinner'
    };
    return icons[outcome.toLowerCase()] || 'fas fa-circle';
}

// Apply filters and reload logs
function applyFilters() {
    currentPage = 1;
    
    currentFilters = {
        level: document.getElementById('levelFilter').value, // This will be role now
        search: document.getElementById('searchInput').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value
    };
    
    // Clean up filters - remove empty values
    Object.keys(currentFilters).forEach(key => {
        if (!currentFilters[key] || currentFilters[key] === 'all') {
            delete currentFilters[key];
        }
    });
    
    // Update browser history
    updateBrowserHistory();
    
    loadData();
}

// Clear all filters and reload logs
function clearFilters() {
    // Clear all filter inputs
    document.getElementById('levelFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    
    // Remove user filter indicator if it exists
    const userFilterIndicator = document.getElementById('userFilterIndicator');
    if (userFilterIndicator) {
        userFilterIndicator.remove();
    }
    
    // Reset current filters
    currentFilters = {};
    currentPage = 1;
    
    // Update browser history
    updateBrowserHistory();
    
    // Reload logs and stats with cleared filters
    loadStats();
    loadData();
}

// Load logs from API
async function loadLogs() {
    showLoading(true);
    
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: 50,
            ...currentFilters
        });
        
        // Add sort parameters
        if (currentSort.column && currentSort.direction) {
            params.set('sortBy', currentSort.column);
            params.set('sortOrder', currentSort.direction);
        }
        
        // Remove empty parameters
        for (const [key, value] of params.entries()) {
            if (!value || value === 'all') {
                params.delete(key);
            }
        }
        
        const response = await fetch(`/api/logs?${params}`);
        if (!response.ok) throw new Error('Failed to load logs');
        
        const data = await response.json();
        displayLogs(data.logs);
        displayPagination(data.pagination);
        
    } catch (error) {
        console.error('Error loading logs:', error);
        showError('Failed to load user information. Please check your database connection.');
        displayLogs([]);
    } finally {
        showLoading(false);
    }
}

// Display user info in table
function displayLogs(records) {
    const tbody = document.getElementById('logsTableBody');
    
    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 10px; display: block;"></i>
                    No user records found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = records.map(record => `
        <tr>
            <td>${formatTimestamp(record.date_inserted)}</td>
            <td class="log-message">${escapeHtml(record.email || 'N/A')}</td>
            <td class="log-message">${escapeHtml(record.ip_address || 'N/A')}</td>
            <td class="log-message">${escapeHtml(record.queue_name || 'N/A')}</td>
            <td class="log-message">${formatNumber(record.rows_returned)}</td>
            <td>${escapeHtml(record.role || 'N/A')}</td>
            <td class="permalink-cell">
                ${record.permalink ? 
                    `<button class="permalink-btn" onclick="openPermalink('${escapeHtml(record.permalink)}')" title="Open Permalink">
                        <i class="fas fa-external-link-alt"></i>
                    </button>` : 
                    '<span class="no-permalink">N/A</span>'
                }
            </td>
        </tr>
    `).join('');
}

// Load user summary data from API
async function loadUserSummary() {
    showLoading(true);
    
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: 50,
            ...currentFilters
        });
        
        // Add sort parameters
        if (currentSort.column && currentSort.direction) {
            params.set('sortBy', currentSort.column);
            params.set('sortOrder', currentSort.direction);
        }
        
        // Remove empty parameters
        for (const [key, value] of params.entries()) {
            if (!value || value === 'all') {
                params.delete(key);
            }
        }
        
        const response = await fetch(`/api/user-summary?${params}`);
        if (!response.ok) throw new Error('Failed to load user summary');
        
        const data = await response.json();
        displayUserSummary(data.users);
        displayPagination(data.pagination);
        
    } catch (error) {
        console.error('Error loading user summary:', error);
        showError('Failed to load user summary. Please check your database connection.');
        displayUserSummary([]);
    } finally {
        showLoading(false);
    }
}

// Display user summary in table
function displayUserSummary(users) {
    const tbody = document.getElementById('logsTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 10px; display: block;"></i>
                    No user summary found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td class="log-message">
                <div class="email-actions">
                    <button class="email-link" onclick="drillDownToUser('${escapeHtml(user.email)}')" title="View detailed logs for this user">
                        ${escapeHtml(user.email || 'N/A')}
                    </button>
                    ${user.email && user.email !== 'N/A' ? `
                        <button class="domain-link" onclick="searchByDomain('${escapeHtml(user.email)}')" title="View all users from this domain">
                            <i class="fas fa-globe"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
            <td>${escapeHtml(user.role || 'N/A')}</td>
            <td class="log-message">${formatNumber(user.total_downloads)}</td>
            <td class="log-message">${formatNumber(user.total_rows)}</td>
            <td>${formatTimestamp(user.first_download)}</td>
            <td>${formatTimestamp(user.last_download)}</td>
        </tr>
    `).join('');
}

// Display pagination controls
function displayPagination(pagination) {
    const paginationContainer = document.getElementById('pagination');
    const paginationInfo = document.getElementById('paginationInfo');
    
    currentPage = pagination.page;
    totalPages = pagination.totalPages;
    
    // Update pagination info
    const start = Math.max(1, (pagination.page - 1) * pagination.limit + 1);
    const end = Math.min(pagination.total, pagination.page * pagination.limit);
    paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total} records`;
    
    // Create pagination controls
    const controls = [];
    
    // Previous button
    controls.push(`
        <button ${pagination.page <= 1 ? 'disabled' : ''} onclick="goToPage(${pagination.page - 1})">
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `);
    
    // Page numbers
    const maxPages = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxPages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        controls.push(`
            <button class="${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">
                ${i}
            </button>
        `);
    }
    
    // Next button
    controls.push(`
        <button ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="goToPage(${pagination.page + 1})">
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `);
    
    paginationContainer.innerHTML = controls.join('');
}

// Navigate to specific page
function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    
    // Update browser history
    updateBrowserHistory();
    
    loadData();
}

// Utility functions
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    // Debug: Log every timestamp conversion to verify function is being called
    console.log('formatTimestamp called with:', timestamp);
    
    let date;
    
    // Check if timestamp already includes timezone information
    if (typeof timestamp === 'string' && (timestamp.includes('Z') || timestamp.includes('+') || timestamp.includes('-', 10))) {
        // Timestamp has timezone info - convert from UTC to Pacific
        date = new Date(timestamp);
        console.log('Timestamp has timezone info, converting from UTC to Pacific');
        
        try {
            const formatted = date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'America/Los_Angeles'  // Pacific Time
            });
            
            console.log('UTC->Pacific formatted result:', formatted);
            return formatted;
        } catch (error) {
            console.warn('UTC->Pacific conversion failed:', error);
        }
    } else {
        // Timestamp has no timezone info - assume it's already in Pacific time
        date = new Date(timestamp);
        console.log('Timestamp has no timezone info, treating as Pacific time');
        
        const formatted = date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        console.log('Pacific formatted result:', formatted);
        return formatted;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num === null || num === undefined || num === '') {
        return 'N/A';
    }
    return Number(num).toLocaleString();
}

function getOutcomeClass(outcome) {
    if (!outcome) return 'debug';
    
    const classes = {
        'success': 'info',
        'completed': 'info',
        'failed': 'error',
        'error': 'error',
        'pending': 'warning',
        'running': 'warning'
    };
    return classes[outcome.toLowerCase()] || 'debug';
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    const table = document.getElementById('logsTable');
    
    if (show) {
        loading.style.display = 'block';
        table.style.display = 'none';
    } else {
        loading.style.display = 'none';
        table.style.display = 'table';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorDiv.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

function showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'error-message';
    successDiv.style.background = '#c6f6d5';
    successDiv.style.color = '#22543d';
    successDiv.style.borderLeftColor = '#22543d';
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentElement) {
            successDiv.remove();
        }
    }, 3000);
}

function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.style.display = 'none';
}

// Open permalink in new tab/window
function openPermalink(url) {
    if (url && url !== 'N/A') {
        // Ensure the URL has a protocol
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
}

// Drill down from User Summary to Detailed Logs for a specific user
function drillDownToUser(email) {
    if (!email || email === 'N/A') return;
    
    // Switch to detailed view
    switchView('detailed');
    
    // Set the search filter to the user's email
    document.getElementById('searchInput').value = email;
    
    // Apply the filter to load data for this user
    applyFilters();
    
    // Show a subtle indication that we're filtered
    showFilteredByUser(email);
}

// Show indication that view is filtered by a specific user
function showFilteredByUser(email) {
    // Remove any existing filter indicator
    const existingIndicator = document.getElementById('userFilterIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Create new filter indicator
    const indicator = document.createElement('div');
    indicator.id = 'userFilterIndicator';
    indicator.className = 'filter-indicator';
    indicator.innerHTML = `
        <i class="fas fa-filter"></i> 
        Showing logs for: <strong>${escapeHtml(email)}</strong>
        <button onclick="clearUserFilter()" class="clear-filter-btn" title="Clear user filter">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Insert after the table title
    const tableHeader = document.querySelector('.table-header');
    tableHeader.appendChild(indicator);
}

// Clear the user filter and return to normal view
function clearUserFilter() {
    // Clear the search input
    document.getElementById('searchInput').value = '';
    
    // Remove the filter indicator
    const indicator = document.getElementById('userFilterIndicator');
    if (indicator) {
        indicator.remove();
    }
    
    // Reload data without the filter
    applyFilters();
}

// Search by email domain
function searchByDomain(email) {
    if (!email || email === 'N/A') return;
    
    // Extract domain from email
    const domain = extractDomain(email);
    if (!domain) {
        console.error('Could not extract domain from email:', email);
        return;
    }
    
    console.log('Searching by domain:', domain, 'from email:', email);
    
    // Set the search filter to domain pattern
    const searchPattern = `*.${domain.toLowerCase().trim()}`;
    console.log('Setting search pattern:', searchPattern);
    
    document.getElementById('searchInput').value = searchPattern;
    
    // Apply the filters to show all users from this domain
    applyFilters();
    
    // Show indication that we're filtered by domain
    showFilteredByDomain(domain);
}

// Helper function to extract domain from email
function extractDomain(email) {
    const match = email.match(/@(.+)$/);
    return match ? match[1] : null;
}

// Show indication that view is filtered by domain
function showFilteredByDomain(domain) {
    // Remove any existing filter indicator
    const existingIndicator = document.getElementById('userFilterIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Create new filter indicator
    const indicator = document.createElement('div');
    indicator.id = 'userFilterIndicator';
    indicator.className = 'filter-indicator';
    indicator.innerHTML = `
        <i class="fas fa-globe"></i> 
        Showing all users from domain: <strong>@${escapeHtml(domain)}</strong>
        <button onclick="clearUserFilter()" class="clear-filter-btn" title="Clear domain filter">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Insert after the table title
    const tableHeader = document.querySelector('.table-header');
    tableHeader.appendChild(indicator);
}
