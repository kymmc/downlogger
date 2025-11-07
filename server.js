const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Load sanction domains data
let sanctionDomainsData = {};
try {
    const sanctionDomainsPath = path.join(__dirname, 'public', 'data', 'sanction-domains.json');
    const sanctionDomainsRaw = fs.readFileSync(sanctionDomainsPath, 'utf8');
    sanctionDomainsData = JSON.parse(sanctionDomainsRaw);
    console.log('Loaded sanction domains data:', Object.keys(sanctionDomainsData.domains).length, 'domains');
} catch (error) {
    console.error('Error loading sanction domains data:', error);
    sanctionDomainsData = { domains: {} };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

function getCacheKey(query, params) {
    return `${query}:${JSON.stringify(params)}`;
}

function getCachedResult(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCachedResult(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    // Simple cache cleanup - remove expired entries periodically
    if (cache.size > 100) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
            if (now - v.timestamp > CACHE_TTL) {
                cache.delete(k);
            }
        }
    }
}

// MySQL connection pool for better connection management
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 15, // Increased pool size for better concurrency
    queueLimit: 0,
    waitForConnections: true
});

// Test the connection pool
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        console.log('Please check your .env file configuration');
        return;
    }
    console.log('Connected to MySQL database');
    connection.release(); // Release the connection back to the pool
});

// Helper function to execute queries with error handling and caching
function executeQuery(query, params = [], useCache = true) {
    return new Promise((resolve, reject) => {
        // Check cache for SELECT queries only
        if (useCache && query.trim().toUpperCase().startsWith('SELECT')) {
            const cacheKey = getCacheKey(query, params);
            const cachedResult = getCachedResult(cacheKey);
            if (cachedResult) {
                resolve(cachedResult);
                return;
            }
        }

        db.query(query, params, (error, results) => {
            if (error) {
                console.error('Query error:', error);
                reject(error);
            } else {
                // Cache the result for SELECT queries
                if (useCache && query.trim().toUpperCase().startsWith('SELECT')) {
                    const cacheKey = getCacheKey(query, params);
                    setCachedResult(cacheKey, results);
                }
                resolve(results);
            }
        });
    });
}

// Routes

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get user summary with aggregated data
app.get('/api/user-summary', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const role = req.query.level; // Using 'level' to match existing filter
        const search = req.query.search;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder;

        let query = `
            SELECT 
                email,
                role,
                COUNT(*) as total_downloads,
                SUM(rows_returned) as total_rows,
                MIN(date_inserted) as first_download,
                MAX(date_inserted) as last_download,
                MAX(ip_address) as latest_ip_address
            FROM user_info 
            WHERE tool_year = 2023 AND (date_reset IS NULL OR date_reset > "2025-10-15 00:00:00") AND outcome = 'Success'
        `;
        
        let countQuery = `
            SELECT COUNT(DISTINCT email) as total 
            FROM user_info 
            WHERE tool_year = 2023 AND (date_reset IS NULL OR date_reset > "2025-10-15 00:00:00") AND outcome = 'Success'
        `;
        
        const queryParams = [];
        const countParams = [];

        // Add filters
        if (role && role !== 'all') {
            query += ' AND role = ?';
            countQuery += ' AND role = ?';
            queryParams.push(role);
            countParams.push(role);
        }

        if (search) {
            // Check if search is for email domain (*.domain.com or @domain.com)
            if (search.startsWith('*.') || search.startsWith('@')) {
                const domain = search.startsWith('*.') ? search.substring(2) : search.substring(1);
                const domainPattern = `%@${domain}`;
                query += ' AND LOWER(email) LIKE LOWER(?)';
                countQuery += ' AND LOWER(email) LIKE LOWER(?)';
                queryParams.push(domainPattern);
                countParams.push(domainPattern);
            } else {
                // Search only in email field
                const searchPattern = `%${search}%`;
                query += ' AND email LIKE ?';
                countQuery += ' AND email LIKE ?';
                queryParams.push(searchPattern);
                countParams.push(searchPattern);
            }
        }

        if (startDate) {
            const startDateTime = startDate.includes('T') ? startDate : startDate + ' 00:00:00';
            query += ' AND date_inserted >= ?';
            countQuery += ' AND date_inserted >= ?';
            queryParams.push(startDateTime);
            countParams.push(startDateTime);
        }

        if (endDate) {
            const endDateTime = endDate.includes('T') ? endDate : endDate + ' 23:59:59';
            query += ' AND date_inserted <= ?';
            countQuery += ' AND date_inserted <= ?';
            queryParams.push(endDateTime);
            countParams.push(endDateTime);
        }

        // Add GROUP BY for summary
        query += ' GROUP BY email, role';

        // Add ordering
        let orderBy = 'total_rows DESC'; // Default sort by total rows descending
        if (sortBy && sortOrder) {
            const allowedColumns = ['email', 'role', 'total_downloads', 'total_rows', 'latest_ip_address', 'first_download', 'last_download'];
            const allowedOrders = ['asc', 'desc'];
            
            if (allowedColumns.includes(sortBy) && allowedOrders.includes(sortOrder.toLowerCase())) {
                orderBy = `${sortBy} ${sortOrder.toUpperCase()}`;
            }
        }
        
        query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);

        // Execute queries
        const countResult = await executeQuery(countQuery, countParams);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const users = await executeQuery(query, queryParams);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });

    } catch (error) {
        console.error('User summary endpoint error:', error);
        res.status(500).json({ error: 'Failed to fetch user summary' });
    }
});

