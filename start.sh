#!/usr/bin/env bash
# Claudio AI Radio — 一键启动脚本
# 先关闭旧进程，再启动 NCM API (port 3000) + 后端 (port 8080) + 前端 (port 5173)

set -e
cd "$(dirname "$0")"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ── 清理旧进程 ──
echo -e "${YELLOW}[start] 检查并关闭已有服务...${NC}"

for PORT in 3000 8080 5173; do
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}[start]   关闭端口 $PORT 上的进程: $PIDS${NC}"
        kill $PIDS 2>/dev/null || true
        sleep 0.5
    fi
done

# 确认端口已释放
for PORT in 3000 8080 5173; do
    if lsof -ti :"$PORT" >/dev/null 2>&1; then
        echo -e "${RED}[start] 端口 $PORT 仍被占用，强制 kill...${NC}"
        kill -9 $(lsof -ti :"$PORT") 2>/dev/null || true
        sleep 0.5
    fi
done

echo -e "${GREEN}[start] 旧进程已清理${NC}"

# ── 退出时清理 ──
cleanup() {
    echo -e "\n${YELLOW}[start] 正在停止所有服务...${NC}"
    kill $NCM_PID $DEV_PID 2>/dev/null
    wait $NCM_PID $DEV_PID 2>/dev/null
    echo -e "${GREEN}[start] 已停止${NC}"
}
trap cleanup EXIT INT TERM

# ── 检查依赖 ──
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[start] 首次运行，安装依赖...${NC}"
    pnpm install
fi

# ── 启动 NCM API 服务 (网易云音乐代理) ──
echo -e "${GREEN}[start] 启动 NCM API 服务 (port 3000)...${NC}"
node apps/server/ncm-server.mjs &
NCM_PID=$!

# 等 NCM 就绪
for i in $(seq 1 15); do
    if curl -sf http://localhost:3000/search?keywords=test > /dev/null 2>&1; then
        echo -e "${GREEN}[start] NCM API 已就绪${NC}"
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo -e "${RED}[start] NCM API 启动超时，请检查端口 3000${NC}"
        exit 1
    fi
    sleep 1
done

# ── 启动前端 + 后端 dev server ──
echo -e "${GREEN}[start] 启动前后端开发服务...${NC}"
pnpm dev &
DEV_PID=$!

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Claudio AI Radio 已启动${NC}"
echo -e "${GREEN}  后端 API:  http://localhost:8080${NC}"
echo -e "${GREEN}  前端页面:  http://localhost:5173${NC}"
echo -e "${GREEN}  NCM 代理:  http://localhost:3000${NC}"
echo -e "${GREEN}  按 Ctrl+C 停止所有服务${NC}"
echo -e "${GREEN}========================================${NC}"

wait
