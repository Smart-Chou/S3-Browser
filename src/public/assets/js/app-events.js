/*!
 * S3 Browser - 事件处理模块
 * 包含用户交互、文件操作和事件监听
 */

(function () {
  'use strict';

  // 确保 BB 对象存在
  window.BB = window.BB || {};

  // 创建事件模块命名空间
  BB.events = BB.events || {};

  // 局部变量引用，提高可读性
  const config = BB.core.config;
  const state = BB.core.state;
  const elements = BB.core.elements;
  const utils = BB.core;
  const render = BB.render;
  const nav = BB.nav;

  // ============================================
  // 文件操作事件处理
  // ============================================

  /**
   * 文件下载事件
   * @param {Object} row - 文件行数据
   */
  async function onRowDownload(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    BB.actions.downloadObject(absKey, row.name);
  }

  /**
   * 文件复制事件
   * @param {Object} row - 文件行数据
   */
  async function onRowCopy(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.copyObject(absKey);
    if (dst) await nav.refresh();
  }

  /**
   * 文件重命名事件
   * @param {Object} row - 文件行数据
   */
  async function onRowRename(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.renameObject(absKey);
    if (dst) await nav.refresh();
  }

  /**
   * 文件详情事件
   * @param {Object} row - 文件行数据
   */
  function onRowMetadata(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    BB.actions.showFileDetails(absKey);
  }

  /**
   * 文件删除事件
   * @param {Object} row - 文件行数据
   */
  async function onRowDelete(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    const ok = await BB.actions.deleteObject(absKey);
    if (ok) await nav.refresh();
  }

  /**
   * 打开文件预览
   * @param {Object} row - 文件行数据
   */
  function openPreview(row) {
    console.log('openPreview called for row:', row);
    if (BB.nav && BB.nav.openPreview) {
      console.log('BB.nav.openPreview exists, calling with row:', row);
      BB.nav.openPreview(row);
    } else {
      console.error('BB.nav.openPreview not available', BB.nav);
    }
  }

  /**
   * 文件夹详情事件
   * @param {Object} row - 文件夹行数据
   */
  function onPrefixDetails(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    BB.actions.showPrefixDetails(prefixAbs);
  }

  /**
   * 文件夹复制事件
   * @param {Object} row - 文件夹行数据
   */
  async function onPrefixCopy(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.copyPrefix(prefixAbs);
    if (dst) await nav.refresh();
  }

  /**
   * 文件夹重命名事件
   * @param {Object} row - 文件夹行数据
   */
  async function onPrefixRename(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.renamePrefix(prefixAbs);
    if (dst) await nav.refresh();
  }

  /**
   * 文件夹删除事件
   * @param {Object} row - 文件夹行数据
   */
  async function onPrefixDelete(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    const ok = await BB.actions.deletePrefix(prefixAbs);
    if (ok) await nav.refresh();
  }

  /**
   * 当前文件夹详情事件
   */
  function onCurrentFolderDetails() {
    const prefixAbs = (utils.bucketPrefix() || '').replace(/\/{2,}/g,'/');
    BB.actions.showPrefixDetails(prefixAbs);
  }

  // ============================================
  // 上传功能
  // ============================================

  /**
   * 触发文件上传
   */
  function triggerUpload() {
    elements.fileInput.value = '';
    elements.fileInput.click();
  }

  /**
   * 触发文件夹上传
   */
  function triggerUploadDir() {
    elements.dirInput.value = '';
    elements.dirInput.click();
  }

  /**
   * 文件输入变化事件处理
   * @param {Event} evt - 事件对象
   */
  async function onFileInput(evt) {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;
    await uploadFiles(files, f => f.name);
    evt.target.value = '';
    await nav.refresh();
  }

  /**
   * 目录输入变化事件处理
   * @param {Event} evt - 事件对象
   */
  async function onDirInput(evt) {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;
    await uploadFiles(files, f => f.webkitRelativePath || f.name);
    evt.target.value = '';
    await nav.refresh();
  }

  /**
   * 上传文件
   * @param {File[]} files - 文件列表
   * @param {Function} keyResolver - 键解析函数
   */
  async function uploadFiles(files, keyResolver) {
    const base = (config.bucketUrl || '/s3').replace(/\/*$/, '');
    const concurrency = 5;
    const queue = files.slice();
    const runOne = async () => {
      const f = queue.shift(); if (!f) return;
      const rel = keyResolver(f);
      const key = (utils.bucketPrefix() + rel).replace(/\/{2,}/g, '/');
      const putURL = `${base}/${utils.encodePath(key)}`;
      try {
        const res = await fetch(putURL, {
          method: 'PUT',
          headers: { 'Content-Type': f.type || 'application/octet-stream' },
          body: f
        });
        if (!res.ok) {
          const txt = await res.text().catch(()=>'');
          throw new Error(`HTTP ${res.status}${txt ? ' – ' + txt : ''}`);
        }
      } catch (e) {
        BB.ui.toast(`Upload failed: ${rel} — ${e}`);
      }
      if (queue.length) await runOne();
    };
    await Promise.all(Array.from({length: Math.min(concurrency, queue.length)}, runOne));
    BB.ui.toast(`Upload done (${files.length})`);
  }

  // ============================================
  // 下载所有文件
  // ============================================

  /**
   * 下载所有文件为ZIP压缩包
   */
  async function downloadAllFiles() {
    if (!window.fflate || !window.fflate.Zip || !window.fflate.ZipPassThrough) {
      BB.ui.toast('Archive not available (fflate not loaded).');
      return;
    }
    const { Zip, ZipPassThrough } = window.fflate;
    const archiveFiles = state.pathContentTableData.filter(i => i.type === 'content').map(i => i.url);
    if (!archiveFiles.length) {
      BB.ui.toast('No file to download');
      return;
    }
    state.downloadAllFilesCount = archiveFiles.length;
    state.downloadAllFilesReceivedCount = 0;
    state.downloadAllFilesProgress = 0;

    let totalContentLength = 0, totalReceivedLength = 0;
    const archiveName = (state.pathPrefix || '').split('/').filter(p => p.trim()).pop();
    const archiveData = [];
    const archive = new Zip((err, data) => { if (err) throw err; archiveData.push(data); });

    await Promise.all(archiveFiles.map(async (url) => {
      const fileName = url.split('/').filter(p => p.trim()).pop();
      const fileStream = new ZipPassThrough(fileName);
      archive.add(fileStream);

      const resp = await fetch(url);
      const len = parseInt(resp.headers.get('Content-Length') || '0', 10);
      if (!isNaN(len)) totalContentLength += len;

      const reader = resp.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          fileStream.push(new Uint8Array(), true);
          break;
        }
        fileStream.push(new Uint8Array(value));
        totalReceivedLength += value.length;
        const p1 = totalContentLength ? (totalReceivedLength / totalContentLength) : 0;
        const p2 = state.downloadAllFilesCount ? (state.downloadAllFilesReceivedCount / state.downloadAllFilesCount) : 0;
        state.downloadAllFilesProgress = (p1 + p2) / 2;
      }
      state.downloadAllFilesReceivedCount++;
    })).then(() => archive.end());

    const blob = new Blob(archiveData, { type: 'application/zip' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${archiveName || 'archive'}.zip`;
    a.click();
    URL.revokeObjectURL(href);

    state.downloadAllFilesCount = state.downloadAllFilesReceivedCount = state.downloadAllFilesProgress = null;
  }

  // ============================================
  // 下拉菜单控制
  // ============================================

  /**
   * 切换下拉菜单
   * @param {string} name - 下拉菜单名称 ('actions' 或 'new')
   */
  function toggleDropdown(name) {
    const actionDropdown = elements.actionsDropdownButton.closest('.toolbar-dropdown');
    const newDropdown = elements.newDropdownButton.closest('.toolbar-dropdown');

    if (state.dropdownOpen === name) {
      // 点击已打开的下拉菜单，关闭它
      closeAllDropdowns();
    } else {
      // 打开新的下拉菜单，关闭其他的
      closeAllDropdowns();
      state.dropdownOpen = name;
      if (name === 'actions') {
        actionDropdown.classList.add('open');
      } else if (name === 'new') {
        newDropdown.classList.add('open');
      }
    }
  }

  /**
   * 关闭所有下拉菜单
   */
  function closeAllDropdowns() {
    const actionDropdown = elements.actionsDropdownButton.closest('.toolbar-dropdown');
    const newDropdown = elements.newDropdownButton.closest('.toolbar-dropdown');
    actionDropdown.classList.remove('open');
    newDropdown.classList.remove('open');
    state.dropdownOpen = null;
  }

  // ============================================
  // 事件监听器设置
  // ============================================

  /**
   * 设置所有事件监听器
   */
  function setupEventListeners() {
    // 根目录链接
    elements.rootLink.addEventListener('click', () => nav.goToPrefix(''));

    // 搜索
    elements.searchButton.addEventListener('click', nav.searchByPrefix);
    elements.searchInput.addEventListener('keyup', (e) => {
      console.log('search input keyup, value=', e.target.value, 'key=', e.key);
      state.searchPrefix = e.target.value;
      if (e.key === 'Enter') nav.searchByPrefix();
    });

    // 刷新
    elements.refreshButton.addEventListener('click', () => {
      render.updateState({
        previousContinuationTokens: [],
        continuationToken: undefined,
        nextContinuationToken: undefined
      });
      nav.refresh();
    });

    // 下拉菜单
    elements.actionsDropdownButton.addEventListener('click', () => toggleDropdown('actions'));
    elements.newDropdownButton.addEventListener('click', () => toggleDropdown('new'));

    // 操作按钮
    elements.downloadAllButton.addEventListener('click', downloadAllFiles);
    elements.folderDetailsButton.addEventListener('click', onCurrentFolderDetails);
    elements.uploadFileButton.addEventListener('click', triggerUpload);
    elements.uploadDirButton.addEventListener('click', triggerUploadDir);

    // 视图切换按钮
    elements.listViewButton.addEventListener('click', () => render.setViewMode('list'));
    elements.gridViewButton.addEventListener('click', () => render.setViewMode('grid'));

    // 文件输入
    elements.fileInput.addEventListener('change', onFileInput);
    elements.dirInput.addEventListener('change', onDirInput);

    // 分页
    elements.pageSizeSelect.addEventListener('change', (e) => {
      const pageSize = Number(e.target.value) || 50;
      config.pageSize = pageSize;
      render.updateState({
        pageSize,
        previousContinuationTokens: [],
        continuationToken: undefined,
        nextContinuationToken: undefined
      });
      nav.refresh();
    });

    elements.prevPageButton.addEventListener('click', nav.previousPage);
    elements.nextPageButton.addEventListener('click', nav.nextPage);

    // 窗口大小
    window.addEventListener('resize', () => {
      state.windowWidth = window.innerWidth;
    });

    // hash变化
    window.addEventListener('hashchange', nav.updatePathFromHash);

    // 全局点击事件，点击其他地方时关闭下拉菜单
    document.addEventListener('click', (event) => {
      const target = event.target;
      const actionDropdown = elements.actionsDropdownButton.closest('.toolbar-dropdown');
      const newDropdown = elements.newDropdownButton.closest('.toolbar-dropdown');

      // 检查点击是否在下拉菜单内部
      const isClickInsideActions = actionDropdown.contains(target);
      const isClickInsideNew = newDropdown.contains(target);

      if (!isClickInsideActions && !isClickInsideNew) {
        closeAllDropdowns();
      }
    });

    // 阻止下拉菜单内部的点击事件冒泡到document
    const dropdownMenus = [elements.actionsDropdownMenu, elements.newDropdownMenu];
    dropdownMenus.forEach(menu => {
      if (menu) {
        menu.addEventListener('click', (event) => {
          event.stopPropagation();
        });
      }
    });
  }

  // ============================================
  // 公共 API
  // ============================================

  // 文件操作事件
  BB.events.onRowDownload = onRowDownload;
  BB.events.onRowCopy = onRowCopy;
  BB.events.onRowRename = onRowRename;
  BB.events.onRowMetadata = onRowMetadata;
  BB.events.onRowDelete = onRowDelete;
  BB.events.openPreview = openPreview;

  // 文件夹操作事件
  BB.events.onPrefixDetails = onPrefixDetails;
  BB.events.onPrefixCopy = onPrefixCopy;
  BB.events.onPrefixRename = onPrefixRename;
  BB.events.onPrefixDelete = onPrefixDelete;
  BB.events.onCurrentFolderDetails = onCurrentFolderDetails;

  // 上传功能
  BB.events.triggerUpload = triggerUpload;
  BB.events.triggerUploadDir = triggerUploadDir;
  BB.events.onFileInput = onFileInput;
  BB.events.onDirInput = onDirInput;
  BB.events.uploadFiles = uploadFiles;

  // 下载所有文件
  BB.events.downloadAllFiles = downloadAllFiles;

  // 下拉菜单控制
  BB.events.toggleDropdown = toggleDropdown;
  BB.events.closeAllDropdowns = closeAllDropdowns;

  // 事件监听器
  BB.events.setupEventListeners = setupEventListeners;

})();