// Get cap resets data
app.get('/api/cap-resets', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const role = req.query.level;
        const search = req.query.search;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder;

        let query = `
            SELECT 
                cr.email, 
                cr.role, 
                COALESCE(SUM(ui.rows_returned), 0) as total_rows, 
                cr.date_reset
            FROM (
                SELECT DISTINCT email, role, date_reset
                FROM user_info 
                WHERE tool_year = 2023 AND date_reset > "2025-10-15" AND outcome = "Success" AND ROLE = "NonCollabUser"
            ) cr
            LEFT JOIN user_info ui ON cr.email = ui.email 
                AND ui.tool_year = 2023 
                AND ui.outcome = "Success"
                AND ui.role = "NonCollabUser"
        `;
        
        let countQuery = `
            SELECT COUNT(DISTINCT date_reset) as total 
            FROM user_info 
            WHERE tool_year = 2023 AND date_reset > "2025-10-15" AND outcome = "Success" AND ROLE = "NonCollabUser"
        `;

        const queryParams = [];
        const countParams = [];

        // Store base WHERE conditions for both subquery and count query
        let whereConditions = [];
        let whereParams = [];

        // Add role filter if specified
        if (role && role !== 'all') {
            whereConditions.push(`LOWER(role) = LOWER(?)`);
            whereParams.push(role);
        }

        // Add search filter if specified (for email)
        if (search) {
            const searchLower = search.toLowerCase();
            if (searchLower.startsWith('*.') && searchLower.includes('.')) {
                // Domain search: *.domain.com
                const domain = searchLower.substring(2);
                whereConditions.push(`LOWER(email) LIKE ?`);
                whereParams.push(`%${domain}`);
            } else if (searchLower.startsWith('@')) {
                // Domain search: @domain.com
                const domain = searchLower.substring(1);
                whereConditions.push(`LOWER(email) LIKE ?`);
                whereParams.push(`%@${domain}`);
            } else {
                // Regular email search
                whereConditions.push(`LOWER(email) LIKE ?`);
                whereParams.push(`%${searchLower}%`);
            }
        }

        // Add date filters if specified
        if (startDate) {
            whereConditions.push(`date_reset >= ?`);
            whereParams.push(startDate + ' 00:00:00');
        }

        if (endDate) {
            whereConditions.push(`date_reset <= ?`);
            whereParams.push(endDate + ' 23:59:59');
        }

        // Apply filters to both main query and count query
        if (whereConditions.length > 0) {
            const whereClause = ` AND ` + whereConditions.join(' AND ');
            query = query.replace(
                'WHERE tool_year = 2023 AND date_reset > "2025-10-15" AND outcome = "Success" AND ROLE = "NonCollabUser"',
                'WHERE tool_year = 2023 AND date_reset > "2025-10-15" AND outcome = "Success" AND ROLE = "NonCollabUser"' + whereClause
            );
            countQuery = countQuery.replace(
                'WHERE tool_year = 2023 AND date_reset > "2025-10-15" AND outcome = "Success" AND ROLE = "NonCollabUser"',
                'WHERE tool_year = 2023 AND date_reset > "2025-10-15" AND outcome = "Success" AND ROLE = "NonCollabUser"' + whereClause
            );
            queryParams.push(...whereParams);
            countParams.push(...whereParams);
        }

        // Add GROUP BY and ORDER BY
        query += ` GROUP BY cr.email, cr.role, cr.date_reset`;
        
        // Add sorting
        if (sortBy && sortOrder) {
            const validColumns = ['email', 'role', 'total_rows', 'date_reset'];
            const validOrders = ['asc', 'desc'];
            
            if (validColumns.includes(sortBy) && validOrders.includes(sortOrder.toLowerCase())) {
                // Map column names to correct aliases
                let orderColumn = sortBy;
                if (sortBy === 'email') orderColumn = 'cr.email';
                else if (sortBy === 'role') orderColumn = 'cr.role';
                else if (sortBy === 'date_reset') orderColumn = 'cr.date_reset';
                
                query += ` ORDER BY ${orderColumn} ${sortOrder.toUpperCase()}`;
            } else {
                query += ` ORDER BY cr.date_reset DESC`;
            }
        } else {
            query += ` ORDER BY cr.date_reset DESC`;
        }

        // Add pagination
        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);

        // Execute queries
        const countResult = await executeQuery(countQuery, countParams);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const capResets = await executeQuery(query, queryParams);

        res.json({
            capResets,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });

    } catch (error) {
        console.error('Cap resets endpoint error:', error);
        res.status(500).json({ error: 'Failed to fetch cap resets data' });
    }
});

