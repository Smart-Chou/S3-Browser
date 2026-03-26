/*!
 * S3 Browser - 原生JavaScript实现
 * 替代Vue/Buefy框架
 */

(function () {
  'use strict';

  // 配置
  const config = {
    primaryColor: '#167df0',
    allowDownloadAll: true,
    bucketUrl: '/s3',
    bucketMaskUrl: '/s3',
    rootPrefix: '',
    trashPrefix: '_trash/',
    keyExcludePatterns: [/^index\.html$/],
    pageSize: 50,
    defaultOrder: 'name-asc'
  };
  window.BB = window.BB || {};
  BB.cfg = config;

  // 工具函数
  String.prototype.removePrefix = function (prefix) { return this.startsWith(prefix) ? this.substring(prefix.length) : this; };
  String.prototype.escapeHTML = function () { const t = document.createElement('span'); t.innerText = this; return t.innerHTML; };

  function encodePath(path) {
    path = (path || '').replace(/\/{2,}/g, '/');
    try { if (decodeURI(path) !== path) return path; } catch (e) {}
    const m = {";":"%3B","?":"%3F",":":"%3A","@":"%40","&":"%26","=":"%3D","+":"%2B","$":"%24",",":"%2C","#":"%23"};
    return encodeURI(path).split("").map(ch => m[ch] || ch).join("");
  }
  function extOf(s='') { const m = /\.([^.]+)$/.exec((s||'').toLowerCase()); return m ? m[1] : ''; }

  // 初始化配置
  (function setup() {
    const htmlPrefix = 'HTML>';
    if (config.title) config.titleHTML = config.title.startsWith(htmlPrefix) ? config.title.substring(htmlPrefix.length) : config.title.escapeHTML();
    if (config.subtitle) config.subtitleHTML = config.subtitle.startsWith(htmlPrefix) ? config.subtitle.substring(htmlPrefix.length) : config.subtitle.escapeHTML();
    config.bucketUrl = config.bucketUrl || '/s3';
    config.bucketMaskUrl = config.bucketMaskUrl || '/s3';
    config.rootPrefix = (config.rootPrefix || '');
    if (config.rootPrefix) config.rootPrefix = config.rootPrefix.replace(/\/?$/, '/');
    document.title = config.title || '存储桶浏览器';
    const fav = document.getElementById('favicon'); if (fav && config.favicon) fav.href = config.favicon;
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    const absTrash = (config.rootPrefix || '') + (config.trashPrefix || '_trash/');
    const rx = new RegExp('^' + absTrash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!config.keyExcludePatterns.some(r => r.toString() === rx.toString())) config.keyExcludePatterns.push(rx);
  })();

  // 应用状态
  const state = {
    pathPrefix: '',
    searchPrefix: '',
    pathContentTableData: [],
    previousContinuationTokens: [],
    continuationToken: undefined,
    nextContinuationToken: undefined,
    windowWidth: window.innerWidth,
    downloadAllFilesCount: null,
    downloadAllFilesReceivedCount: null,
    downloadAllFilesProgress: null,
    isRefreshing: false,
    hasFflate: typeof window !== 'undefined' && !!window.fflate,
    pageSize: config.pageSize || 50,
    dropdownOpen: null,
    viewMode: 'list' // 'list' 或 'grid'
  };

  // DOM元素引用
  const elements = {
    rootLink: document.getElementById('root-link'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    emptyBreadcrumb: document.getElementById('empty-breadcrumb'),
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    refreshButton: document.getElementById('refresh-button'),
    actionsDropdownButton: document.getElementById('actions-dropdown-button'),
    actionsDropdownMenu: document.getElementById('actions-dropdown-menu'),
    newDropdownButton: document.getElementById('new-dropdown-button'),
    newDropdownMenu: document.getElementById('new-dropdown-menu'),
    downloadAllButton: document.getElementById('download-all-button'),
    folderDetailsButton: document.getElementById('folder-details-button'),
    uploadFileButton: document.getElementById('upload-file-button'),
    uploadDirButton: document.getElementById('upload-dir-button'),
    fileInput: document.getElementById('file-input'),
    dirInput: document.getElementById('dir-input'),
    pageSizeSelect: document.getElementById('page-size-select'),
    prevPageButton: document.getElementById('prev-page-button'),
    nextPageButton: document.getElementById('next-page-button'),
    pageInfo: document.getElementById('page-info'),
    tableBody: document.getElementById('table-body'),
    loadingIndicator: document.getElementById('loading-indicator'),
    emptyTable: document.getElementById('empty-table'),
    fileTable: document.getElementById('file-table'),
    listViewButton: document.getElementById('list-view-button'),
    gridViewButton: document.getElementById('grid-view-button'),
    gridViewContainer: document.getElementById('grid-view-container')
  };

  // 工具函数
  function isImageExt(e){ return BB.detect.isImageExt(e); }
  function isArchiveExt(e){ return BB.detect.isArchiveExt(e); }
  function isVideoExt(e){ return BB.detect.isVideoExt(e); }
  function isAudioExt(e){ return BB.detect.isAudioExt(e); }
  function isSpreadsheetExt(e){ return BB.detect.isSpreadsheetExt(e); }
  function isPresentationExt(e){ return BB.detect.isPresentationExt(e); }
  function isPdfExt(e){ return BB.detect.isPdfExt(e); }
  function isCodeExt(e){ return BB.detect.isCodeExt(e); }

  function fileRowIcon(row) {
    if (row.type === 'prefix') return 'folder';
    const e = extOf(row.name);
    if (isArchiveExt(e))       return 'zip-box';
    if (isVideoExt(e))         return 'file-video-outline';
    if (isAudioExt(e))         return 'file-music-outline';
    if (isSpreadsheetExt(e))   return 'file-table-outline';
    if (isPresentationExt(e))  return 'file-powerpoint-outline';
    if (e === 'md' || e === 'txt') return 'file-document-outline';
    if (isImageExt(e))         return 'file-image-outline';
    if (isPdfExt(e))           return 'file-pdf-box';
    if (isCodeExt(e))          return 'file-code-outline';
    return 'file-outline';
  }

  function formatBytes(size) {
    if (!Number.isFinite(size)) return '-';
    const KB = 1024, MB = 1048576, GB = 1073741824;
    if (size < KB) return size + '  B';
    if (size < MB) return (size / KB).toFixed(0) + ' KB';
    if (size < GB) return (size / MB).toFixed(2) + ' MB';
    return (size / GB).toFixed(2) + ' GB';
  }

  function formatDateTime_relative(d){
    return d ? moment(d).fromNow() : '-';
  }

  function formatDateTime_utc(d){
    return d ? moment(d).utc().format('YYYY-MM-DD HH:mm:ss [UTC]') : '';
  }

  function validBucketPrefix(prefix) {
    console.log('validBucketPrefix checking:', prefix);
    if (prefix === '') return true;
    if (prefix.startsWith(' ') || prefix.endsWith(' ')) return false;
    if (prefix.includes('//')) return false;
    if (prefix.startsWith('/') && bucketPrefix().includes('/')) return false;
    return true;
  }

  function bucketPrefix() {
    const result = `${config.rootPrefix}${state.pathPrefix || ''}`;
    console.log('bucketPrefix result:', result, 'rootPrefix:', config.rootPrefix, 'pathPrefix:', state.pathPrefix);
    return result;
  }

  function currentPage() {
    return (state.previousContinuationTokens?.length || 0) + 1;
  }

  function canDownloadAll() {
    const filesCount = state.pathContentTableData.filter(i => i.type === 'content').length;
    return config.allowDownloadAll && filesCount >= 2;
  }

  function breadcrumbs() {
    let p = (state.pathPrefix || '').replace(/\/+$/g, '');

    const root = (config.rootPrefix || '');
    if (root && p.startsWith(root)) p = p.slice(root.length).replace(/^\/+/g, '');

    if (!p) return [];

    const parts = p.split('/').filter(Boolean);
    let acc = '';
    return parts.map(name => {
      acc += name + '/';
      return { name, prefix: acc };
    });
  }

  // 渲染面包屑
  function renderBreadcrumbs() {
    const crumbs = breadcrumbs();
    elements.breadcrumbs.innerHTML = '';

    if (crumbs.length === 0) {
      elements.emptyBreadcrumb.style.display = 'block';
      return;
    }

    elements.emptyBreadcrumb.style.display = 'none';

    crumbs.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'breadcrumb-item';

      const link = document.createElement('span');
      link.className = 'breadcrumb-link clickable';
      link.title = c.prefix;
      link.textContent = c.name;
      link.addEventListener('click', () => goToPrefix(c.prefix));

      item.appendChild(link);

      if (idx < crumbs.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '/';
        item.appendChild(sep);
      }

      elements.breadcrumbs.appendChild(item);
    });
  }

  // 渲染表格
  function renderTable() {
    elements.tableBody.innerHTML = '';
    if (elements.gridViewContainer) {
      elements.gridViewContainer.innerHTML = '';
    }

    if (state.isRefreshing) {
      elements.loadingIndicator.style.display = 'block';
      elements.emptyTable.style.display = 'none';
      elements.fileTable.style.display = 'none';
      if (elements.gridViewContainer) {
        elements.gridViewContainer.style.display = 'none';
      }
      return;
    }

    elements.loadingIndicator.style.display = 'none';

    if (state.pathContentTableData.length === 0) {
      elements.emptyTable.style.display = 'block';
      elements.fileTable.style.display = 'none';
      if (elements.gridViewContainer) {
        elements.gridViewContainer.style.display = 'none';
      }
      return;
    }

    elements.emptyTable.style.display = 'none';

    if (state.viewMode === 'list') {
      elements.fileTable.style.display = 'table';
      if (elements.gridViewContainer) {
        elements.gridViewContainer.style.display = 'none';
      }
      renderListView();
    } else {
      elements.fileTable.style.display = 'none';
      if (elements.gridViewContainer) {
        elements.gridViewContainer.style.display = 'block';
      }
      renderGridView();
    }
  }

  // 渲染列表视图
  function renderListView() {
    elements.tableBody.innerHTML = '';

    state.pathContentTableData.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'file-row';

      // 名称列
      const nameCell = document.createElement('td');
      nameCell.className = 'table-col-name';
      const nameDiv = document.createElement('div');
      nameDiv.style.display = 'flex';
      nameDiv.style.alignItems = 'center';
      nameDiv.style.gap = '.5rem';

      const icon = document.createElement('i');
      icon.className = `mdi mdi-${fileRowIcon(row)} name-column-icon is-smmd`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'clickable';
      nameSpan.title = row.name;
      nameSpan.textContent = row.name;

      if (row.type === 'content') {
        nameSpan.addEventListener('click', () => openPreview(row));
      } else {
        nameSpan.addEventListener('click', () => goToPrefix(row.prefix));
      }

      nameDiv.appendChild(icon);
      nameDiv.appendChild(nameSpan);
      nameCell.appendChild(nameDiv);
      tr.appendChild(nameCell);

      // 大小列
      const sizeCell = document.createElement('td');
      sizeCell.className = 'table-col-size';
      if (row.type === 'content') {
        sizeCell.textContent = formatBytes(row.size);
      } else {
        sizeCell.textContent = '—';
      }
      tr.appendChild(sizeCell);

      // 修改时间列
      const dateCell = document.createElement('td');
      dateCell.className = 'table-col-modified';
      if (row.dateModified) {
        const span = document.createElement('span');
        span.title = formatDateTime_utc(row.dateModified);
        span.textContent = formatDateTime_relative(row.dateModified);
        dateCell.appendChild(span);
      } else {
        dateCell.textContent = '—';
      }
      tr.appendChild(dateCell);

      // 操作列
      const actionsCell = document.createElement('td');
      actionsCell.className = 'table-col-actions';
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.justifyContent = 'flex-end';

      const menuDiv = document.createElement('div');
      menuDiv.className = 'bb-menu';
      menuDiv.setAttribute(row.type === 'content' ? 'data-key' : 'data-prefix', row.type === 'content' ? row.key : row.prefix);

      const kebab = document.createElement('span');
      kebab.className = 'bb-kebab';
      kebab.setAttribute('aria-haspopup', 'menu');
      kebab.setAttribute('aria-expanded', 'false');
      kebab.title = '选项';
      const kebabIcon = document.createElement('i');
      kebabIcon.className = 'mdi mdi-dots-vertical';
      kebab.appendChild(kebabIcon);

      const popover = document.createElement('div');
      popover.className = 'bb-menu-popover';
      const menuList = document.createElement('div');
      menuList.className = 'bb-menu-list';

      // 详情按钮
      const detailItem = document.createElement('div');
      detailItem.className = 'bb-menu-item';
      const detailIcon = document.createElement('i');
      detailIcon.className = 'mdi mdi-information-outline';
      detailItem.appendChild(detailIcon);
      detailItem.appendChild(document.createTextNode(' 详情'));
      detailItem.addEventListener('click', row.type === 'content' ?
        () => onRowMetadata(row) :
        () => onPrefixDetails(row));
      menuList.appendChild(detailItem);

      if (row.type === 'content') {
        // 下载按钮（仅文件）
        const downloadItem = document.createElement('div');
        downloadItem.className = 'bb-menu-item';
        const downloadIcon = document.createElement('i');
        downloadIcon.className = 'mdi mdi-download';
        downloadItem.appendChild(downloadIcon);
        downloadItem.appendChild(document.createTextNode('下载'));
        downloadItem.addEventListener('click', () => onRowDownload(row));
        menuList.appendChild(downloadItem);
      }

      // 复制按钮（文件和文件夹都有）
      const copyItem = document.createElement('div');
      copyItem.className = 'bb-menu-item';
      const copyIcon = document.createElement('i');
      copyIcon.className = 'mdi mdi-content-copy';
      copyItem.appendChild(copyIcon);
      copyItem.appendChild(document.createTextNode('复制'));
      copyItem.addEventListener('click', row.type === 'content' ?
        () => onRowCopy(row) :
        () => onPrefixCopy(row));
      menuList.appendChild(copyItem);

      // 重命名按钮
      const renameItem = document.createElement('div');
      renameItem.className = 'bb-menu-item';
      const renameIcon = document.createElement('i');
      renameIcon.className = 'mdi mdi-rename-outline';
      renameItem.appendChild(renameIcon);
      renameItem.appendChild(document.createTextNode('重命名'));
      renameItem.addEventListener('click', row.type === 'content' ?
        () => onRowRename(row) :
        () => onPrefixRename(row));
      menuList.appendChild(renameItem);

      // 删除按钮
      const deleteItem = document.createElement('div');
      deleteItem.className = 'bb-menu-item danger';
      const deleteIcon = document.createElement('i');
      deleteIcon.className = 'mdi mdi-delete-outline';
      deleteItem.appendChild(deleteIcon);
      deleteItem.appendChild(document.createTextNode('删除'));
      deleteItem.addEventListener('click', row.type === 'content' ?
        () => onRowDelete(row) :
        () => onPrefixDelete(row));
      menuList.appendChild(deleteItem);

      popover.appendChild(menuList);
      menuDiv.appendChild(kebab);
      menuDiv.appendChild(popover);
      actionsDiv.appendChild(menuDiv);
      actionsCell.appendChild(actionsDiv);
      tr.appendChild(actionsCell);

      elements.tableBody.appendChild(tr);
    });

    // 初始化菜单行为（使用现有的menu.js）
    if (BB.menu && BB.menu.initMenus) {
      BB.menu.initMenus();
    }
  }

  // 渲染网格视图
  function renderGridView() {
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-view-container';

    state.pathContentTableData.forEach(row => {
      const gridItem = document.createElement('div');
      gridItem.className = 'grid-view-item';
      if (row.type === 'prefix') {
        gridItem.classList.add('folder');
      }

      const icon = document.createElement('i');
      icon.className = `mdi mdi-${fileRowIcon(row)}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'grid-item-name';
      nameSpan.textContent = row.name;

      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'grid-item-details';

      if (row.type === 'content') {
        const sizeSpan = document.createElement('span');
        sizeSpan.textContent = formatBytes(row.size);
        detailsDiv.appendChild(sizeSpan);
      }

      const dateSpan = document.createElement('span');
      dateSpan.textContent = row.dateModified ? formatDateTime_relative(row.dateModified) : '-';
      detailsDiv.appendChild(dateSpan);

      gridItem.appendChild(icon);
      gridItem.appendChild(nameSpan);
      gridItem.appendChild(detailsDiv);

      // 点击事件
      gridItem.addEventListener('click', () => {
        if (row.type === 'content') {
          openPreview(row);
        } else {
          goToPrefix(row.prefix);
        }
      });

      // 右键菜单（上下文菜单）
      gridItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // 这里可以添加右键菜单功能，暂时使用已有的菜单系统
        // 可以触发一个自定义事件或者直接调用菜单函数
        if (BB.menu && BB.menu.showMenuForElement) {
          // 简单实现：显示一个提示，实际需要集成现有菜单系统
          BB.ui.toast(`右键菜单：${row.name}`);
        }
      });

      gridContainer.appendChild(gridItem);
    });

    if (elements.gridViewContainer) {
      elements.gridViewContainer.appendChild(gridContainer);
    } else {
      elements.tableBody.appendChild(gridContainer);
    }
  }

  // 渲染分页信息
  function renderPagination() {
    const page = currentPage();
    const start = (page - 1) * state.pageSize;
    const end = page * state.pageSize;
    elements.pageInfo.textContent = `Item ${start} to ${end}`;

    elements.prevPageButton.disabled = state.previousContinuationTokens.length === 0;
    elements.nextPageButton.disabled = !state.nextContinuationToken;

    // 更新下载所有按钮状态
    elements.downloadAllButton.disabled = !canDownloadAll();
  }

  // 更新状态并重新渲染
  function updateState(newState) {
    Object.assign(state, newState);
    render();
  }

  // 设置视图模式
  function setViewMode(mode) {
    if (state.viewMode === mode) return;
    state.viewMode = mode;

    // 更新按钮active状态
    if (mode === 'list') {
      elements.listViewButton.classList.add('active');
      elements.gridViewButton.classList.remove('active');
    } else {
      elements.listViewButton.classList.remove('active');
      elements.gridViewButton.classList.add('active');
    }

    // 重新渲染表格
    renderTable();
  }

  // 重新渲染所有组件
  function render() {
    renderBreadcrumbs();
    renderTable();
    renderPagination();
  }

  // 导航函数
  function goToPrefix(prefix) {
    const h = '#' + String(prefix || '');
    if (window.location.hash !== h) window.location.hash = h;
  }

  function updatePathFromHash() {
    const raw = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
    console.log('updatePathFromHash raw:', raw);
    const q = raw.indexOf('?');
    const path = q === -1 ? raw : raw.slice(0, q);
    let target = path || '';
    if (!target && config.rootPrefix) target = config.rootPrefix;
    console.log('updatePathFromHash target:', target, 'current pathPrefix:', state.pathPrefix);
    if (state.pathPrefix !== target) {
      updateState({
        pathPrefix: target,
        previousContinuationTokens: [],
        continuationToken: undefined,
        nextContinuationToken: undefined
      });
      refresh();
    } else {
      if (!state.pathContentTableData.length) refresh();
    }
  }

  function searchByPrefix() {
    console.log('searchByPrefix called, searchPrefix=', state.searchPrefix, 'pathPrefix=', state.pathPrefix);
    if (validBucketPrefix(state.searchPrefix)) {
      let base = state.pathPrefix || '';
      // 如果base非空且不以斜杠结尾，添加斜杠，确保在当前目录内搜索
      if (base && !base.endsWith('/')) {
        base += '/';
      }
      const nextPath = base + state.searchPrefix;
      console.log('base=', base, 'nextPath=', nextPath);
      if (('#' + nextPath) !== window.location.hash) window.location.hash = nextPath;
    } else {
      console.log('Invalid bucket prefix:', state.searchPrefix);
    }
  }

  // 数据获取
  async function refresh() {
    if (state.isRefreshing) return;
    updateState({ isRefreshing: true });

    try {
      const prefix = bucketPrefix() || '';
      let url = `/api/list?prefix=${encodeURIComponent(prefix)}&delimiter=/&max=${state.pageSize || 50}`;

      if (BB.cfg.trashPrefix) {
        url += `&exclude=${encodeURIComponent(BB.cfg.trashPrefix)}`;
      }

      if (state.continuationToken) {
        url += `&continuationToken=${encodeURIComponent(state.continuationToken)}`;
      }

      console.log('refresh API call:', url);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      console.log('refresh API response:', data);

      const nextContinuationToken = data.nextContinuationToken || undefined;

      const items = (data.items || []).map(it => {
        if (it.type === 'prefix') {
          const relPrefix = (it.prefix || '').replace(new RegExp('^' + (BB.cfg.rootPrefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
          return {
            type: 'prefix',
            name: it.name || (relPrefix.split('/').slice(-2)[0] + '/'),
            prefix: relPrefix,
            size: 0,
            dateModified: null
          };
        } else {
          const key = it.key || '';
          const url = `${(BB.cfg.bucketUrl || '/s3').replace(/\/*$/, '')}/${BB.detect.encodePath(key)}`;
          let installUrl;
          if (url.endsWith('/manifest.plist') && (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            installUrl = `itms-services://?action=download-manifest&url=${BB.detect.encodePath(url)}`;
          }
          return {
            type: 'content',
            name: it.name || key.split('/').pop(),
            key,
            size: it.size || 0,
            dateModified: it.lastModified ? new Date(it.lastModified) : null,
            url,
            installUrl
          };
        }
      });

      const filtered = items.filter(row => {
        const keyLike = row.type === 'prefix' ? row.prefix : row.key;
        if (!keyLike) return true;
        return !BB.cfg.keyExcludePatterns.find(rx => rx.test(String(keyLike).replace(/^\//,'')));
      });

      const map = new Map();
      for (const it of filtered) {
        const id = (it.type === 'prefix' ? 'P:' + it.prefix : 'F:' + it.key);
        if (!map.has(id)) map.set(id, it);
      }
      const pathContentTableData = Array.from(map.values());

      updateState({
        pathContentTableData,
        nextContinuationToken,
        isRefreshing: false
      });
    } catch (error) {
      BB.ui.toast((error && (error.message || error))?.toString() || 'Error');
      updateState({ isRefreshing: false });
    }
  }

  function previousPage() {
    if (state.previousContinuationTokens.length > 0) {
      const continuationToken = state.previousContinuationTokens.pop();
      updateState({ continuationToken });
      refresh();
    }
  }

  function nextPage() {
    if (state.nextContinuationToken) {
      state.previousContinuationTokens.push(state.continuationToken);
      updateState({
        continuationToken: state.nextContinuationToken
      });
      refresh();
    }
  }

  // 操作函数
  async function openPreview(row) {
    const dir = (state.pathPrefix || '').replace(/[^/]*$/, '');
    const base = location.pathname.replace(/[^/]*$/, '') + 'preview';
    const href = `${base}#${dir}${row.name}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  async function onRowDownload(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    BB.actions.downloadObject(absKey, row.name);
  }

  async function onRowCopy(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.copyObject(absKey);
    if (dst) await refresh();
  }

  async function onRowRename(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.renameObject(absKey);
    if (dst) await refresh();
  }

  function onRowMetadata(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    BB.actions.showFileDetails(absKey);
  }

  async function onRowDelete(row) {
    const absKey = ((config.rootPrefix||'') + (state.pathPrefix||'') + row.name).replace(/\/{2,}/g,'/');
    const ok = await BB.actions.deleteObject(absKey);
    if (ok) await refresh();
  }

  function onPrefixDetails(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    BB.actions.showPrefixDetails(prefixAbs);
  }

  async function onPrefixCopy(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.copyPrefix(prefixAbs);
    if (dst) await refresh();
  }

  async function onPrefixRename(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    const dst = await BB.actions.renamePrefix(prefixAbs);
    if (dst) await refresh();
  }

  async function onPrefixDelete(row) {
    const prefixAbs = ((config.rootPrefix||'') + row.prefix).replace(/\/{2,}/g,'/');
    const ok = await BB.actions.deletePrefix(prefixAbs);
    if (ok) await refresh();
  }

  function onCurrentFolderDetails() {
    const prefixAbs = (bucketPrefix() || '').replace(/\/{2,}/g,'/');
    BB.actions.showPrefixDetails(prefixAbs);
  }

  // 上传功能
  function triggerUpload() {
    elements.fileInput.value = '';
    elements.fileInput.click();
  }

  function triggerUploadDir() {
    elements.dirInput.value = '';
    elements.dirInput.click();
  }

  async function onFileInput(evt) {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;
    await uploadFiles(files, f => f.name);
    evt.target.value = '';
    await refresh();
  }

  async function onDirInput(evt) {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;
    await uploadFiles(files, f => f.webkitRelativePath || f.name);
    evt.target.value = '';
    await refresh();
  }

  async function uploadFiles(files, keyResolver) {
    const base = (config.bucketUrl || '/s3').replace(/\/*$/, '');
    const concurrency = 5;
    const queue = files.slice();
    const runOne = async () => {
      const f = queue.shift(); if (!f) return;
      const rel = keyResolver(f);
      const key = (bucketPrefix() + rel).replace(/\/{2,}/g, '/');
      const putURL = `${base}/${encodePath(key)}`;
      try {
        const res = await fetch(putURL, { method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f });
        if (!res.ok) { const txt = await res.text().catch(()=>''); throw new Error(`HTTP ${res.status}${txt ? ' – ' + txt : ''}`); }
      } catch (e) { BB.ui.toast(`Upload failed: ${rel} — ${e}`); }
      if (queue.length) await runOne();
    };
    await Promise.all(Array.from({length: Math.min(concurrency, queue.length)}, runOne));
    BB.ui.toast(`Upload done (${files.length})`);
  }

  // 下载所有文件
  async function downloadAllFiles() {
    if (!window.fflate || !window.fflate.Zip || !window.fflate.ZipPassThrough) {
      BB.ui.toast('Archive not available (fflate not loaded).');
      return;
    }
    const { Zip, ZipPassThrough } = window.fflate;
    const archiveFiles = state.pathContentTableData.filter(i => i.type === 'content').map(i => i.url);
    if (!archiveFiles.length) { BB.ui.toast('No file to download'); return; }
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
        if (done) { fileStream.push(new Uint8Array(), true); break; }
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
    a.href = href; a.download = `${archiveName || 'archive'}.zip`; a.click();
    URL.revokeObjectURL(href);

    state.downloadAllFilesCount = state.downloadAllFilesReceivedCount = state.downloadAllFilesProgress = null;
  }

  // 下拉菜单切换
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

  // 关闭所有下拉菜单
  function closeAllDropdowns() {
    const actionDropdown = elements.actionsDropdownButton.closest('.toolbar-dropdown');
    const newDropdown = elements.newDropdownButton.closest('.toolbar-dropdown');
    actionDropdown.classList.remove('open');
    newDropdown.classList.remove('open');
    state.dropdownOpen = null;
  }

  // 事件监听器设置
  function setupEventListeners() {
    // 根目录链接
    elements.rootLink.addEventListener('click', () => goToPrefix(''));

    // 搜索
    elements.searchButton.addEventListener('click', searchByPrefix);
    elements.searchInput.addEventListener('keyup', (e) => {
      console.log('search input keyup, value=', e.target.value, 'key=', e.key);
      state.searchPrefix = e.target.value;
      if (e.key === 'Enter') searchByPrefix();
    });

    // 刷新
    elements.refreshButton.addEventListener('click', () => {
      updateState({
        previousContinuationTokens: [],
        continuationToken: undefined,
        nextContinuationToken: undefined
      });
      refresh();
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
    elements.listViewButton.addEventListener('click', () => setViewMode('list'));
    elements.gridViewButton.addEventListener('click', () => setViewMode('grid'));

    // 文件输入
    elements.fileInput.addEventListener('change', onFileInput);
    elements.dirInput.addEventListener('change', onDirInput);

    // 分页
    elements.pageSizeSelect.addEventListener('change', (e) => {
      const pageSize = Number(e.target.value) || 50;
      config.pageSize = pageSize;
      updateState({
        pageSize,
        previousContinuationTokens: [],
        continuationToken: undefined,
        nextContinuationToken: undefined
      });
      refresh();
    });

    elements.prevPageButton.addEventListener('click', previousPage);
    elements.nextPageButton.addEventListener('click', nextPage);

    // 窗口大小
    window.addEventListener('resize', () => {
      state.windowWidth = window.innerWidth;
    });

    // hash变化
    window.addEventListener('hashchange', updatePathFromHash);

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

  // 初始化
  function init() {
    state.hasFflate = !!(window && window.fflate);
    setupEventListeners();
    updatePathFromHash();
    // 初始化视图模式按钮状态
    setViewMode(state.viewMode);
    if (!state.pathContentTableData.length) {
      refresh();
    }
  }

  // 启动应用
  init();
})();