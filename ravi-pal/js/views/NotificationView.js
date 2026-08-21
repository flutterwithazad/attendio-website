/**
 * @file NotificationView.js
 * @description View Layer - Handles DOM rendering, live mobile phone preview, list templates, and UI state feedback.
 */

export class NotificationView {
  constructor() {
    this._cacheDom();
    this._initPhoneClock();
  }

  /**
   * Cache all required DOM elements
   * @private
   */
  _cacheDom() {
    // Form & Inputs
    this.form = document.getElementById('notificationForm');
    this.titleInput = document.getElementById('notifTitle');
    this.messageInput = document.getElementById('notifMessage');
    this.audienceSelect = document.getElementById('targetAudience');
    this.prioritySelect = document.getElementById('notifPriority');
    this.imageUrlInput = document.getElementById('imageUrl');
    this.broadcastSecretInput = document.getElementById('broadcastSecret');
    this.toggleSecretBtn = document.getElementById('toggleSecretBtn');

    // Validation & Counters
    this.titleCharCount = document.getElementById('titleCharCount');
    this.messageCharCount = document.getElementById('messageCharCount');
    this.titleError = document.getElementById('titleError');
    this.messageError = document.getElementById('messageError');
    this.secretError = document.getElementById('secretError');

    // Action Buttons
    this.sendBtn = document.getElementById('sendBtn');
    this.resetFormBtn = document.getElementById('resetFormBtn');
    this.loadSampleBtn = document.getElementById('loadSampleBtn');
    this.clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
    this.emptyCreateBtn = document.getElementById('emptyCreateBtn');

    // Collapsible
    this.advancedToggle = document.getElementById('advancedToggle');
    this.advancedFields = document.getElementById('advancedFields');
    this.toggleArrow = document.getElementById('toggleArrow');

    // Preview
    this.previewTitle = document.getElementById('previewTitle');
    this.previewBody = document.getElementById('previewBody');
    this.previewImageWrapper = document.getElementById('previewImageWrapper');
    this.previewImage = document.getElementById('previewImage');
    this.metricReach = document.getElementById('metricReach');
    this.phoneTime = document.getElementById('phoneTime');

    // History & Filter
    this.historySection = document.getElementById('historySection');
    this.historyList = document.getElementById('historyList');
    this.emptyState = document.getElementById('emptyState');
    this.historySearch = document.getElementById('historySearch');
    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.totalNotificationsBadge = document.getElementById('totalNotificationsBadge');

    // Drawer / Mobile
    this.menuToggle = document.getElementById('menuToggle');
    this.sidebar = document.getElementById('sidebar');
    this.sidebarOverlay = document.getElementById('sidebarOverlay');
    this.closeSidebarBtn = document.getElementById('closeSidebarBtn');

    // Toast Container
    this.toastContainer = document.getElementById('toastContainer');
  }

  /**
   * Render notifications history list
   * @param {Array<Object>} notifications
   */
  renderHistory(notifications) {
    if (!this.historyList) return;

    if (this.totalNotificationsBadge) {
      this.totalNotificationsBadge.textContent = notifications.length;
    }

    if (!notifications || notifications.length === 0) {
      this.historyList.innerHTML = '';
      if (this.emptyState) this.emptyState.style.display = 'block';
      return;
    }

    if (this.emptyState) this.emptyState.style.display = 'none';

    this.historyList.innerHTML = notifications.map(item => this._createHistoryItemHtml(item)).join('');
  }