// Get sanction domains data
app.get('/api/sanction-domains', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const role = req.query.level;
        const search = req.query.search;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder;

        // Use loaded sanction domains data
        const sanctionDomains = sanctionDomainsData.domains || {};
        const domains = Object.keys(sanctionDomains);
        const domainConditions = domains.map(() => 'LOWER(email) LIKE ?').join(' OR ');

        let query = `
            SELECT 
                email,
                role,
                COUNT(*) as total_downloads,
                SUM(rows_returned) as total_rows,
                MIN(date_inserted) as first_download,
                MAX(date_inserted) as last_download,
                MAX(ip_address) as latest_ip_address
            FROM user_info 
            WHERE tool_year = 2023 AND (date_reset IS NULL OR date_reset > "2025-10-15 00:00:00") AND outcome = 'Success'
            AND (${domainConditions})
        `;
        
        let countQuery = `
            SELECT COUNT(DISTINCT email) as total 
            FROM user_info 
            WHERE tool_year = 2023 AND (date_reset IS NULL OR date_reset > "2025-10-15 00:00:00") AND outcome = 'Success'
            AND (${domainConditions})
        `;

        const queryParams = [...domains.map(domain => `%${domain}`)];
        const countParams = [...domains.map(domain => `%${domain}`)];

        // Add additional filters
        if (role && role !== 'all') {
            query += ' AND role = ?';
            countQuery += ' AND role = ?';
            queryParams.push(role);
            countParams.push(role);
        }

        if (search) {
            query += ' AND email LIKE ?';
            countQuery += ' AND email LIKE ?';
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern);
            countParams.push(searchPattern);
        }

        if (startDate) {
            query += ' AND date_inserted >= ?';
            countQuery += ' AND date_inserted >= ?';
            const startDateTime = startDate + ' 00:00:00';
            queryParams.push(startDateTime);
            countParams.push(startDateTime);
        }

        if (endDate) {
            query += ' AND date_inserted <= ?';
            countQuery += ' AND date_inserted <= ?';
            const endDateTime = endDate + ' 23:59:59';
            queryParams.push(endDateTime);
            countParams.push(endDateTime);
        }

        // Add GROUP BY and sorting
        query += ' GROUP BY email, role';
        
        if (sortBy && sortOrder) {
            const validColumns = ['email', 'role', 'total_downloads', 'total_rows', 'latest_ip_address', 'first_download', 'last_download'];
            const validOrders = ['asc', 'desc'];
            
            if (validColumns.includes(sortBy) && validOrders.includes(sortOrder.toLowerCase())) {
                query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
            } else {
                query += ' ORDER BY last_download DESC';
            }
        } else {
            query += ' ORDER BY last_download DESC';
        }

        query += ' LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        // Execute queries
        const countResult = await executeQuery(countQuery, countParams);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const users = await executeQuery(query, queryParams);

        // Add institution information to each user
        const usersWithInstitution = users.map(user => {
            const domain = domains.find(domain => user.email && user.email.toLowerCase().includes(domain.toLowerCase()));
            const institutionData = domain ? sanctionDomains[domain] : null;
            return {
                ...user,
                institution: institutionData ? institutionData.institution : 'Unknown',
                country: institutionData ? institutionData.country : 'Unknown'
            };
        });

        res.json({
            users: usersWithInstitution,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });

    } catch (error) {
        console.error('Sanction domains endpoint error:', error);
        res.status(500).json({ error: 'Failed to fetch sanction domains data' });
    }
});

