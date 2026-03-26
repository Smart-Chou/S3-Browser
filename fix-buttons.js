// 立即解决方案：创建独立的下拉菜单系统
// 将此代码复制到浏览器控制台执行

function createAlternativeDropdownSystem() {
    console.group("🛠️ 创建替代下拉菜单系统");

    // 1. 检查现有结构
    const newButton = document.querySelector(".toolbar-button.primary");
    if (!newButton) {
        console.error("❌ 未找到新建按钮");
        return;
    }

    const toolbar = document.querySelector(".app-toolbar");
    if (!toolbar) {
        console.error("❌ 未找到工具栏");
        return;
    }

    // 2. 创建新的下拉菜单容器
    const dropdownContainer = document.createElement("div");
    dropdownContainer.className = "fixed-dropdown-container";
    dropdownContainer.style.cssText = `
    position: relative;
    display: inline-block;
  `;

    // 3. 创建新的按钮（克隆原按钮但移除Vue绑定）
    const newBtnClone = newButton.cloneNode(true);
    newBtnClone.className = "toolbar-button primary fixed-dropdown-btn";
    newBtnClone.style.cssText = `
    pointer-events: auto !important;
    position: relative !important;
    z-index: 100 !important;
  `;

    // 4. 创建新的下拉菜单
    const newDropdown = document.createElement("div");
    newDropdown.className = "fixed-dropdown-menu";
    newDropdown.style.cssText = `
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 180px;
    z-index: 1000;
    margin-top: 5px;
  `;

    newDropdown.innerHTML = `
    <div class="fixed-dropdown-item" data-action="upload-file">
      <i class="mdi mdi-file-upload-outline"></i>
      <span>上传文件</span>
    </div>
    <div class="fixed-dropdown-item" data-action="upload-dir">
      <i class="mdi mdi-folder-upload"></i>
      <span>上传文件夹</span>
    </div>
    <div style="height:1px; background:#eee; margin:4px 0;"></div>
    <div class="fixed-dropdown-item" data-action="create-folder">
      <i class="mdi mdi-folder-plus-outline"></i>
      <span>新建文件夹</span>
    </div>
  `;

    // 5. 样式
    const style = document.createElement("style");
    style.textContent = `
    .fixed-dropdown-item {
      display: flex;
      align-items: center;
      padding: 10px 15px;
      cursor: pointer;
      color: #333;
      font-size: 14px;
      transition: background 0.2s;
      border-bottom: 1px solid #f5f5f5;
    }
    .fixed-dropdown-item:last-child {
      border-bottom: none;
    }
    .fixed-dropdown-item:hover {
      background: #f8f9fa;
    }
    .fixed-dropdown-item i {
      margin-right: 10px;
      color: #666;
      font-size: 18px;
    }
    .fixed-dropdown-item.danger {
      color: #e74c3c;
    }
    .fixed-dropdown-item.danger:hover {
      background: #fee;
    }
  `;
    document.head.appendChild(style);

    // 6. 事件绑定
    newBtnClone.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();

        // 切换下拉菜单显示
        const isVisible = newDropdown.style.display === "block";
        newDropdown.style.display = isVisible ? "none" : "block";

        // 关闭其他可能的下拉菜单
        document.querySelectorAll(".fixed-dropdown-menu").forEach((menu) => {
            if (menu !== newDropdown) menu.style.display = "none";
        });

        console.log("📌 新建按钮点击，下拉菜单:", isVisible ? "隐藏" : "显示");
    });

    // 7. 菜单项点击事件
    newDropdown.querySelectorAll(".fixed-dropdown-item").forEach((item) => {
        item.addEventListener("click", function () {
            const action = this.getAttribute("data-action");
            console.log(`📋 菜单项点击: ${action}`);

            // 关闭下拉菜单
            newDropdown.style.display = "none";

            // 执行对应操作
            switch (action) {
                case "upload-file":
                    const fileInput =
                        document.querySelector('input[type="file"]');
                    if (fileInput) {
                        fileInput.click();
                    } else {
                        alert("文件上传输入框未找到，请检查页面元素");
                    }
                    break;

                case "upload-dir":
                    const dirInput = document.querySelector(
                        "input[webkitdirectory]",
                    );
                    if (dirInput) {
                        dirInput.click();
                    } else {
                        alert("文件夹上传输入框未找到，请检查页面元素");
                    }
                    break;

                case "create-folder":
                    alert("新建文件夹功能需要后端API支持");
                    break;
            }
        });
    });

    // 8. 点击页面其他地方关闭下拉菜单
    document.addEventListener("click", function (e) {
        if (!dropdownContainer.contains(e.target)) {
            newDropdown.style.display = "none";
        }
    });

    // 9. 替换原按钮
    const originalContainer = newButton.closest(".toolbar-dropdown");
    if (originalContainer) {
        // 隐藏原按钮但不移除（保持布局）
        originalContainer.style.display = "none";

        // 插入新的下拉系统
        toolbar.appendChild(dropdownContainer);
    } else {
        // 直接插入到工具栏
        toolbar.appendChild(dropdownContainer);
    }

    dropdownContainer.appendChild(newBtnClone);
    dropdownContainer.appendChild(newDropdown);

    console.log("✅ 替代下拉菜单系统已创建");
    console.log("   位置: 工具栏右侧");
    console.log("   功能: 上传文件、上传文件夹");
    console.log('   测试: 点击"新建"按钮应显示下拉菜单');

    // 10. 添加快捷键说明
    setTimeout(() => {
        console.log("🎯 快捷键提示:");
        console.log("   - Alt+F: 快速上传文件");
        console.log("   - Alt+D: 快速上传文件夹");

        // 添加快捷键
        document.addEventListener("keydown", function (e) {
            if (e.altKey) {
                if (e.key === "f" || e.key === "F") {
                    e.preventDefault();
                    document.querySelector('input[type="file"]')?.click();
                } else if (e.key === "d" || e.key === "D") {
                    e.preventDefault();
                    document.querySelector("input[webkitdirectory]")?.click();
                }
            }
        });
    }, 1000);

    console.groupEnd();

    return {
        success: true,
        button: newBtnClone,
        menu: newDropdown,
        timestamp: new Date().toISOString(),
    };
}

