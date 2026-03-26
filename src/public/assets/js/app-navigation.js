/*!
 * S3 Browser - 导航模块
 * 包含路径导航、数据获取和分页功能
 */

(function () {
  'use strict';

  // 确保 BB 对象存在
  window.BB = window.BB || {};

  // 创建导航模块命名空间
  BB.nav = BB.nav || {};

  // 局部变量引用，提高可读性
  const config = BB.core.config;
  const state = BB.core.state;
  const utils = BB.core;

  // ============================================
  // 路径导航函数
  // ============================================

  /**
   * 跳转到指定前缀路径
   * @param {string} prefix - 目标前缀路径
   */
  function goToPrefix(prefix) {
    const h = '#' + String(prefix || '');
    if (window.location.hash !== h) window.location.hash = h;
  }

  /**
   * 从 URL hash 更新当前路径
   */
  function updatePathFromHash() {
    const raw = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
    console.log('updatePathFromHash raw:', raw);
    const q = raw.indexOf('?');
    const path = q === -1 ? raw : raw.slice(0, q);
    let target = path || '';
    if (!target && config.rootPrefix) target = config.rootPrefix;
    console.log('updatePathFromHash target:', target, 'current pathPrefix:', state.pathPrefix);
    if (state.pathPrefix !== target) {
      BB.render.updateState({
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

  /**
   * 根据搜索前缀进行搜索
   */
  function searchByPrefix() {
    console.log('searchByPrefix called, searchPrefix=', state.searchPrefix, 'pathPrefix=', state.pathPrefix);
    if (utils.validBucketPrefix(state.searchPrefix)) {
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

  // ============================================
  // 数据获取函数
  // ============================================

  /**
   * 刷新当前路径的数据
   */
  async function refresh() {
    if (state.isRefreshing) return;
    BB.render.updateState({ isRefreshing: true });

    try {
      const prefix = utils.bucketPrefix() || '';
      let url = `/api/list?prefix=${encodeURIComponent(prefix)}&delimiter=/&max=${state.pageSize || 50}`;

      if (config.trashPrefix) {
        url += `&exclude=${encodeURIComponent(config.trashPrefix)}`;
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
          const relPrefix = (it.prefix || '').replace(
            new RegExp('^' + (config.rootPrefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            ''
          );
          return {
            type: 'prefix',
            name: it.name || (relPrefix.split('/').slice(-2)[0] + '/'),
            prefix: relPrefix,
            size: 0,
            dateModified: null
          };
        } else {
          const key = it.key || '';
          const url = `${(config.bucketUrl || '/s3').replace(/\/*$/, '')}/${BB.detect.encodePath(key)}`;
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
        return !config.keyExcludePatterns.find(rx => rx.test(String(keyLike).replace(/^\//,'')));
      });

      const map = new Map();
      for (const it of filtered) {
        const id = (it.type === 'prefix' ? 'P:' + it.prefix : 'F:' + it.key);
        if (!map.has(id)) map.set(id, it);
      }
      const pathContentTableData = Array.from(map.values());

      BB.render.updateState({
        pathContentTableData,
        nextContinuationToken,
        isRefreshing: false
      });
    } catch (error) {
      BB.ui.toast((error && (error.message || error))?.toString() || 'Error');
      BB.render.updateState({ isRefreshing: false });
    }
  }

  /**
   * 打开文件预览
   * @param {Object} row - 文件行数据
   */
  async function openPreview(row) {
    const dir = (state.pathPrefix || '').replace(/[^/]*$/, '');
    const base = location.pathname.replace(/[^/]*$/, '') + 'preview';
    const href = `${base}#${dir}${row.name}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  // ============================================
  // 分页函数
  // ============================================

  /**
   * 跳转到上一页
   */
  function previousPage() {
    if (state.previousContinuationTokens.length > 0) {
      const continuationToken = state.previousContinuationTokens.pop();
      BB.render.updateState({ continuationToken });
      refresh();
    }
  }

  /**
   * 跳转到下一页
   */
  function nextPage() {
    if (state.nextContinuationToken) {
      state.previousContinuationTokens.push(state.continuationToken);
      BB.render.updateState({
        continuationToken: state.nextContinuationToken
      });
      refresh();
    }
  }

  // ============================================
  // 公共 API
  // ============================================

  BB.nav.goToPrefix = goToPrefix;
  BB.nav.updatePathFromHash = updatePathFromHash;
  BB.nav.searchByPrefix = searchByPrefix;
  BB.nav.refresh = refresh;
  BB.nav.openPreview = openPreview;
  BB.nav.previousPage = previousPage;
  BB.nav.nextPage = nextPage;

})();