// Get sanction domains configuration
app.get('/api/sanction-domains-config', (req, res) => {
    res.json(sanctionDomainsData);
});

// Get detailed logs with pagination
app.get('/api/logs', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Cap limit at 100
    const offset = (page - 1) * limit;
    const role = req.query.level; // Using role filter (keeping same param name for frontend compatibility)
    const search = req.query.search;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder;

    // Base WHERE clause - most selective conditions first
    let whereClause = 'WHERE tool_year = 2023 AND outcome = \'Success\' AND (date_reset IS NULL OR date_reset > "2025-10-15 00:00:00")';
    const queryParams = [];
    const countParams = [];

    // Add filters in order of selectivity (most selective first)
    if (role && role !== 'all') {
        whereClause += ' AND role = ?';
        queryParams.push(role);
        countParams.push(role);
    }

    // Date filters are usually very selective, add them early
    if (startDate) {
        whereClause += ' AND date_inserted >= ?';
        const startDateTime = startDate.includes('T') ? startDate : startDate + ' 00:00:00';
        queryParams.push(startDateTime);
        countParams.push(startDateTime);
    }

    if (endDate) {
        whereClause += ' AND date_inserted <= ?';
        const endDateTime = endDate.includes('T') ? endDate : endDate + ' 23:59:59';
        queryParams.push(endDateTime);
        countParams.push(endDateTime);
    }

    // Search filter - least selective, add last
    if (search) {
        // Check if search is for email domain (*.domain.com or @domain.com)
        if (search.startsWith('*.') || search.startsWith('@')) {
            const domain = search.startsWith('*.') ? search.substring(2) : search.substring(1);
            const domainPattern = `%@${domain}`;
            whereClause += ' AND LOWER(email) LIKE LOWER(?)';
            queryParams.push(domainPattern);
            countParams.push(domainPattern);
        } else {
            // Search only in email field
            whereClause += ' AND email LIKE ?';
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern);
            countParams.push(searchPattern);
        }
    }

    // Optimized main query - only select needed columns
    let query = `SELECT email, role, ip_address, queue_name, rows_returned, date_inserted, permalink 
                 FROM user_info ${whereClause}`;
    
    // Simplified count query
    let countQuery = `SELECT COUNT(*) as total FROM user_info ${whereClause}`;



    // Add ordering and pagination
    let orderBy = 'date_inserted DESC'; // Default sort
    if (sortBy && sortOrder) {
        // Validate column names to prevent SQL injection
        const allowedColumns = ['date_inserted', 'email', 'ip_address', 'queue_name', 'rows_returned', 'role'];
        const allowedOrders = ['asc', 'desc'];
        
        if (allowedColumns.includes(sortBy) && allowedOrders.includes(sortOrder.toLowerCase())) {
            orderBy = `${sortBy} ${sortOrder.toUpperCase()}`;
        }
    }
    
    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    // Add query hints for better performance (if needed)
    // console.log('Detailed Logs Query:', query, 'Params:', queryParams);

    // Execute queries concurrently for better performance
    try {
        // Run count and data queries in parallel
        const [countResult, results] = await Promise.all([
            executeQuery(countQuery, countParams),
            executeQuery(query, queryParams)
        ]);

        const total = countResult[0].total;

        res.json({
            logs: results,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error executing database queries:', err);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// Get user info statistics
app.get('/api/stats', async (req, res) => {
    console.log('Stats endpoint called');
    const queries = [
        'SELECT COUNT(*) as total, SUM(rows_returned) as total_rows FROM user_info WHERE tool_year = 2023 AND date_reset IS NULL AND outcome = \'Success\' LIMIT 1',
        'SELECT role, COUNT(DISTINCT email) as user_count, SUM(rows_returned) as total_rows FROM user_info WHERE tool_year = 2023 AND date_reset IS NULL AND outcome = \'Success\' AND role IS NOT NULL GROUP BY role LIMIT 10',
        'SELECT DATE(date_inserted) as date, COUNT(*) as count, SUM(rows_returned) as total_rows FROM user_info WHERE tool_year = 2023 AND date_reset IS NULL AND outcome = \'Success\' AND date_inserted >= CURDATE() - INTERVAL 7 DAY GROUP BY DATE(date_inserted) ORDER BY date LIMIT 7'
    ];

    try {
        // Execute queries with improved error handling
        const totalResult = await executeQuery(queries[0]);
        const outcomeResult = await executeQuery(queries[1]);
        const recentResult = await executeQuery(queries[2]);

        console.log('Stats query successful');
        res.json({
            total: totalResult[0].total,
            totalRows: totalResult[0].total_rows,
            byLevel: outcomeResult,
            last7Days: recentResult
        });
    } catch (err) {
        console.error('Error getting stats:', err);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Get unique roles
app.get('/api/levels', async (req, res) => {
    try {
        const results = await executeQuery('SELECT DISTINCT role FROM user_info WHERE tool_year = 2023 AND date_reset IS NULL AND outcome = \'Success\' AND role IS NOT NULL ORDER BY role');
        res.json(results.map(row => row.role));
    } catch (err) {
        console.error('Error getting roles:', err);
        res.status(500).json({ error: 'Failed to get roles' });
    }
});

// Check table structure (for testing)
app.post('/api/setup', async (req, res) => {
    try {
        // Just check if the table exists and return info
        const results = await executeQuery('DESCRIBE user_info');
        
        res.json({ 
            message: 'user_info table found and accessible',
            columns: results.length,
            structure: results.map(col => ({
                field: col.Field,
                type: col.Type,
                key: col.Key
            }))
        });
    } catch (err) {
        console.error('Error describing table:', err);
        res.status(500).json({ error: 'user_info table not found or accessible' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Environment loaded:', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
    });
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        db.end();
        process.exit(0);
    });
});