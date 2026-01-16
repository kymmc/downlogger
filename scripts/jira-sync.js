const mysql = require('mysql2');
const https = require('https');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    jira: {
        baseUrl: process.env.JIRA_BASE_URL,
        pat: process.env.JIRA_PAT,
        projectKey: process.env.JIRA_PROJECT_KEY || 'CAP',
        // TODO: Adjust JQL filter based on your JIRA setup
        jqlFilter: process.env.JIRA_JQL_FILTER || 'project = CAP',
        maxResults: 100, // Batch size per API call
    },
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 5, // Smaller pool for sync script
    },
    sync: {
        maxRetries: 3,
        retryDelayMs: 1000,
    }
};

// Validate required environment variables
const requiredEnvVars = ['JIRA_BASE_URL', 'JIRA_PAT', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
}

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const db = mysql.createPool(CONFIG.database);

// Test database connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        process.exit(1);
    }
    log('info', 'Connected to MySQL database');
    connection.release();
});

// Helper function to execute queries
function executeQuery(query, params = []) {
    return new Promise((resolve, reject) => {
        db.query(query, params, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

// ============================================================================
// LOGGING
// ============================================================================

function log(level, message, data = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...data
    };
    console.log(JSON.stringify(logEntry));
}

// ============================================================================
// JIRA API CLIENT
// ============================================================================

/**
 * Make a JIRA REST API request with retry logic
 */
async function jiraRequest(endpoint, options = {}, retryCount = 0) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, CONFIG.jira.baseUrl);
        
        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'Authorization': `Bearer ${CONFIG.jira.pat}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        };

        log('debug', 'JIRA API Request', { endpoint, method: requestOptions.method });

        const req = https.request(url, requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (err) {
                        reject(new Error(`Failed to parse JIRA response: ${err.message}`));
                    }
                } else if (res.statusCode === 429 && retryCount < CONFIG.sync.maxRetries) {
                    // Rate limit hit - retry with exponential backoff
                    const delay = CONFIG.sync.retryDelayMs * Math.pow(2, retryCount);
                    log('warn', 'Rate limit hit, retrying', { retryCount, delayMs: delay });
                    setTimeout(() => {
                        jiraRequest(endpoint, options, retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, delay);
                } else {
                    reject(new Error(`JIRA API error: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            if (retryCount < CONFIG.sync.maxRetries) {
                const delay = CONFIG.sync.retryDelayMs * Math.pow(2, retryCount);
                log('warn', 'JIRA request failed, retrying', { error: err.message, retryCount, delayMs: delay });
                setTimeout(() => {
                    jiraRequest(endpoint, options, retryCount + 1)
                        .then(resolve)
                        .catch(reject);
                }, delay);
            } else {
                reject(err);
            }
        });

        req.end();
    });
}

/**
 * Fetch JIRA issues with pagination
 * TODO: Adjust fields parameter based on your JIRA field configuration
 */
async function fetchJiraIssues() {
    const allIssues = [];
    let startAt = 0;
    let total = 0;

    do {
        const endpoint = `/rest/api/2/search?jql=${encodeURIComponent(CONFIG.jira.jqlFilter)}&startAt=${startAt}&maxResults=${CONFIG.jira.maxResults}&fields=id,status,labels,created,summary,updated,resolution,resolutiondate,key,customfield_14500`;
        
        try {
            const response = await jiraRequest(endpoint);
            
            total = response.total;
            const issues = response.issues || [];
            allIssues.push(...issues);
            
            log('info', 'Fetched JIRA issues batch', { 
                startAt, 
                batchSize: issues.length, 
                totalFetched: allIssues.length,
                totalAvailable: total
            });

            startAt += CONFIG.jira.maxResults;
        } catch (error) {
            log('error', 'Failed to fetch JIRA issues', { error: error.message, startAt });
            throw error;
        }
    } while (startAt < total);

    return allIssues;
}

/**
 * Transform JIRA issue to database record
 * Extracts requestor email from Summary field: "New Cap Override Request for [email]"
 */
