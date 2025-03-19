const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 环境变量配置
const PORT = process.env.PROXY_PORT || 8766;
const TIMEOUT = parseInt(process.env.PROXY_TIMEOUT || '30000');
const MAX_BODY_SIZE = process.env.PROXY_MAX_BODY_SIZE || '50mb';

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: MAX_BODY_SIZE }));
app.use(bodyParser.urlencoded({ extended: true, limit: MAX_BODY_SIZE }));

// 调试中间件
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
        console.log('响应数据:', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
        originalSend.apply(res, arguments);
    };
    next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('请求处理错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 状态检查端点
app.get('/status', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 代理请求处理
app.post('/proxy', async (req, res) => {
    const targetUrl = req.body.url || req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: '缺少目标URL参数' });
    }

    const requestData = req.body.data || {};
    const headers = {
        'Content-Type': 'application/json',
        ...req.body.headers
    };

    // 打印详细的请求信息
    console.log('\n=== 代理请求详情 ===');
    console.log(`时间: ${new Date().toISOString()}`);
    console.log(`方法: ${req.method}`);
    console.log(`目标URL: ${targetUrl}`);
    console.log('请求头:', JSON.stringify(headers, null, 2));
    console.log('请求体大小:', JSON.stringify(req.body).length, '字节');
    console.log('请求体data大小:', requestData ? JSON.stringify(requestData).length : 0, '字节');
    
    // 验证请求数据
    if (!requestData || Object.keys(requestData).length === 0) {
        console.error('请求数据为空或缺失');
        return res.status(400).json({ 
            error: '请求数据为空或缺失',
            proxyMessage: '请求体必须包含data字段，且不能为空'
        });
    }
    
    // 如果是通义千问API，检查请求格式并进行特殊处理
    if (targetUrl.includes('dashscope.aliyuncs.com')) {
        console.log('\n=== 通义千问请求详情 ===');
        
        // 兼容模式格式检查
        if (targetUrl.includes('compatible-mode')) {
            if (!requestData.messages) {
                console.error('缺少必要的messages字段');
                return res.status(400).json({
                    error: 'messages字段缺失',
                    proxyMessage: '请求体必须包含messages字段'
                });
            }
            
            console.log(`消息数量: ${requestData.messages.length}`);
            
            // 检查系统消息
            const systemMsg = requestData.messages.find(m => m.role === 'system');
            console.log('系统消息:', systemMsg?.content || '无系统消息');
            
            // 检查用户消息
            const userMessages = requestData.messages.filter(m => m.role === 'user');
            console.log(`用户消息数量: ${userMessages.length}`);
            
            if (userMessages.length === 0) {
                console.error('缺少用户消息');
                return res.status(400).json({
                    error: '用户消息缺失',
                    proxyMessage: '请求中必须包含至少一条用户消息'
                });
            }
            
            // 检查多模态内容
            userMessages.forEach((msg, idx) => {
                if (Array.isArray(msg.content)) {
                    console.log(`用户消息 ${idx + 1} 包含多模态内容:`);
                    const hasMultiModalContent = msg.content.some(item => item.type !== 'text');
                    
                    msg.content.forEach(item => {
                        if (item.type === 'text') {
                            console.log(`- 文本: ${item.text.slice(0, 100)}${item.text.length > 100 ? '...' : ''}`);
                        } else if (item.type === 'image_url') {
                            console.log(`- 图片URL: ${typeof item.image_url === 'object' ? '对象格式' : '字符串格式'}, 长度: ${
                                typeof item.image_url === 'object' ? 
                                (item.image_url.url ? item.image_url.url.length : 'url缺失') : 
                                item.image_url ? item.image_url.length : 'undefined'
                            }`);
                        } else if (item.type === 'image') {
                            console.log(`- Base64图片长度: ${item.image ? item.image.length : 'undefined'}`);
                        } else if (item.type === 'video') {
                            const videoFrames = Array.isArray(item.video) ? item.video.length : (item.video ? 1 : 0);
                            console.log(`- 视频帧数: ${videoFrames}`);
                        }
                    });
                    
                    if (!hasMultiModalContent) {
                        console.warn('警告: 用户消息content为数组，但不包含多模态内容');
                    }
                } else {
                    // 纯文本消息
                    const textContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                    console.log(`用户消息 ${idx + 1} (纯文本): ${textContent.slice(0, 100)}${textContent.length > 100 ? '...' : ''}`);
                }
            });
        } 
        // 原生格式检查
        else {
            if (!requestData.input || !requestData.input.messages) {
                console.error('缺少必要的input.messages字段');
                return res.status(400).json({
                    error: 'input.messages字段缺失',
                    proxyMessage: '通义千问原生格式请求必须包含input.messages字段'
                });
            }
            
            console.log(`消息数量: ${requestData.input.messages.length}`);
            
            // 检查消息内容
            requestData.input.messages.forEach((msg, idx) => {
                console.log(`消息 ${idx + 1}: 角色=${msg.role}`);
                
                if (Array.isArray(msg.content)) {
                    console.log(` - 多模态内容，${msg.content.length}个元素`);
                    
                    let hasText = false;
                    let imageCount = 0;
                    
                    msg.content.forEach(item => {
                        if (item.type === 'text') {
                            hasText = true;
                            console.log(`  - 文本: ${item.text.slice(0, 100)}${item.text.length > 100 ? '...' : ''}`);
                        } else if (item.type === 'image') {
                            imageCount++;
                            console.log(`  - 图片 ${imageCount}: 大小 ${item.image ? Math.round(item.image.length / 1024) : 0}KB`);
                        }
                    });
                    
                    if (!hasText && imageCount > 0) {
                        console.log('  - 警告: 包含图片但没有文本');
                    }
                } else {
                    const textContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                    console.log(` - 纯文本: ${textContent.slice(0, 100)}${textContent.length > 100 ? '...' : ''}`);
                }
            });
        }
    }

    try {
        // 发送请求前添加日志
        console.log(`\n=== 发送代理请求 ===`);
        console.log(`目标URL: ${targetUrl}`);
        console.log(`请求方法: ${req.method}`);
        console.log(`请求数据大小: ${JSON.stringify(requestData).length}字节`);
        
        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: headers,
            data: requestData,
            timeout: TIMEOUT,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        console.log('\n=== 响应详情 ===');
        console.log(`状态码: ${response.status}`);
        console.log(`响应头: ${JSON.stringify(response.headers)}`);

        // 处理流式响应
        if (response.headers['content-type']?.includes('stream')) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            response.data.on('data', (chunk) => {
                console.log('流式响应片段:', chunk.toString());
                res.write(chunk);
            });

            response.data.on('end', () => {
                console.log('流式响应结束');
                res.end();
            });
        } else {
            if (process.env.NODE_ENV === 'development') {
                console.log('响应体:', JSON.stringify(response.data, null, 2));
            } else {
                console.log(`响应体大小: ${JSON.stringify(response.data).length}字节`);
            }
            res.status(response.status).json(response.data);
        }
    } catch (error) {
        console.error('\n=== 错误详情 ===');
        console.error('代理请求失败:', error.message);
        
        if (process.env.NODE_ENV === 'development') {
            console.error('错误堆栈:', error.stack);
        }
        
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应头:', JSON.stringify(error.response.headers));
            console.error('响应数据:', typeof error.response.data === 'string' ? 
                error.response.data : JSON.stringify(error.response.data));
        }
        
        // 发送详细的错误信息
        const errorResponse = {
            error: '代理请求失败',
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message,
            details: error.response?.data,
            timestamp: new Date().toISOString()
        };

        res.status(error.response?.status || 500).json(errorResponse);
    }
});

// WebSocket 连接处理
wss.on('connection', (ws) => {
    console.log('WebSocket 客户端已连接');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('收到 WebSocket 消息:', data);
            
            // 处理消息并发送响应
            ws.send(JSON.stringify({ status: 'received', data }));
        } catch (error) {
            console.error('WebSocket 消息处理错误:', error);
            ws.send(JSON.stringify({ error: '消息处理失败' }));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket 客户端已断开');
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`\n=== API代理服务器启动 ===`);
    console.log(`时间: ${new Date().toISOString()}`);
    console.log(`地址: http://localhost:${PORT}`);
    console.log('\n支持的端点:');
    console.log('- GET /status - 检查服务器状态');
    console.log('- POST /proxy - 代理API请求');
    console.log(`- WS ws://localhost:${PORT} - WebSocket 连接`);
    console.log(`\n配置信息:`);
    console.log(`- 最大请求体积限制: ${MAX_BODY_SIZE}`);
    console.log(`- 请求超时时间: ${TIMEOUT}ms`);
    console.log(`- 运行模式: ${process.env.NODE_ENV || 'production'}`);
    console.log('\n等待请求中...\n');
}); 