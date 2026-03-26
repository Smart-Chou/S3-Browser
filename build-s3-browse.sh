#!/usr/bin/env bash
set -euo pipefail

# 构建 s3-browse 服务的 Docker 镜像
# 用法: ./build-s3-browse.sh [标签] [额外 docker build 参数...]
# 示例: ./build-s3-browse.sh v1.0 --no-cache

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 默认标签
TAG="${1:-s3-browser:latest}"
shift || true

# 检查 Docker 是否可用
if ! command -v docker &> /dev/null; then
    echo "错误: 未找到 docker 命令" >&2
    exit 1
fi

# 使用 docker-compose 构建 s3-browse 服务
# 这将使用 test/docker-compose.yaml 中的配置
echo "正在构建镜像，标签: $TAG"
if docker-compose -f test/docker-compose.yaml build --pull "$@" s3-browse; then
    # 重新标记镜像（如果需要）
    if [ "$TAG" != "s3-browser:latest" ]; then
        echo "重新标记镜像为: $TAG"
        docker tag s3-browser:latest "$TAG"
    fi
    echo "构建成功!"
    echo "镜像列表:"
    docker images | grep -E "(s3-browser|$TAG)"
else
    echo "构建失败!" >&2
    exit 1
fi