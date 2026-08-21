/**
 * @file app.js
 * @description Admin Panel MVC Bootstrapper
 */

import { NotificationModel } from './models/NotificationModel.js';
import { NotificationView } from './views/NotificationView.js';
import { NotificationController } from './controllers/NotificationController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize MVC Architecture
  const model = new NotificationModel();
  const view = new NotificationView();
  const controller = new NotificationController(model, view);

  controller.init();
});
