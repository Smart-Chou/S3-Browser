# S3 浏览器

一个轻量级、自托管的 Web UI，通过一个小型 Go HTTP 代理浏览和管理 **S3 兼容**存储桶。

服务器使用 AWS Signature V4 对 S3 请求进行签名，并将其转发到您的 S3 端点，同时提供一个简约的前端 UI。

---

## 功能特性

- 浏览存储桶内容（支持文件夹/前缀）
- 在浏览器中预览文件（取决于前端能力）
- 下载对象（支持 `Range` 请求）
- 上传对象（`PUT`）
- 重命名/移动文件和文件夹（通过复制 + 删除实现）
- 删除文件和文件夹（前缀删除）
- 用于列表和统计的 JSON 端点
- 健康检查端点（`/healthz`）
- 适用于任何 **S3 兼容** 端点

---

## 要求

- 一个 S3 兼容端点
- 具有目标存储桶权限的访问密钥/秘密密钥
- Docker（推荐）或 Go 工具链（可选）

---

## 配置

服务器通过环境变量配置：

| 变量                   | 必需 | 描述                     | 示例             |
| ---------------------- | :--: | ------------------------ | ---------------- |
| `S3_ENDPOINT`          |  ✅  | S3 端点的基础 URL        | `http://s3:9000` |
| `S3_REGION`            |  ✅  | 用于 SigV4 签名的区域    | `us-east-1`      |
| `S3_ACCESS_KEY_ID`     |  ✅  | 访问密钥 ID              | `AKIA...`        |
| `S3_SECRET_ACCESS_KEY` |  ✅  | 秘密访问密钥             | `...`            |
| `S3_BUCKET`            |  ✅  | 存储桶名称               | `my-bucket`      |
| `PORT`                 |  ❌  | 监听端口（默认：`8080`） | `8080`           |

---

## 使用 Docker 运行

### 构建并运行

```bash
docker build -t s3-browser .
docker run --rm -p 8080:8080 \
  -e S3_ENDPOINT="http://YOUR_S3_ENDPOINT:9000" \
  -e S3_REGION="us-east-1" \
  -e S3_ACCESS_KEY_ID="YOUR_KEY_ID" \
  -e S3_SECRET_ACCESS_KEY="YOUR_KEY_SECRET" \
  -e S3_BUCKET="my-bucket" \
  s3-browser
```

打开：`http://localhost:8080/`

---

## API

### 前端 API 端点

Web UI 使用以下 JSON 端点：

- `GET /api/list?prefix=...&delimiter=/&max=...&continuationToken=...`
  返回指定前缀下的对象和公共前缀（文件夹）的分页列表。
- `GET /api/stats?prefix=...`
  返回指定前缀下对象的统计信息（总大小和数量）。
- `POST /api/rename`
  重命名（移动）对象或前缀到新键。
  请求体：`{"oldKey":"...","newKey":"..."}`
- `POST /api/delete-prefix`
  删除对象或前缀下的所有对象。
  请求体：`{"prefix":"..."}`

### S3 代理端点

服务器作为到已配置 S3 端点的透明代理。所有对 `/s3*` 的请求都使用 AWS Signature V4 进行转发。

- `GET|HEAD /s3`
  列出存储桶（返回原始 S3 XML `ListBucketResult`）。
  查询参数：`prefix`, `delimiter`, `max-keys`, `continuation-token` 等。
- `GET|HEAD /s3/<key>`
  检索对象。支持 `Range` 头部用于部分下载。
- `PUT /s3/<key>`
  上传对象。请求体直接流式传输到 S3。
- `DELETE /s3/<key>`
  删除对象。

这些端点保留 S3 语义和头部（ETag、Content‑Type、Content‑Length 等）。

### 健康检查

- `GET /healthz`
  如果服务器可以连接到配置的 S3 端点，则返回 `200 OK`。

### CORS

服务器为所有端点设置 `Access-Control-Allow-Origin: *` 和适当的 CORS 头部。
支持所有方法的预检请求（`OPTIONS`）。

---

## 版本发布

二进制版本在 GitHub Releases 中发布。

每个版本提供以下平台的二进制文件：

- Linux (amd64, arm64)
- macOS (amd64, arm64)
- Windows (amd64, arm64)

---

## 开发

### 项目结构

```text
src/
  main.go          # 服务器主入口
  go.mod           # Go 模块定义
  public/          # 前端静态资源（HTML、CSS、JS）
  .goreleaser.yaml # 发布配置
test/
  docker-compose.yaml # 本地 S3 栈（使用 Garage）
  garage/          # Garage S3 服务器配置
  Dockerfile       # 测试环境镜像
.github/workflows/
  release.yaml     # CI/CD 发布配置
```

### 本地运行（需要 Go）

```bash
cd src
go run .
```

服务器将启动在 `http://localhost:8080`（或通过 `PORT` 环境变量定义的端口）。

### 构建二进制文件

构建独立的二进制文件：

```bash
cd src
go build -o s3-browser .
```

二进制文件包含嵌入式前端资源。

### 使用 GoReleaser 发布

项目使用 [GoReleaser](https://goreleaser.com) 创建跨平台发布。配置文件位于 `src/.goreleaser.yaml`。

本地创建发布（需要安装 GoReleaser）：

```bash
cd src
goreleaser release --snapshot --clean
```

CI 在推送 Git 标签 `v*` 时自动构建和发布版本。

---

## 测试（本地环境）

`test/` 目录下提供了一个本地测试环境，使用 **Garage** 作为 S3 兼容后端。

从仓库根目录：

```bash
cd test
docker compose up --build
```

然后打开：`http://localhost:8080/`

---

## 安全注意事项

- 服务器使用您的凭据对请求进行签名：请妥善保管。
- 如果公开暴露，请在具有身份验证的反向代理后运行。
- 为简化起见启用了 CORS（`Access-Control-Allow-Origin: *`）。