// 执行创建
console.log("🔧 正在创建替代下拉菜单系统...");
const result = createAlternativeDropdownSystem();

if (result.success) {
    console.log("🎉 创建成功！请测试：");
    console.log('1. 点击工具栏中的"新建"按钮');
    console.log('2. 选择"上传文件"或"上传文件夹"');
    console.log("3. 使用快捷键 Alt+F / Alt+D");
} else {
    console.error("❌ 创建失败");
}

// 备用方案：直接添加上传按钮
function addDirectUploadButtons() {
    const container = document.createElement("div");
    container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

    container.innerHTML = `
    <button id="direct-upload-file" style="
      background: #167df0;
      color: white;
      border: none;
      border-radius: 50px;
      padding: 12px 20px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: bold;
    ">
      <i class="mdi mdi-file-upload-outline" style="font-size: 18px;"></i>
      上传文件
    </button>

    <button id="direct-upload-dir" style="
      background: white;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 50px;
      padding: 12px 20px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: bold;
    ">
      <i class="mdi mdi-folder-upload" style="font-size: 18px;"></i>
      上传文件夹
    </button>
  `;

    document.body.appendChild(container);

    // 事件绑定
    document
        .getElementById("direct-upload-file")
        .addEventListener("click", () => {
            document.querySelector('input[type="file"]')?.click();
        });

    document
        .getElementById("direct-upload-dir")
        .addEventListener("click", () => {
            document.querySelector("input[webkitdirectory]")?.click();
        });

    console.log("✅ 直接上传按钮已添加到页面右下角");
}

// 如果需要更简单的方案，运行：
// addDirectUploadButtons();
