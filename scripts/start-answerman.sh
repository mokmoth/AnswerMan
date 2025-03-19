#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$PROJECT_DIR"

# 加载配置文件
if [ -f "$PROJECT_DIR/answerman.config" ]; then
    source "$PROJECT_DIR/answerman.config"
else
    echo -e "${RED}错误: 未找到配置文件 answerman.config${NC}"
    exit 1
fi

# 检查必需的命令是否可用
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误: 未找到命令 '$1'${NC}"
        echo "请先安装必需的依赖"
        exit 1
    fi
}

check_command "node"
check_command "npm"

# 检查端口是否被占用
check_port() {
    if lsof -i:$1 > /dev/null; then
        return 1
    fi
    return 0
}

# 检查环境变量
check_env() {
    local missing_vars=()
    
    # 检查必需的环境变量
    if [ -z "$DASHSCOPE_API_KEY" ]; then
        missing_vars+=("DASHSCOPE_API_KEY")
    fi
    
    if [ -z "$REACT_APP_PROXY_URL" ]; then
        missing_vars+=("REACT_APP_PROXY_URL")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}错误: 以下必需的环境变量未设置:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        return 1
    fi
    
    return 0
}

# 启动代理服务器
start_proxy_server() {
    echo -e "${YELLOW}正在启动API代理服务器...${NC}"
    if ! check_port $PROXY_PORT; then
        echo -e "${RED}警告: 端口 $PROXY_PORT 已被占用${NC}"
        echo "尝试关闭已存在的代理服务器..."
        kill $(lsof -t -i:$PROXY_PORT) 2>/dev/null
        sleep 2
    fi
    
    # 检查proxy-server.js是否存在
    if [ ! -f "$PROJECT_DIR/scripts/proxy-server.js" ]; then
        echo -e "${RED}错误: 未找到proxy-server.js${NC}"
        return 1
    fi
    
    # 启动代理服务器时传入环境变量
    PROXY_PORT=$PROXY_PORT \
    PROXY_TIMEOUT=$PROXY_TIMEOUT \
    PROXY_MAX_BODY_SIZE=$PROXY_MAX_BODY_SIZE \
    node "$PROJECT_DIR/scripts/proxy-server.js" &
    PROXY_PID=$!
    echo $PROXY_PID > "$PROJECT_DIR/.proxy.pid"
    
    # 等待代理服务器启动
    for i in {1..10}; do
        if curl -s http://localhost:$PROXY_PORT/status > /dev/null; then
            echo -e "${GREEN}API代理服务器已启动 (PID: $PROXY_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}错误: API代理服务器启动失败${NC}"
    return 1
}

# 启动主应用
start_main_app() {
    echo -e "${YELLOW}正在启动 AnswerMan...${NC}"
    
    # 检查环境变量
    if ! check_env; then
        return 1
    fi
    
    if ! check_port $APP_PORT; then
        echo -e "${RED}警告: 端口 $APP_PORT 已被占用${NC}"
        echo "尝试关闭已存在的应用实例..."
        kill $(lsof -t -i:$APP_PORT) 2>/dev/null
        sleep 2
    fi
    
    # 检查package.json是否存在
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        echo -e "${RED}错误: 未找到package.json${NC}"
        return 1
    fi
    
    # 检查是否需要安装依赖
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        echo -e "${YELLOW}正在安装项目依赖...${NC}"
        cd "$PROJECT_DIR" && npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}错误: 依赖安装失败${NC}"
            return 1
        fi
    fi
    
    # 启动应用，同时传递所有环境变量
    echo -e "${YELLOW}正在以 $NODE_ENV 模式启动应用...${NC}"
    cd "$PROJECT_DIR" && \
    REACT_APP_PROXY_URL=$REACT_APP_PROXY_URL \
    DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY \
    npm start &
    APP_PID=$!
    echo $APP_PID > "$PROJECT_DIR/.app.pid"
    
    # 等待应用启动
    for i in {1..20}; do
        if curl -s http://localhost:$APP_PORT > /dev/null; then
            echo -e "${GREEN}AnswerMan 已启动 (PID: $APP_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}错误: AnswerMan 启动失败${NC}"
    return 1
}

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在关闭服务...${NC}"
    if [ -f "$PROJECT_DIR/.proxy.pid" ]; then
        kill $(cat "$PROJECT_DIR/.proxy.pid") 2>/dev/null
        rm "$PROJECT_DIR/.proxy.pid"
    fi
    if [ -f "$PROJECT_DIR/.app.pid" ]; then
        kill $(cat "$PROJECT_DIR/.app.pid") 2>/dev/null
        rm "$PROJECT_DIR/.app.pid"
    fi
    echo -e "${GREEN}所有服务已关闭${NC}"
    exit 0
}

# 注册清理函数
trap cleanup SIGINT SIGTERM

# 主程序
echo -e "${GREEN}启动 AnswerMan 服务...${NC}"
echo "项目目录: $PROJECT_DIR"

# 启动服务
start_proxy_server
if [ $? -ne 0 ]; then
    cleanup
    exit 1
fi

start_main_app
if [ $? -ne 0 ]; then
    cleanup
    exit 1
fi

echo -e "\n${GREEN}所有服务已成功启动!${NC}"
echo -e "API代理服务器: http://localhost:$PROXY_PORT"
echo -e "AnswerMan: http://localhost:$APP_PORT"
echo -e "\n${YELLOW}按 Ctrl+C 可以安全关闭所有服务${NC}"

# 保持脚本运行
wait 