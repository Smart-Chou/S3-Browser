/*!
 * S3 Browser - 渲染模块
 * 包含所有UI渲染逻辑
 */

(function () {
    "use strict";

    // 确保 BB 对象存在
    window.BB = window.BB || {};

    // 创建渲染模块命名空间
    BB.render = BB.render || {};

    // 局部变量引用，提高可读性
    const config = BB.core.config;
    const state = BB.core.state;
    const elements = BB.core.elements;
    const utils = BB.core;

    // ============================================
    // 渲染函数
    // ============================================

    /**
     * 渲染面包屑导航
     */
    function renderBreadcrumbs() {
        const crumbs = utils.breadcrumbs();
        elements.breadcrumbs.innerHTML = "";

        if (crumbs.length === 0) {
            elements.emptyBreadcrumb.style.display = "block";
            return;
        }

        elements.emptyBreadcrumb.style.display = "none";

        crumbs.forEach((c, idx) => {
            const item = document.createElement("div");
            item.className = "breadcrumb-item";

            const link = document.createElement("span");
            link.className = "breadcrumb-link clickable";
            link.title = c.prefix;
            link.textContent = c.name;
            link.addEventListener("click", () => BB.nav.goToPrefix(c.prefix));

            item.appendChild(link);

            if (idx < crumbs.length - 1) {
                const sep = document.createElement("span");
                sep.className = "breadcrumb-separator";
                sep.textContent = "/";
                item.appendChild(sep);
            }

            elements.breadcrumbs.appendChild(item);
        });
    }

    /**
     * 渲染表格（主渲染函数）
     */
    function renderTable() {
        elements.tableBody.innerHTML = "";
        if (elements.gridViewContainer) {
            elements.gridViewContainer.innerHTML = "";
        }

        if (state.isRefreshing) {
            elements.loadingIndicator.style.display = "block";
            elements.emptyTable.style.display = "none";
            elements.fileTable.style.display = "none";
            if (elements.gridViewContainer) {
                elements.gridViewContainer.style.display = "none";
            }
            renderReadme(); // 确保 readme 容器隐藏
            return;
        }

        elements.loadingIndicator.style.display = "none";

        if (state.pathContentTableData.length === 0) {
            elements.emptyTable.style.display = "block";
            elements.fileTable.style.display = "none";
            if (elements.gridViewContainer) {
                elements.gridViewContainer.style.display = "none";
            }
            renderReadme(); // 显示 readme（如果存在）
            return;
        }

        elements.emptyTable.style.display = "none";

        if (state.viewMode === "list") {
            elements.fileTable.style.display = "table";
            if (elements.gridViewContainer) {
                elements.gridViewContainer.style.display = "none";
            }
            renderListView();
        } else {
            elements.fileTable.style.display = "none";
            if (elements.gridViewContainer) {
                elements.gridViewContainer.style.display = "block";
            }
            renderGridView();
        }
        renderReadme();
    }

    /**
     * 确保 readme 容器存在
     */
    function ensureReadmeContainer() {
        if (!elements.readmeContainer) {
            // 找到 table-wrap 容器
            const tableWrap = document.querySelector('.table-wrap');
            if (tableWrap) {
                const container = document.createElement('div');
                container.id = 'readme-container';
                container.className = 'readme-container';
                // 添加一些基本样式
                container.style.marginTop = '2rem';
                container.style.padding = '1.5rem';
                container.style.border = '1px solid #e5e7eb';
                container.style.borderRadius = '0.5rem';
                container.style.backgroundColor = '#f9fafb';
                // 插入到 table-wrap 末尾
                tableWrap.appendChild(container);
                elements.readmeContainer = container;
            }
        }
        return elements.readmeContainer;
    }

    /**
     * 渲染 readme 内容
     */
    function renderReadme() {
        const container = ensureReadmeContainer();
        if (!container) return;

        // 在刷新状态、非根目录或没有 readme 内容时隐藏
        if (state.isRefreshing || state.pathPrefix || !state.readmeContent) {
            container.style.display = 'none';
            return;
        }

        // 显示并渲染 readme
        container.style.display = 'block';
        container.innerHTML = '';
        // 使用 BB.render.renderMarkdown 渲染
        if (BB.render && BB.render.renderMarkdown) {
            const markdownEl = BB.render.renderMarkdown(state.readmeContent);
            container.appendChild(markdownEl);
        } else {
            // 降级处理：显示原始文本
            const pre = document.createElement('pre');
            pre.textContent = state.readmeContent;
            container.appendChild(pre);
        }
    }

    /**
     * 渲染列表视图
     */
    function renderListView() {
        elements.tableBody.innerHTML = "";

        state.pathContentTableData.forEach((row) => {
            const tr = document.createElement("tr");
            tr.className = "file-row";

            // 名称列
            const nameCell = document.createElement("td");
            nameCell.className = "table-col-name";
            const nameDiv = document.createElement("div");
            nameDiv.style.display = "flex";
            nameDiv.style.alignItems = "center";
            nameDiv.style.gap = ".5rem";

            const icon = document.createElement("i");
            icon.className = `mdi mdi-${utils.fileRowIcon(row)} name-column-icon is-smmd`;

            const nameSpan = document.createElement("span");
            nameSpan.className = "clickable";
            nameSpan.title = row.name;
            nameSpan.textContent = row.name;

            if (row.type === "content") {
                nameSpan.addEventListener("click", () =>
                    BB.events.openPreview(row),
                );
            } else {
                nameSpan.addEventListener("click", () =>
                    BB.nav.goToPrefix(row.prefix),
                );
            }

            nameDiv.appendChild(icon);
            nameDiv.appendChild(nameSpan);
            nameCell.appendChild(nameDiv);
            tr.appendChild(nameCell);

            // 大小列
            const sizeCell = document.createElement("td");
            sizeCell.className = "table-col-size";
            if (row.type === "content") {
                sizeCell.textContent = utils.formatBytes(row.size);
            } else {
                sizeCell.textContent = "—";
            }
            tr.appendChild(sizeCell);

            // 修改时间列
            const dateCell = document.createElement("td");
            dateCell.className = "table-col-modified";
            if (row.dateModified) {
                const span = document.createElement("span");
                span.title = utils.formatDateTime_utc(row.dateModified);
                span.textContent = utils.formatDateTime_relative(
                    row.dateModified,
                );
                dateCell.appendChild(span);
            } else {
                dateCell.textContent = "—";
            }
            tr.appendChild(dateCell);

            // 操作列
            const actionsCell = document.createElement("td");
            actionsCell.className = "table-col-actions";
            const actionsDiv = document.createElement("div");
            actionsDiv.style.display = "flex";
            actionsDiv.style.justifyContent = "flex-end";

            const menuDiv = document.createElement("div");
            menuDiv.className = "bb-menu";
            menuDiv.setAttribute(
                row.type === "content" ? "data-key" : "data-prefix",
                row.type === "content" ? row.key : row.prefix,
            );

            const kebab = document.createElement("span");
            kebab.className = "bb-kebab";
            kebab.setAttribute("aria-haspopup", "menu");
            kebab.setAttribute("aria-expanded", "false");
            kebab.title = "选项";
            const kebabIcon = document.createElement("i");
            kebabIcon.className = "mdi mdi-dots-vertical";
            kebab.appendChild(kebabIcon);

            const popover = document.createElement("div");
            popover.className = "bb-menu-popover";
            const menuList = document.createElement("div");
            menuList.className = "bb-menu-list";

            // 详情按钮
            const detailItem = document.createElement("div");
            detailItem.className = "bb-menu-item";
            const detailIcon = document.createElement("i");
            detailIcon.className = "mdi mdi-information-outline";
            detailItem.appendChild(detailIcon);
            detailItem.appendChild(document.createTextNode(" 详情"));
            detailItem.addEventListener(
                "click",
                row.type === "content"
                    ? () => BB.events.onRowMetadata(row)
                    : () => BB.events.onPrefixDetails(row),
            );
            menuList.appendChild(detailItem);

            if (row.type === "content") {
                // 下载按钮（仅文件）
                const downloadItem = document.createElement("div");
                downloadItem.className = "bb-menu-item";
                const downloadIcon = document.createElement("i");
                downloadIcon.className = "mdi mdi-download";
                downloadItem.appendChild(downloadIcon);
                downloadItem.appendChild(document.createTextNode("下载"));
                downloadItem.addEventListener("click", () =>
                    BB.events.onRowDownload(row),
                );
                menuList.appendChild(downloadItem);
            }

            // 复制按钮（文件和文件夹都有）
            const copyItem = document.createElement("div");
            copyItem.className = "bb-menu-item";
            const copyIcon = document.createElement("i");
            copyIcon.className = "mdi mdi-content-copy";
            copyItem.appendChild(copyIcon);
            copyItem.appendChild(document.createTextNode("复制"));
            copyItem.addEventListener(
                "click",
                row.type === "content"
                    ? () => BB.events.onRowCopy(row)
                    : () => BB.events.onPrefixCopy(row),
            );
            menuList.appendChild(copyItem);

            // 重命名按钮
            const renameItem = document.createElement("div");
            renameItem.className = "bb-menu-item";
            const renameIcon = document.createElement("i");
            renameIcon.className = "mdi mdi-rename-outline";
            renameItem.appendChild(renameIcon);
            renameItem.appendChild(document.createTextNode("重命名"));
            renameItem.addEventListener(
                "click",
                row.type === "content"
                    ? () => BB.events.onRowRename(row)
                    : () => BB.events.onPrefixRename(row),
            );
            menuList.appendChild(renameItem);

            // 删除按钮
            const deleteItem = document.createElement("div");
            deleteItem.className = "bb-menu-item danger";
            const deleteIcon = document.createElement("i");
            deleteIcon.className = "mdi mdi-delete-outline";
            deleteItem.appendChild(deleteIcon);
            deleteItem.appendChild(document.createTextNode("删除"));
            deleteItem.addEventListener(
                "click",
                row.type === "content"
                    ? () => BB.events.onRowDelete(row)
                    : () => BB.events.onPrefixDelete(row),
            );
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

    /**
     * 渲染网格视图
     */
    function renderGridView() {
        const gridContainer = document.createElement("div");
        gridContainer.className = "grid-view-container";

        state.pathContentTableData.forEach((row) => {
            const gridItem = document.createElement("div");
            gridItem.className = "grid-view-item";
            if (row.type === "prefix") {
                gridItem.classList.add("folder");
            }

            // 图标
            const icon = document.createElement("i");
            icon.className = `mdi mdi-${utils.fileRowIcon(row)} grid-view-icon`;

            // 名称
            const nameDiv = document.createElement("div");
            nameDiv.className = "grid-view-name";
            nameDiv.textContent = row.name;

            // 大小/修改时间
            const metaDiv = document.createElement("div");
            metaDiv.className = "grid-view-meta";

            if (row.type === "content") {
                const sizeSpan = document.createElement("span");
                sizeSpan.className = "grid-view-size";
                sizeSpan.textContent = utils.formatBytes(row.size);
                metaDiv.appendChild(sizeSpan);

                if (row.dateModified) {
                    const timeSpan = document.createElement("span");
                    timeSpan.className = "grid-view-time";
                    timeSpan.textContent = utils.formatDateTime_relative(
                        row.dateModified,
                    );
                    metaDiv.appendChild(timeSpan);
                }
            } else {
                const folderSpan = document.createElement("span");
                folderSpan.className = "grid-view-folder";
                folderSpan.textContent = "文件夹";
                metaDiv.appendChild(folderSpan);
            }

            gridItem.appendChild(icon);
            gridItem.appendChild(nameDiv);
            gridItem.appendChild(metaDiv);

            // 点击事件
            gridItem.addEventListener("click", () => {
                if (row.type === "content") {
                    BB.events.openPreview(row);
                } else {
                    BB.nav.goToPrefix(row.prefix);
                }
            });

            // 右键菜单
            gridItem.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                if (BB.menu && BB.menu.showMenuForElement) {
                    BB.menu.showMenuForElement(e.target, {
                        key: row.type === "content" ? row.key : null,
                        prefix: row.type === "prefix" ? row.prefix : null,
                    });
                } else {
                    BB.ui.toast(`右键菜单：${row.name}`);
                }
            });

            gridContainer.appendChild(gridItem);
        });

        elements.gridViewContainer.innerHTML = "";
        elements.gridViewContainer.appendChild(gridContainer);
    }

    /**
     * 渲染分页信息
     */
    function renderPagination() {
        if (!elements.pageInfo) return;

        const total = state.pathContentTableData.length;
        const page = utils.currentPage();
        const hasPrev = page > 1;
        const hasNext = !!state.nextContinuationToken;

        elements.prevPageButton.disabled = !hasPrev;
        elements.nextPageButton.disabled = !hasNext;

        if (state.totalCount !== null && state.totalCount !== undefined) {
            elements.pageInfo.textContent = `第 ${page} 页，本页 ${total} 项（共 ${state.totalCount} 项）${hasNext ? "（还有更多）" : ""}`;
        } else {
            elements.pageInfo.textContent = `第 ${page} 页，本页 ${total} 项（每页 ${state.pageSize} 项）${hasNext ? "（还有更多）" : "（最后一页）"}`;
        }

        // 下载全部按钮状态
        if (elements.downloadAllButton) {
            elements.downloadAllButton.disabled = !utils.canDownloadAll();
        }
    }

    /**
     * 更新应用状态并触发重新渲染
     * @param {Object} newState - 新的状态属性
     */
    function updateState(newState) {
        Object.assign(state, newState);
        render();
    }

    /**
     * 设置视图模式（列表/网格）
     * @param {string} mode - 'list' 或 'grid'
     */
    function setViewMode(mode) {
        if (mode !== "list" && mode !== "grid") return;

        state.viewMode = mode;

        // 更新按钮状态
        if (elements.listViewButton && elements.gridViewButton) {
            elements.listViewButton.classList.toggle("active", mode === "list");
            elements.gridViewButton.classList.toggle("active", mode === "grid");
        }

        // 保存到 localStorage
        try {
            localStorage.setItem("s3browser-view-mode", mode);
        } catch (e) {
            console.warn("无法保存视图模式:", e);
        }

        render();
    }

    /**
     * 主渲染函数
     */
    function render() {
        renderBreadcrumbs();
        renderTable();
        renderPagination();
    }

    // ============================================
    // 公共 API
    // ============================================

    BB.render.renderBreadcrumbs = renderBreadcrumbs;
    BB.render.renderTable = renderTable;
    BB.render.renderListView = renderListView;
    BB.render.renderGridView = renderGridView;
    BB.render.renderPagination = renderPagination;
    BB.render.updateState = updateState;
    BB.render.setViewMode = setViewMode;
    BB.render.render = render;
})();