  /**
   * Generate HTML for single history card
   * @private
   */
  _createHistoryItemHtml(item) {
    const audienceTag = this._getAudienceBadgeHtml(item.audience);
    const priorityTag = item.priority === 'high' 
      ? '<span class="tag-badge priority-high">⚡ High</span>' 
      : '';
    const formattedDate = this._formatDate(item.sentAt);

    return `
      <div class="history-item" data-id="${this._escapeHtml(item.id)}">
        <div class="history-main-content">
          <div class="history-badges-row">
            ${audienceTag}
            ${priorityTag}
            <span class="history-timestamp" title="${new Date(item.sentAt).toLocaleString()}">
              📅 ${formattedDate}
            </span>
          </div>

          <h3 class="history-item-title">${this._escapeHtml(item.title)}</h3>
          <p class="history-item-body">${this._escapeHtml(item.message)}</p>
        </div>

        <div class="history-actions-col">
          <div class="delivery-status-pill" title="${item.deliveredCount.toLocaleString()} devices reached">
            <span>✅</span> Delivered (${item.deliveredCount.toLocaleString()})
          </div>

          <div class="item-buttons-row">
            <button class="btn-icon-action btn-reuse" data-id="${this._escapeHtml(item.id)}" title="Load into composer to edit/resend">
              🔄
            </button>
            <button class="btn-icon-action btn-copy" data-id="${this._escapeHtml(item.id)}" title="Copy FCM JSON Payload">
              📋
            </button>
            <button class="btn-icon-action delete btn-delete" data-id="${this._escapeHtml(item.id)}" title="Delete record">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update live mobile phone mockup preview
   * @param {Object} data
   */
  updateLivePreview({ title, message, imageUrl }) {
    const defaultTitle = '⏰ Don\'t forget to mark your attendance!';
    const defaultBody = 'Tap here to record your attendance for today and keep your monthly salary stats updated.';

    this.previewTitle.textContent = title ? title.trim() : defaultTitle;
    this.previewBody.textContent = message ? message.trim() : defaultBody;

    if (imageUrl && imageUrl.trim()) {
      this.previewImage.src = imageUrl.trim();
      this.previewImageWrapper.style.display = 'block';
      this.previewImage.onerror = () => {
        this.previewImageWrapper.style.display = 'none';
      };
    } else {
      this.previewImageWrapper.style.display = 'none';
    }
  }

  /**
   * Update character counters with limit highlight
   * @param {number} titleLen
   * @param {number} messageLen
   */
  updateCharCounters(titleLen, messageLen) {
    if (this.titleCharCount) {
      this.titleCharCount.textContent = `${titleLen} / 65`;
      this.titleCharCount.className = `char-count ${titleLen > 55 ? 'at-limit' : titleLen > 45 ? 'near-limit' : ''}`;
    }

    if (this.messageCharCount) {
      this.messageCharCount.textContent = `${messageLen} / 240`;
      this.messageCharCount.className = `char-count ${messageLen > 210 ? 'at-limit' : messageLen > 180 ? 'near-limit' : ''}`;
    }
  }

  /**
   * Set reach metric display text
   * @param {string} text
   */
  setReachMetric(text) {
    if (this.metricReach) {
      this.metricReach.textContent = text;
    }
  }

  /**
   * Display or clear field validation errors
   * @param {Object} errors
   */
  renderErrors(errors = {}) {
    if (this.titleError) this.titleError.textContent = errors.title || '';
    if (this.messageError) this.messageError.textContent = errors.message || '';
    if (this.secretError) this.secretError.textContent = errors.secret || '';
  }

  /**
   * Toggle secret input between password and text type
   * @returns {boolean} Is now showing as plain text
   */
  toggleSecretVisibility() {
    if (!this.broadcastSecretInput) return false;
    const isPassword = this.broadcastSecretInput.type === 'password';
    this.broadcastSecretInput.type = isPassword ? 'text' : 'password';
    if (this.toggleSecretBtn) {
      this.toggleSecretBtn.textContent = isPassword ? '🙈' : '👁️';
      this.toggleSecretBtn.title = isPassword ? 'Hide Secret Key' : 'Show Secret Key';
    }
    return isPassword;
  }

  /**
   * Toggle button loading spinner state
   * @param {boolean} isLoading
   */
  setLoading(isLoading) {
    if (!this.sendBtn) return;
    if (isLoading) {
      this.sendBtn.classList.add('loading');
    } else {
      this.sendBtn.classList.remove('loading');
    }
  }

  /**
   * Populate form fields with values
   * @param {Object} data
   */
  setFormData(data) {
    if (data.title !== undefined) this.titleInput.value = data.title;
    if (data.message !== undefined) this.messageInput.value = data.message;
    if (data.audience && this.audienceSelect) this.audienceSelect.value = data.audience;
    if (data.priority && this.prioritySelect) this.prioritySelect.value = data.priority;
    if (data.imageUrl !== undefined && this.imageUrlInput) this.imageUrlInput.value = data.imageUrl;
    if (data.deepLink !== undefined && this.deepLinkInput) this.deepLinkInput.value = data.deepLink;
  }

  /**
   * Clear all inputs in form
   */
  resetForm() {
    if (this.form) this.form.reset();
    if (this.imageUrlInput) this.imageUrlInput.value = '';
    if (this.deepLinkInput) this.deepLinkInput.value = '';
    this.renderErrors({});
  }

  /**
   * Toggle advanced options drawer
   * @returns {boolean} Is now open
   */
  toggleAdvancedOptions() {
    if (!this.advancedFields || !this.toggleArrow) return false;
    const isCurrentlyHidden = this.advancedFields.style.display === 'none';
    this.advancedFields.style.display = isCurrentlyHidden ? 'flex' : 'none';
    this.toggleArrow.classList.toggle('open', isCurrentlyHidden);
    return isCurrentlyHidden;
  }

  /**
   * Toggle mobile sidebar drawer
   * @param {boolean} open
   */
  toggleSidebar(open) {
    if (!this.sidebar || !this.sidebarOverlay) return;
    if (open) {
      this.sidebar.classList.add('open');
      this.sidebarOverlay.classList.add('active');
    } else {
      this.sidebar.classList.remove('open');
      this.sidebarOverlay.classList.remove('active');
    }
  }

  /**
   * Set active filter button
   * @param {string} filterName
   */
  setActiveFilter(filterName) {
    this.filterBtns.forEach(btn => {
      const active = btn.getAttribute('data-filter') === filterName;
      btn.classList.toggle('active', active);
    });
  }

  /**
   * Show animated toast alert
   * @param {string} message
   * @param {'success'|'info'|'error'} type
   */
  showToast(message, type = 'success') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '✅';
    if (type === 'info') icon = 'ℹ️';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${this._escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /**
   * Scroll smoothly to history list
   */
  scrollToHistory() {
    if (this.historySection) {
      this.historySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Scroll smoothly to composer
   */
  scrollToComposer() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (this.titleInput) this.titleInput.focus();
  }

  // --- Private UI Formatters ---

  _initPhoneClock() {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      if (this.phoneTime) this.phoneTime.textContent = `${hh}:${mm}`;
    };
    updateTime();
    setInterval(updateTime, 30000);
  }

  _getAudienceBadgeHtml(audience) {
    switch (audience) {
      case 'all':
        return '<span class="tag-badge audience-all">📢 All Users</span>';
      case 'active':
        return '<span class="tag-badge audience-active">🔥 Active (7d)</span>';
      case 'android':
        return '<span class="tag-badge audience-android">🤖 Android</span>';
      case 'test':
        return '<span class="tag-badge audience-test">🧪 Test Group</span>';
      default:
        return `<span class="tag-badge audience-all">${this._escapeHtml(audience)}</span>`;
    }
  }

  _formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
