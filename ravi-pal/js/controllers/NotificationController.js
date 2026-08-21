/**
 * @file NotificationController.js
 * @description Controller Layer - Handles application workflow, user events, and bridges Model with View.
 */

import { NotificationModel } from '../models/NotificationModel.js';
import { NotificationView } from '../views/NotificationView.js';

export class NotificationController {
  /**
   * @param {NotificationModel} model
   * @param {NotificationView} view
   */
  constructor(model, view) {
    this.model = model;
    this.view = view;

    this.currentFilter = 'all';
    this.searchQuery = '';
    this.sampleIndex = 0;
  }

  /**
   * Initialize application & event bindings
   */
  init() {
    this._bindEvents();
    this._syncInitialState();
  }

  /**
   * Sync initial data and UI states
   * @private
   */
  _syncInitialState() {
    this._syncPreview();
    this._updateReachEstimate();
    this._renderFilteredHistory();
  }

  /**
   * Bind DOM event listeners
   * @private
   */
  _bindEvents() {
    // Secret Input & Visibility Toggle
    if (this.view.broadcastSecretInput) {
      this.view.broadcastSecretInput.addEventListener('input', () => {
        this.view.renderErrors({ secret: '' });
      });
    }

    if (this.view.toggleSecretBtn) {
      this.view.toggleSecretBtn.addEventListener('click', () => {
        this.view.toggleSecretVisibility();
      });
    }

    // Live preview & character counting
    if (this.view.titleInput) {
      this.view.titleInput.addEventListener('input', () => {
        this.view.renderErrors({ title: '' });
        this._syncPreview();
      });
    }

    if (this.view.messageInput) {
      this.view.messageInput.addEventListener('input', () => {
        this.view.renderErrors({ message: '' });
        this._syncPreview();
      });
    }

    if (this.view.imageUrlInput) {
      this.view.imageUrlInput.addEventListener('input', () => this._syncPreview());
    }

    if (this.view.audienceSelect) {
      this.view.audienceSelect.addEventListener('change', () => this._updateReachEstimate());
    }

    // Advanced options accordion
    if (this.view.advancedToggle) {
      this.view.advancedToggle.addEventListener('click', () => {
        this.view.toggleAdvancedOptions();
      });
    }

    // Form Submission
    if (this.view.form) {
      this.view.form.addEventListener('submit', (e) => this._handleFormSubmit(e));
    }

    // Reset Form
    if (this.view.resetFormBtn) {
      this.view.resetFormBtn.addEventListener('click', () => this._handleResetForm());
    }

    // Load Sample Preset
    if (this.view.loadSampleBtn) {
      this.view.loadSampleBtn.addEventListener('click', () => this._handleLoadSample());
    }

    // Empty state CTA
    if (this.view.emptyCreateBtn) {
      this.view.emptyCreateBtn.addEventListener('click', () => {
        this.view.scrollToComposer();
      });
    }

    // Clear All / Reset History
    if (this.view.clearAllHistoryBtn) {
      this.view.clearAllHistoryBtn.addEventListener('click', () => this._handleResetHistory());
    }

    // History Search
    if (this.view.historySearch) {
      this.view.historySearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this._renderFilteredHistory();
      });
    }

    // Filter Buttons
    if (this.view.filterBtns) {
      this.view.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.currentFilter = btn.getAttribute('data-filter') || 'all';
          this.view.setActiveFilter(this.currentFilter);
          this._renderFilteredHistory();
        });
      });
    }

    // Delegated History Actions (Reuse, Copy, Delete)
    if (this.view.historyList) {
      this.view.historyList.addEventListener('click', (e) => this._handleHistoryAction(e));
    }

    // Mobile Sidebar Drawer
    if (this.view.menuToggle) {
      this.view.menuToggle.addEventListener('click', () => this.view.toggleSidebar(true));
    }
    if (this.view.sidebarOverlay) {
      this.view.sidebarOverlay.addEventListener('click', () => this.view.toggleSidebar(false));
    }
    if (this.view.closeSidebarBtn) {
      this.view.closeSidebarBtn.addEventListener('click', () => this.view.toggleSidebar(false));
    }
  }

  // --- Workflow Handlers ---

  /**
   * Synchronize live mobile preview and character counters
   * @private
   */
  _syncPreview() {
    const title = this.view.titleInput ? this.view.titleInput.value : '';
    const message = this.view.messageInput ? this.view.messageInput.value : '';
    const imageUrl = this.view.imageUrlInput ? this.view.imageUrlInput.value : '';

    this.view.updateLivePreview({ title, message, imageUrl });
    this.view.updateCharCounters(title.length, message.length);
  }

  /**
   * Update audience reach metric text
   * @private
   */
  _updateReachEstimate() {
    const audience = this.view.audienceSelect ? this.view.audienceSelect.value : 'all';
    const estimate = this.model.getReachEstimate(audience);
    this.view.setReachMetric(estimate);
  }

  /**
   * Render history list based on active filter and search query
   * @private
   */
  _renderFilteredHistory() {
    const filtered = this.model.filter({
      query: this.searchQuery,
      filterType: this.currentFilter
    });
    this.view.renderHistory(filtered);
  }

  /**
   * Handle form submission and push notification dispatch via Supabase Edge Function
   * @private
   */
  async _handleFormSubmit(e) {
    e.preventDefault();

    const title = this.view.titleInput ? this.view.titleInput.value : '';
    const message = this.view.messageInput ? this.view.messageInput.value : '';
    const secret = this.view.broadcastSecretInput ? this.view.broadcastSecretInput.value : '';

    // Validate inputs
    const validation = this.model.validate({ title, message, secret });
    if (!validation.isValid) {
      this.view.renderErrors(validation.errors);
      return;
    }

    // Set sending state (spinner feedback)
    this.view.setLoading(true);

    try {
      // Call Supabase Edge Function: send-broadcast
      const result = await this.model.sendBroadcastNotification({
        title,
        message,
        secret
      });

      this.view.setLoading(false);
      this._renderFilteredHistory();
      this.view.showToast(result.message || 'Notification broadcast sent successfully!', 'success');
      this.view.scrollToHistory();
    } catch (err) {
      this.view.setLoading(false);
      console.error('Supabase broadcast failed:', err);
      this.view.showToast(`Error sending broadcast: ${err.message}`, 'error');
    }
  }

  /**
   * Handle clear form action
   * @private
   */
  _handleResetForm() {
    this.view.resetForm();
    this._syncPreview();
    this._updateReachEstimate();
    this.view.showToast('Form cleared', 'info');
  }

  /**
   * Handle load preset sample template
   * @private
   */
  _handleLoadSample() {
    const samples = NotificationModel.SAMPLE_TEMPLATES;
    const sample = samples[this.sampleIndex % samples.length];
    this.sampleIndex++;

    this.view.setFormData({
      title: sample.title,
      message: sample.message
    });

    this.view.renderErrors({});
    this._syncPreview();
    this.view.showToast('Sample template loaded into composer', 'info');
  }

  /**
   * Handle Reset History to default demo logs
   * @private
   */
  _handleResetHistory() {
    if (confirm('Reset history log to default sample notifications?')) {
      this.model.resetToDefaults();
      this._renderFilteredHistory();
      this.view.showToast('Notification logs reset to defaults', 'info');
    }
  }

  /**
   * Event delegation for history actions (Reuse, Copy, Delete)
   * @private
   */
  _handleHistoryAction(e) {
    const btn = e.target.closest('.btn-icon-action');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    if (!id) return;

    if (btn.classList.contains('btn-reuse')) {
      this._handleReuse(id);
    } else if (btn.classList.contains('btn-copy')) {
      this._handleCopyPayload(id);
    } else if (btn.classList.contains('btn-delete')) {
      this._handleDelete(id);
    }
  }

  /**
   * Load history record into form for re-sending / editing
   * @private
   */
  _handleReuse(id) {
    const item = this.model.getById(id);
    if (!item) return;

    this.view.setFormData({
      title: item.title,
      message: item.message,
      audience: item.audience,
      priority: item.priority,
      imageUrl: item.imageUrl,
      deepLink: item.deepLink
    });

    this.view.renderErrors({});
    this._syncPreview();
    this._updateReachEstimate();
    this.view.scrollToComposer();
    this.view.showToast('Loaded notification into composer', 'info');
  }

  /**
   * Copy FCM JSON payload to clipboard
   * @private
   */
  _handleCopyPayload(id) {
    const payload = this.model.generateFcmPayload(id);
    if (!payload) return;

    const jsonStr = JSON.stringify(payload, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr)
        .then(() => this.view.showToast('FCM JSON Payload copied to clipboard!', 'success'))
        .catch(() => this.view.showToast('Copied payload successfully', 'info'));
    } else {
      this.view.showToast('Payload ready for copy', 'info');
    }
  }

  /**
   * Delete item from history
   * @private
   */
  _handleDelete(id) {
    if (!confirm('Are you sure you want to remove this record from history?')) return;

    const success = this.model.delete(id);
    if (success) {
      this._renderFilteredHistory();
      this.view.showToast('Notification record deleted', 'info');
    }
  }
}
