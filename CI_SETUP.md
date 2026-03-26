# GitHub Actions 自动化构建设置

本指南介绍如何设置 GitHub Actions 来自动构建和发布 Docker 镜像。

## 目录

- [工作原理](#工作原理)
- [自动触发条件](#自动触发条件)
- [配置 Secrets](#配置-secrets)
- [自定义配置](#自定义配置)
- [使用构建的镜像](#使用构建的镜像)

## 工作原理

GitHub Actions workflow (`.github/workflows/docker-build.yml`) 会在以下情况自动运行：

1. **构建和测试**：推送到 `main` 分支或创建 Pull Request 时
2. **构建和发布**：推送标签（如 `v1.0.0`）时
3. **手动触发**：通过 GitHub 界面手动触发

工作流会：

- 构建支持多架构（amd64, arm64）的 Docker 镜像
- 运行简单测试验证镜像功能
- 发布镜像到 GitHub Container Registry (GHCR)

## 自动触发条件

| 事件               | 动作               | 镜像推送 |
| ------------------ | ------------------ | -------- |
| 推送到 `main` 分支 | 构建 + 测试        | 否       |
| 创建 Pull Request  | 构建 + 测试        | 否       |
| 推送标签 `v*`      | 构建 + 测试 + 发布 | 是       |
| 手动触发           | 构建 + 测试 + 发布 | 是       |

## 配置 Secrets

### 1. GitHub Container Registry (默认)

GitHub Actions 默认使用 `secrets.GITHUB_TOKEN` 登录 GHCR，无需额外配置。

### 2. Docker Hub (可选)

如需同时发布到 Docker Hub：

1. 在 Docker Hub 创建账号（如需要）
2. 在 GitHub 仓库设置中添加 Secrets：
    - `DOCKERHUB_USERNAME`：Docker Hub 用户名
    - `DOCKERHUB_TOKEN`：Docker Hub 访问令牌

3. 在 workflow 文件中取消注释 Docker Hub 登录部分：

```yaml
- name: Log in to Docker Hub (可选)
  if: github.event_name != 'pull_request'
  uses: docker/login-action@v3
  with:
      registry: docker.io
      username: ${{ secrets.DOCKERHUB_USERNAME }}
      password: ${{ secrets.DOCKERHUB_TOKEN }}
```

4. 在 metadata 部分添加 Docker Hub 镜像名称：

```yaml
images: |
    ${{ env.REGISTRY }}/$(echo "${{ github.repository }}" | tr '[:upper:]' '[:lower:]')/s3-browser
    docker.io/yourusername/s3-browser
```

## 自定义配置

### 修改镜像名称

镜像名称在 `Calculate image name` 步骤中自动计算为小写格式。如果需要自定义镜像名称，修改该步骤中的 `FULL_IMAGE_NAME` 变量：

```yaml
- name: Calculate image name
  id: image-name
  run: |
      # 自定义镜像名称（确保使用小写）
      FULL_IMAGE_NAME="custom-username/s3-browser"
      echo "lowercase_name=${FULL_IMAGE_NAME}" >> $GITHUB_OUTPUT
      echo "Calculated image name: ${FULL_IMAGE_NAME}"
```

### 添加更多架构支持

修改 `platforms` 参数：

```yaml
platforms: linux/amd64,linux/arm64,linux/arm/v7
```

### 添加构建参数

在 `build-push-action` 中添加 `build-args`：

```yaml
build-args: |
    GO_VERSION=1.25.0
    BUILD_DATE=${{ github.event.head_commit.timestamp }}
```

## 使用构建的镜像

### 从 GitHub Container Registry 拉取

```bash
# 使用最新标签
docker pull ghcr.io/<owner>/<repo>/s3-browser:latest

# 使用特定版本标签
docker pull ghcr.io/<owner>/<repo>/s3-browser:v1.0.0

# 使用 commit SHA
docker pull ghcr.io/<owner>/<repo>/s3-browser:sha-abc123
```

### 运行容器

```bash
docker run -d \
  -e S3_ENDPOINT="http://your-s3-endpoint" \
  -e S3_REGION="your-region" \
  -e S3_ACCESS_KEY_ID="your-access-key" \
  -e S3_SECRET_ACCESS_KEY="your-secret-key" \
  -e S3_BUCKET="your-bucket" \
  -p 8080:8080 \
  ghcr.io/<owner>/<repo>/s3-browser:latest
```

### 查看可用标签

访问 `https://ghcr.io/<owner>/<repo>/s3-browser/tags`

## 故障排除

### 权限问题

确保仓库设置中已启用以下权限：

- `packages: write`（用于推送镜像到 GHCR）
- `contents: read`（用于检出代码）

### 构建失败

1. **Dockerfile 路径错误**：确认 `./test/Dockerfile` 路径正确
2. **上下文路径错误**：确认构建上下文 `.` 包含所有必要文件
3. **多架构构建失败**：尝试只构建单架构进行调试

### 测试失败

1. **健康检查超时**：增加 `sleep` 时间
2. **端口冲突**：确保测试使用的端口 8080 可用

## 手动触发 workflow

1. 访问 GitHub 仓库的 "Actions" 标签页
2. 选择 "Build and Publish Docker Image" workflow
3. 点击 "Run workflow" 按钮
4. 选择分支并运行

## 更多资源

- [GitHub Actions 文档](https://docs.github.com/actions)
- [Docker Buildx 文档](https://docs.docker.com/buildx/)
- [GitHub Container Registry 文档](https://docs.github.com/packages/guides/about-github-container-registry)
