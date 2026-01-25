/**
 * Notifications Module
 * Handles notification bell and dropdown functionality
 */

import { showNotification } from './utils.js';

// State
let notificationBellData = [];
let notificationBell = null;
let notificationBadge = null;
let notificationDropdown = null;
let notificationList = null;
let markAllReadBtn = null;

const NOTIFICATIONS_STORAGE_KEY = 'adminNotifications';
const MAX_NOTIFICATIONS = 100;

/**
 * Initialize notification bell
 */
export function initNotificationBell() {
    notificationBell = document.getElementById('notificationBell');
    notificationBadge = document.getElementById('notificationBadge');
    notificationDropdown = document.getElementById('notificationDropdown');
    notificationList = document.getElementById('notificationList');
    markAllReadBtn = document.getElementById('markAllRead');

    if (!notificationBell) {
        console.warn('Notification bell not found in DOM');
        return;
    }

    // Load from localStorage
    const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (saved) {
        try {
            notificationBellData = JSON.parse(saved);
            updateNotificationUI();
        } catch (e) {
            console.error('Failed to parse notifications', e);
            notificationBellData = [];
        }
    }

    // Event listeners
    notificationBell.addEventListener('click', (e) => {
        toggleNotificationDropdown(e);
        // Enable audio on first click (user gesture)
        if (window._audioContextBlocked) {
            window._audioContextBlocked = false;
        }
    });

    markAllReadBtn?.addEventListener('click', markAllNotificationsAsRead);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
            notificationDropdown?.classList.remove('show');
        }
    });

    console.log('✅ Notification bell initialized');
}

/**
 * Toggle notification dropdown
 * @param {Event} e - Click event
 */
export function toggleNotificationDropdown(e) {
    e?.stopPropagation();
    notificationDropdown?.classList.toggle('show');
}

/**
 * Add notification to bell
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional data
 */
export function addNotificationToBell(type, title, message, data = {}) {
    const notification = {
        id: Date.now(),
        type, // 'checkin', 'checkout', 'trip-end', 'holiday-work', 'alcohol-check', 'alert'
        title,
        message,
        data,
        timestamp: new Date().toISOString(),
        read: false
    };

    notificationBellData.unshift(notification);

    // Keep only last MAX_NOTIFICATIONS
    if (notificationBellData.length > MAX_NOTIFICATIONS) {
        notificationBellData = notificationBellData.slice(0, MAX_NOTIFICATIONS);
    }

    saveNotifications();
    updateNotificationUI();
    playNotificationSound();

    console.log('🔔 Added notification:', notification);
}

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 */
export function markNotificationAsRead(notificationId) {
    const notification = notificationBellData.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        saveNotifications();
        updateNotificationUI();
    }
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead() {
    notificationBellData.forEach(n => n.read = true);
    saveNotifications();
    updateNotificationUI();
}

/**
 * Save notifications to localStorage
 */
function saveNotifications() {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificationBellData));
}

/**
 * Update notification UI (badge and list)
 */
function updateNotificationUI() {
    const unreadCount = notificationBellData.filter(n => !n.read).length;

    // Update badge
    if (notificationBadge) {
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notificationBadge.style.display = 'block';
        } else {
            notificationBadge.style.display = 'none';
        }
    }

    // Render list
    renderNotificationList();
}

/**
 * Render notification list
 */
function renderNotificationList() {
    if (!notificationList) return;

    notificationList.innerHTML = '';
    if (notificationBellData.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'notification-empty';
        emptyDiv.innerHTML = `
            <div class="notification-empty-icon">🔕</div>
            <p>ยังไม่มีการแจ้งเตือน</p>
        `;
        notificationList.appendChild(emptyDiv);
        return;
    }

    notificationBellData.forEach(n => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `notification-item ${n.read ? '' : 'unread'}`;
        itemDiv.onclick = () => handleNotificationClick(n.id);

        const iconDiv = document.createElement('div');
        iconDiv.className = 'notification-icon';
        iconDiv.textContent = getNotificationIcon(n.type);
        itemDiv.appendChild(iconDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'notification-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'title';
        titleDiv.textContent = n.title;
        contentDiv.appendChild(titleDiv);

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.textContent = n.message;
        contentDiv.appendChild(messageDiv);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'time';
        timeDiv.textContent = getTimeAgo(new Date(n.timestamp));
        contentDiv.appendChild(timeDiv);

        itemDiv.appendChild(contentDiv);
        notificationList.appendChild(itemDiv);
    });
}

/**
 * Handle notification click
 * @param {number} notificationId - Notification ID
 */
function handleNotificationClick(notificationId) {
    markNotificationAsRead(notificationId);
    const notification = notificationBellData.find(n => n.id === notificationId);

    if (notification && notification.data.reference) {
        console.log('📍 Clicked notification for:', notification.data.reference);
        // Could navigate to specific section or show details
    }
}

/**
 * Get notification icon by type
 * @param {string} type - Notification type
 * @returns {string} Icon emoji
 */
function getNotificationIcon(type) {
    const icons = {
        'checkin': '📍',
        'checkout': '✅',
        'trip-end': '🎉',
        'holiday-work': '🎊',
        'alcohol-check': '🍺',
        'alert': '⚠️'
    };
    return icons[type] || '🔔';
}

/**
 * Get time ago string
 * @param {Date} date - Date to compare
 * @returns {string} Time ago string in Thai
 */
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'เมื่อสักครู่';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
}

/**
 * Play notification sound
 */
function playNotificationSound() {
    // Skip if already tried and failed
    if (window._audioContextBlocked) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Check if context is in suspended state (autoplay blocked)
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                playBeep(audioContext);
            }).catch(() => {
                console.log('🔇 Sound blocked by browser - will work after user interaction');
                window._audioContextBlocked = true;
            });
        } else {
            playBeep(audioContext);
        }
    } catch (e) {
        console.log('Could not play sound', e);
        window._audioContextBlocked = true;
    }
}

/**
 * Play beep sound
 * @param {AudioContext} audioContext - Audio context
 */
function playBeep(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

/**
 * Get unread notification count
 * @returns {number} Unread count
 */
export function getUnreadCount() {
    return notificationBellData.filter(n => !n.read).length;
}
