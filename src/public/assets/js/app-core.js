/*!
 * S3 Browser - 核心模块
 * 包含配置、状态管理、工具函数
 */

(function () {
  'use strict';

  // 确保 BB 对象存在
  window.BB = window.BB || {};

  // 创建核心模块命名空间
  BB.core = BB.core || {};

  // ============================================
  // 配置
  // ============================================
  const config = {
    primaryColor: '#167df0',
    allowDownloadAll: true,
    bucketUrl: '/s3',
    bucketMaskUrl: '/s3',
    rootPrefix: '',
    trashPrefix: '_trash/',
    keyExcludePatterns: [/^index\.html$/],
    pageSize: 10,
    defaultOrder: 'name-asc'
  };
  BB.cfg = config;

  // ============================================
  // 应用状态
  // ============================================
  const state = {
    pathPrefix: '',
    searchPrefix: '',
    pathContentTableData: [],
    previousContinuationTokens: [],
    continuationToken: undefined,
    nextContinuationToken: undefined,
    totalCount: null,
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

  // ============================================
  // DOM元素引用
  // ============================================
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

  // ============================================
  // 工具函数
  // ============================================

  // 字符串原型扩展
  String.prototype.removePrefix = function (prefix) {
    return this.startsWith(prefix) ? this.substring(prefix.length) : this;
  };

  String.prototype.escapeHTML = function () {
    const t = document.createElement('span');
    t.innerText = this;
    return t.innerHTML;
  };

  // 路径编码
  function encodePath(path) {
    path = (path || '').replace(/\/{2,}/g, '/');
    try {
      if (decodeURI(path) !== path) return path;
    } catch (e) {}
    const m = {
      ";":"%3B","?":"%3F",":":"%3A","@":"%40",
      "&":"%26","=":"%3D","+":"%2B","$":"%24",
      ",":"%2C","#":"%23"
    };
    return encodeURI(path).split("").map(ch => m[ch] || ch).join("");
  }

  // 获取文件扩展名
  function extOf(s='') {
    const m = /\.([^.]+)$/.exec((s||'').toLowerCase());
    return m ? m[1] : '';
  }

  // 文件类型检测函数
  function isImageExt(e){ return BB.detect.isImageExt(e); }
  function isArchiveExt(e){ return BB.detect.isArchiveExt(e); }
  function isVideoExt(e){ return BB.detect.isVideoExt(e); }
  function isAudioExt(e){ return BB.detect.isAudioExt(e); }
  function isSpreadsheetExt(e){ return BB.detect.isSpreadsheetExt(e); }
  function isPresentationExt(e){ return BB.detect.isPresentationExt(e); }
  function isPdfExt(e){ return BB.detect.isPdfExt(e); }
  function isCodeExt(e){ return BB.detect.isCodeExt(e); }

  // 文件行图标
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

  // 格式化字节大小
  function formatBytes(size) {
    if (!Number.isFinite(size)) return '-';
    const KB = 1024, MB = 1048576, GB = 1073741824;
    if (size < KB) return size + '  B';
    if (size < MB) return (size / KB).toFixed(0) + ' KB';
    if (size < GB) return (size / MB).toFixed(2) + ' MB';
    return (size / GB).toFixed(2) + ' GB';
  }

  // 格式化日期时间
  function formatDateTime_relative(d){
    return d ? moment(d).fromNow() : '-';
  }

  function formatDateTime_utc(d){
    return d ? moment(d).utc().format('YYYY-MM-DD HH:mm:ss [UTC]') : '';
  }

  // 验证存储桶前缀
  function validBucketPrefix(prefix) {
    console.log('validBucketPrefix checking:', prefix);
    if (prefix === '') return true;
    if (prefix.startsWith(' ') || prefix.endsWith(' ')) return false;
    if (prefix.includes('//')) return false;
    if (prefix.startsWith('/') && bucketPrefix().includes('/')) return false;
    return true;
  }

  // 获取完整存储桶前缀
  function bucketPrefix() {
    const result = `${config.rootPrefix}${state.pathPrefix || ''}`;
    console.log('bucketPrefix result:', result, 'rootPrefix:', config.rootPrefix, 'pathPrefix:', state.pathPrefix);
    return result;
  }

  // 当前页码
  function currentPage() {
    return (state.previousContinuationTokens?.length || 0) + 1;
  }

  // 是否可以下载全部文件
  function canDownloadAll() {
    const filesCount = state.pathContentTableData.filter(i => i.type === 'content').length;
    return config.allowDownloadAll && filesCount >= 2;
  }

  // 面包屑数据
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

  // ============================================
  // 初始化配置
  // ============================================
  (function setup() {
    const htmlPrefix = 'HTML>';
    if (config.title) config.titleHTML = config.title.startsWith(htmlPrefix) ?
      config.title.substring(htmlPrefix.length) : config.title.escapeHTML();
    if (config.subtitle) config.subtitleHTML = config.subtitle.startsWith(htmlPrefix) ?
      config.subtitle.substring(htmlPrefix.length) : config.subtitle.escapeHTML();
    config.bucketUrl = config.bucketUrl || '/s3';
    config.bucketMaskUrl = config.bucketMaskUrl || '/s3';
    config.rootPrefix = (config.rootPrefix || '');
    if (config.rootPrefix) config.rootPrefix = config.rootPrefix.replace(/\/?$/, '/');
    document.title = config.title || '存储桶浏览器';
    const fav = document.getElementById('favicon');
    if (fav && config.favicon) fav.href = config.favicon;
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    const absTrash = (config.rootPrefix || '') + (config.trashPrefix || '_trash/');
    const rx = new RegExp('^' + absTrash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!config.keyExcludePatterns.some(r => r.toString() === rx.toString())) {
      config.keyExcludePatterns.push(rx);
    }
  })();

  // ============================================
  // 公共 API
  // ============================================

  // 导出配置、状态和元素引用
  BB.core.config = config;
  BB.core.state = state;
  BB.core.elements = elements;

  // 导出工具函数
  BB.core.encodePath = encodePath;
  BB.core.extOf = extOf;
  BB.core.isImageExt = isImageExt;
  BB.core.isArchiveExt = isArchiveExt;
  BB.core.isVideoExt = isVideoExt;
  BB.core.isAudioExt = isAudioExt;
  BB.core.isSpreadsheetExt = isSpreadsheetExt;
  BB.core.isPresentationExt = isPresentationExt;
  BB.core.isPdfExt = isPdfExt;
  BB.core.isCodeExt = isCodeExt;
  BB.core.fileRowIcon = fileRowIcon;
  BB.core.formatBytes = formatBytes;
  BB.core.formatDateTime_relative = formatDateTime_relative;
  BB.core.formatDateTime_utc = formatDateTime_utc;
  BB.core.validBucketPrefix = validBucketPrefix;
  BB.core.bucketPrefix = bucketPrefix;
  BB.core.currentPage = currentPage;
  BB.core.canDownloadAll = canDownloadAll;
  BB.core.breadcrumbs = breadcrumbs;

})();