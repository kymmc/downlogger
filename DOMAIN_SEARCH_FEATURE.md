# Domain Search Feature

## Overview
Added domain-based search functionality to the GBD Results Download Logger, allowing users to search for all records sharing the same email domain pattern.

## How to Use

### Domain Search Patterns
- **`*.domain.com`** - Find all users with emails ending in @domain.com
- **`@domain.com`** - Alternative syntax for domain search
- **Examples:**
  - `*.washington.edu` → Finds all @washington.edu users
  - `@gmail.com` → Finds all @gmail.com users
  - `*.ihme.washington.edu` → Finds all @ihme.washington.edu users

### User Interface Features

#### 1. Search Input Enhanced
- Updated placeholder text: "Search emails, IPs, queues... (Use *.domain.com for domain search)"
- Added search help text below filters with usage tips

#### 2. Domain Search Buttons
- **Globe icon (🌐)** next to each email address in User Summary view
- Click to automatically search for all users from that email's domain
- Hover tooltip shows the domain that will be searched

#### 3. Search Help
- Visual help text explaining domain search syntax
- Located below the filter controls for easy reference

## Backend Implementation

### Server-Side Logic
```javascript
// Detects domain patterns in search queries
if (search.startsWith('*.') || search.startsWith('@')) {
    const domain = search.startsWith('*.') ? search.substring(2) : search.substring(1);
    const domainPattern = `%@${domain}`;
    query += ' AND email LIKE ?';
    queryParams.push(domainPattern);
}
```

### Supported Endpoints
- **`/api/user-summary`** - Domain search in user aggregation view
- **`/api/logs`** - Domain search in detailed logs view

## Frontend Implementation

### New Functions
```javascript
// Search by email domain
function searchByDomain(email) {
    const domain = extractDomain(email);
    document.getElementById('searchInput').value = `*.${domain}`;
    applyFilters();
}

// Extract domain from email address
function extractDomain(email) {
    const match = email.match(/@(.+)$/);
    return match ? match[1] : null;
}
```

### UI Components
- **Email Actions Container**: Groups email link and domain button
- **Domain Button**: Green globe icon for domain search
- **Search Help**: Informational text with usage examples

## CSS Styling

### New Styles Added
- `.email-actions` - Flexbox container for email and domain buttons
- `.domain-link` - Green button styling for domain search
- `.search-help` - Help text styling with IHME brand colors

## Usage Examples

### Manual Search
1. Type `*.washington.edu` in search box
2. Press Enter or wait for auto-search
3. Results show all users with @washington.edu emails

### Click-to-Search
1. Go to User Summary view
2. Find any email address
3. Click the globe icon (🌐) next to the email
4. Automatically searches for all users from that domain

## Benefits

✅ **Quick Domain Analysis** - Easily find all users from specific institutions  
✅ **Organizational Insights** - Identify usage patterns by organization  
✅ **Intuitive Interface** - Visual buttons make domain search discoverable  
✅ **Flexible Syntax** - Supports both `*.domain.com` and `@domain.com` formats  
✅ **Maintains Existing Functionality** - Standard search still works for partial matches  

## Technical Notes

- Domain search is case-insensitive
- Works with both top-level domains (.com, .edu) and subdomains
- Optimized SQL queries use LIKE pattern matching
- Frontend validation ensures proper domain extraction
- Compatible with existing filter combinations (role, date range, etc.)