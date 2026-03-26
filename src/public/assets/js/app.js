/*!
 * S3 Browser - 模块化应用启动器
 * 依赖于：app-core.js, app-navigation.js, app-render.js, app-events.js
 */

(function () {
  'use strict';

  // 确保 BB 对象存在（应由模块创建）
  window.BB = window.BB || {};

  /**
   * 初始化应用
   */
  function init() {
    // 检查核心模块是否已加载
    if (!BB.core || !BB.nav || !BB.render || !BB.events) {
      console.error('Required modules not loaded. Check script order.');
      return;
    }

    // 设置事件监听器
    if (BB.events.setupEventListeners) {
      BB.events.setupEventListeners();
    }

    // 从 URL hash 初始化路径
    if (BB.nav.updatePathFromHash) {
      BB.nav.updatePathFromHash();
    }

    // 设置初始视图模式
    if (BB.render.setViewMode) {
      // 从 localStorage 恢复视图模式，默认为 'list'
      let savedMode = 'list';
      try {
        savedMode = localStorage.getItem('s3browser-view-mode') || 'list';
      } catch (e) {
        console.warn('无法读取 localStorage:', e);
      }
      BB.render.setViewMode(savedMode);
    }

    // 设置分页大小选择器初始值
    if (BB.core.elements.pageSizeSelect) {
      BB.core.elements.pageSizeSelect.value = BB.core.config.pageSize || 10;
    }

    // 如果没有数据，触发初始刷新
    if (BB.core.state && BB.core.state.pathContentTableData.length === 0) {
      if (BB.nav.refresh) {
        BB.nav.refresh();
      }
    }

    console.log('S3 Browser 模块化版本已启动');
  }

  // 当 DOM 完全加载后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM 已经加载完毕
    init();
  }

})();