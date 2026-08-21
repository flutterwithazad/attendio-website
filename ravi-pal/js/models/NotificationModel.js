/**
 * @file NotificationModel.js
 * @description Model Layer - Manages push notifications data, Supabase Edge Function API requests, validation, and in-memory execution.
 */

export class NotificationModel {
  static STORAGE_KEY = 'attendio_admin_notifications_v2';
  static SUPABASE_BROADCAST_URL = 'https://bccdqmwzjewqhwpmlshs.supabase.co/functions/v1/send-broadcast';

  /**
   * Default initial dataset for demonstration
   */
  static INITIAL_DATA = [
    {
      id: 'notif_104',
      title: '⏰ Reminder: Mark your attendance today',
      message: 'Keep your work record complete! Open Attendio to log your daily attendance before 9:00 PM.',
      audience: 'all',
      priority: 'high',
      imageUrl: '',
      deepLink: 'attendio://mark',
      sentAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35m ago
      deliveredCount: 4812,
      openRate: '42.8%'
    },
    {
      id: 'notif_103',
      title: '⚡ Version 2.4 is Live on Play Store!',
      message: 'Enjoy faster salary calculation, improved overtime tracking, and dark mode optimizations. Update now!',
      audience: 'android',
      priority: 'normal',
      imageUrl: '',
      deepLink: 'https://play.google.com/store/apps/details?id=com.brownfish.attendio',
      sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5).toISOString(), // 1.5d ago
      deliveredCount: 4650,
      openRate: '58.4%'
    },
    {
      id: 'notif_102',
      title: '📊 Monthly Salary Estimate Ready',
      message: 'Your estimated earnings for this month have been calculated. Tap to view your breakdown and overtime hours.',
      audience: 'active',
      priority: 'high',
      imageUrl: '',
      deepLink: 'attendio://summary',
      sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), // 4d ago
      deliveredCount: 3105,
      openRate: '64.1%'
    },
    {
      id: 'notif_101',
      title: '🌟 Welcome to Attendio Smart Tracking',
      message: 'Tip: You can mark attendance even without an internet connection. Data syncs locally on your phone.',
      audience: 'all',
      priority: 'normal',
      imageUrl: '',
      deepLink: '',
      sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(), // 9d ago
      deliveredCount: 4790,
      openRate: '39.2%'
    }
  ];

  /**
   * Audience Reach Mapping
   */
  static AUDIENCE_CONFIG = {
    all: { label: '📢 All Users', reach: 4850, percentage: '100%' },
    active: { label: '🔥 Active Users (7d)', reach: 3120, percentage: '64%' },
    android: { label: '🤖 Android Devices', reach: 4680, percentage: '96%' },
    test: { label: '🧪 Test Group', reach: 5, percentage: '<1%' }
  };

  /**
   * Pre-built template presets
   */
  static SAMPLE_TEMPLATES = [
    {
      title: '🌟 New Feature: Instant Overtime Calculator',
      message: 'Easily calculate your extra work hours and projected monthly bonus right from the home screen.'
    },
    {
      title: '⏰ Attendance Reminder for Today',
      message: 'Don\'t leave your attendance sheet blank! Tap here to mark present with one single touch.'
    },
    {
      title: '📢 Important Update for All Users',
      message: 'We have improved data sync speed and local backup reliability. Update your app today.'
    }
  ];

  constructor() {
    this.notifications = this._loadFromStorage();
  }

  /**
   * Retrieve all notifications
   * @returns {Array<Object>}
   */
  getAll() {
    return [...this.notifications];
  }

  /**
   * Get single notification by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    return this.notifications.find(item => item.id === id) || null;
  }

  /**
   * Validate notification payload
   * @param {Object} payload
   * @returns {{ isValid: boolean, errors: Object }}
   */
  validate(payload) {
    const errors = {};

    if (!payload.title || !payload.title.trim()) {
      errors.title = 'Please enter a notification title';
    } else if (payload.title.trim().length > 65) {
      errors.title = 'Title cannot exceed 65 characters';
    }

    if (!payload.message || !payload.message.trim()) {
      errors.message = 'Please enter the notification message body';
    } else if (payload.message.trim().length > 240) {
      errors.message = 'Message cannot exceed 240 characters';
    }

    if (!payload.secret || !payload.secret.trim()) {
      errors.secret = 'Please enter your broadcast secret key (x-broadcast-secret)';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Dispatch Global Broadcast Notification via Supabase Edge Function
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.message
   * @param {string} params.secret
   * @returns {Promise<{ success: boolean, message: string, record: Object }>}
   */
  async sendBroadcastNotification({ title, message, secret }) {
    if (!secret || !secret.trim()) {
      throw new Error('Missing broadcast secret key. Please enter your secret key in the form.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-broadcast-secret': secret.trim()
    };

    const payload = {
      title: title.trim(),
      message: message.trim()
    };

    const response = await fetch(NotificationModel.SUPABASE_BROADCAST_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      // response might be plain text
    }

    if (!response.ok) {
      const errorDetail = (data && (data.message || data.error)) || `HTTP ${response.status} (${response.statusText || 'Unauthorized or Request Failed'})`;
      throw new Error(errorDetail);
    }

    // Persist to sent history on success
    const newRecord = this.add({
      title,
      message,
      audience: 'all',
      priority: 'high'
    });

    return {
      success: true,
      message: data?.message || 'Notification sent successfully',
      record: newRecord
    };
  }

  /**
   * Add and persist a new notification locally
   * @param {Object} data
   * @returns {Object} Newly created notification
   */
  add(data) {
    const audienceConfig = NotificationModel.AUDIENCE_CONFIG[data.audience] || NotificationModel.AUDIENCE_CONFIG.all;

    const newNotification = {
      id: `notif_${Date.now()}`,
      title: data.title.trim(),
      message: data.message.trim(),
      audience: data.audience || 'all',
      priority: data.priority || 'high',
      imageUrl: data.imageUrl ? data.imageUrl.trim() : '',
      deepLink: data.deepLink ? data.deepLink.trim() : '',
      sentAt: new Date().toISOString(),
      deliveredCount: audienceConfig.reach,
      openRate: '0.0%'
    };

    this.notifications.unshift(newNotification);
    this._saveToStorage();
    return newNotification;
  }

  /**
   * Delete a notification by ID
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const initialLength = this.notifications.length;
    this.notifications = this.notifications.filter(item => item.id !== id);
    const deleted = this.notifications.length < initialLength;
    if (deleted) {
      this._saveToStorage();
    }
    return deleted;
  }

  /**
   * Reset data to initial demo state
   * @returns {Array<Object>}
   */
  resetToDefaults() {
    this.notifications = [...NotificationModel.INITIAL_DATA];
    this._saveToStorage();
    return this.getAll();
  }

  /**
   * Filter and search notifications
   * @param {Object} params
   * @param {string} params.query
   * @param {string} params.filterType
   * @returns {Array<Object>}
   */
  filter({ query = '', filterType = 'all' }) {
    const cleanQuery = query.toLowerCase().trim();

    return this.notifications.filter(item => {
      // Type Filter
      if (filterType === 'broadcast' && item.audience !== 'all') return false;
      if (filterType === 'segmented' && item.audience === 'all') return false;

      // Search Query
      if (cleanQuery) {
        const inTitle = item.title.toLowerCase().includes(cleanQuery);
        const inMsg = item.message.toLowerCase().includes(cleanQuery);
        return inTitle || inMsg;
      }

      return true;
    });
  }

  /**
   * Generate FCM JSON Payload for copying/debugging
   * @param {string} id
   * @returns {Object|null}
   */
  generateFcmPayload(id) {
    const item = this.getById(id);
    if (!item) return null;

    return {
      message: {
        topic: item.audience === 'all' ? 'all_users' : `segment_${item.audience}`,
        notification: {
          title: item.title,
          body: item.message,
          ...(item.imageUrl ? { image: item.imageUrl } : {})
        },
        data: {
          click_action: item.deepLink || 'FLUTTER_NOTIFICATION_CLICK',
          priority: item.priority || 'high',
          timestamp: item.sentAt
        }
      }
    };
  }

  /**
   * Get estimated reach text by audience key
   * @param {string} audienceKey
   * @returns {string}
   */
  getReachEstimate(audienceKey) {
    const config = NotificationModel.AUDIENCE_CONFIG[audienceKey] || NotificationModel.AUDIENCE_CONFIG.all;
    return `~${config.reach.toLocaleString()} users (${config.percentage})`;
  }

  // --- Private Helpers ---

  _loadFromStorage() {
    try {
      const serialized = localStorage.getItem(NotificationModel.STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Storage read failed, falling back to defaults:', err);
    }
    return [...NotificationModel.INITIAL_DATA];
  }

  _saveToStorage() {
    try {
      localStorage.setItem(NotificationModel.STORAGE_KEY, JSON.stringify(this.notifications));
    } catch (err) {
      console.warn('Storage write failed:', err);
    }
  }
}