function transformJiraIssue(issue) {
    const summary = issue.fields.summary || '';
    const issueKey = issue.key;
    const issueId = issue.id; // Numeric ID from JIRA
    
    // Extract email from summary using regex
    // Pattern: "New Cap Override Request for [email]"
    const emailMatch = summary.match(/New Cap Override Request for (.+?)(?:\s|$)/i);
    const requestorEmail = emailMatch ? emailMatch[1].trim() : 'unknown@unknown.com';
    
    // Status: "Denied", "Approved", etc.
    const status = issue.fields.status?.name || null;
    
    // Resolution: "Done", etc.
    const resolution = issue.fields.resolution?.name || null;
    
    // Labels: "Globalpaper", "Sanctioned", etc.
    const labels = issue.fields.labels ? issue.fields.labels.join(', ') : null;
    
    // AI Result: Custom field (customfield_14500) with values like "No decision", "Approve", "Deny"
    const aiResult = issue.fields.customfield_14500 || null;
    
    // Parse timestamps
    const created = issue.fields.created ? new Date(issue.fields.created) : null;
    const updated = issue.fields.updated ? new Date(issue.fields.updated) : null;
    const resolved = issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null;

    // Log if email extraction fails for debugging
    if (!emailMatch) {
        log('warn', 'Failed to extract email from summary', { issueKey, summary });
    }

    return {
        issue_id: issueId,
        issue_key: issueKey,
        requestor_email: requestorEmail,
        status,
        resolution,
        labels,
        ai_result: aiResult,
        created,
        updated,
        resolved,
        summary
    };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Upsert JIRA issues into database
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for idempotency
 * TODO: Adjust columns based on your actual jira_issues table schema
 */
async function upsertJiraIssues(issues) {
    if (issues.length === 0) {
        log('info', 'No issues to upsert');
        return { inserted: 0, updated: 0 };
    }

    // Note: issue_key should be UNIQUE to prevent duplicates
    const query = `
        INSERT INTO jira_issues 
            (issue_id, issue_key, requestor_email, status, resolution, labels, ai_result, created, updated, resolved, summary)
        VALUES ?
        ON DUPLICATE KEY UPDATE
            issue_id = VALUES(issue_id),
            requestor_email = VALUES(requestor_email),
            status = VALUES(status),
            resolution = VALUES(resolution),
            labels = VALUES(labels),
            ai_result = VALUES(ai_result),
            updated = VALUES(updated),
            resolved = VALUES(resolved),
            summary = VALUES(summary)
    `;

    const values = issues.map(issue => [
        issue.issue_id,
        issue.issue_key,
        issue.requestor_email,
        issue.status,
        issue.resolution,
        issue.labels,
        issue.ai_result,
        issue.created,
        issue.updated,
        issue.resolved,
        issue.summary
    ]);

    try {
        const result = await executeQuery(query, [values]);
        
        // affectedRows includes both inserts and updates
        // changedRows is only updates
        const inserted = result.affectedRows - result.changedRows;
        const updated = result.changedRows;

        log('info', 'Upserted JIRA issues', { 
            total: issues.length,
            inserted,
            updated
        });

        return { inserted, updated };
    } catch (error) {
        log('error', 'Failed to upsert issues', { error: error.message });
        throw error;
    }
}

// ============================================================================
// MAIN SYNC LOGIC
// ============================================================================

async function syncJiraIssues() {
    const startTime = Date.now();
    
    log('info', 'Starting JIRA sync', { 
        jiraBaseUrl: CONFIG.jira.baseUrl,
        jqlFilter: CONFIG.jira.jqlFilter
    });

    try {
        // Step 1: Fetch issues from JIRA
        log('info', 'Fetching issues from JIRA...');
        const jiraIssues = await fetchJiraIssues();
        log('info', 'Fetched JIRA issues', { count: jiraIssues.length });

        if (jiraIssues.length === 0) {
            log('info', 'No issues found matching filter');
            return;
        }

        // Step 2: Transform issues to database format
        log('info', 'Transforming issues...');
        const transformedIssues = jiraIssues.map(transformJiraIssue);

        // Step 3: Upsert to database
        log('info', 'Upserting to database...');
        const stats = await upsertJiraIssues(transformedIssues);

        // Step 4: Log completion
        const duration = Date.now() - startTime;
        log('info', 'JIRA sync completed successfully', {
            duration_ms: duration,
            issues_fetched: jiraIssues.length,
            records_inserted: stats.inserted,
            records_updated: stats.updated
        });

        process.exit(0);

    } catch (error) {
        const duration = Date.now() - startTime;
        log('error', 'JIRA sync failed', {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });
        process.exit(1);
    }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

// Graceful shutdown
process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, shutting down gracefully');
    db.end(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log('info', 'Received SIGINT, shutting down gracefully');
    db.end(() => {
        process.exit(0);
    });
});

// Run sync
syncJiraIssues();
