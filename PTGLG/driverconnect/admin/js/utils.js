/**
 * Utility Functions Module
 * Provides common utility functions for the admin panel
 */

// Get notification container (will be available after DOM loads)
let notificationContainer = null;

export function setNotificationContainer(container) {
    notificationContainer = container;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {*} text - Text to sanitize
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHTML(text) {
    if (text === null || text === undefined) return '';
    const temp = document.createElement('div');
    temp.textContent = String(text);
    return temp.innerHTML;
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - Notification type: 'info', 'error', 'success', 'warning'
 */
export function showNotification(message, type = 'info') {
    if (!notificationContainer) {
        console.warn('Notification container not set, using fallback');
        notificationContainer = document.getElementById('notification-container');
    }

    if (!notificationContainer) {
        console.error('Notification container not found');
        return;
    }

    const notificationItem = document.createElement('div');
    notificationItem.classList.add('notification-item', type);

    const icon = type === 'error' ? '!' : type === 'success' ? '✓' : 'ℹ️';

    notificationItem.innerHTML = `
        <span class="icon">${icon}</span>
        <span class="message">${sanitizeHTML(message)}</span>
    `;

    notificationContainer.prepend(notificationItem); // Add to top

    // Automatically remove after 5 seconds
    setTimeout(() => {
        notificationItem.remove();
    }, 5000);
}

/**
 * Format a date to local string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('th-TH');
}

/**
 * Format a number with thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('th-TH').format(num);
}

/**
 * Debounce function to limit execution frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
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

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}
