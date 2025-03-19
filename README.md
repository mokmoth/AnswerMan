# 通义千问API集成项目

这个项目展示了如何将阿里云通义千问大语言模型API集成到应用中，提供了多种测试脚本和一个可复用的服务模块。

## 功能特性

- 支持标准模式和OpenAI兼容模式
- 支持流式输出（SSE）
- 支持聊天历史记录
- 支持多模态输入（文本+图像+视频）
- 支持视频理解和多轮对话
- 提供完整的错误处理
- 包含React组件示例

## 文件说明

- `qwenai_test.js` - 基本的通义千问API测试脚本
- `qwenai_openai_compatible_test.js` - OpenAI兼容模式测试脚本
- `qwenai_stream_test.js` - 流式输出测试脚本
- `qwenai_advanced_test.js` - 高级功能测试脚本（包含多模态、历史记录等）
- `qwenai_debug.js` - API响应调试脚本
- `qwenai_service_test.js` - 服务模块测试脚本
- `qwenai_video_test.js` - **视频理解功能测试脚本**
- `src/services/qwenai_service.js` - 可集成到应用中的服务模块
- `src/components/QwenAIChat.js` - React聊天组件示例
- `src/components/QwenVideoChat.js` - **React视频理解对话组件示例**

## 使用方法

### 环境配置

1. 确保已安装Node.js环境
2. 在项目根目录创建`.env`文件，添加API密钥：
   ```
   REACT_APP_DASHSCOPE_API_KEY=你的通义千问API密钥
   ```

### 运行测试脚本

```bash
# 基本测试
node qwenai_test.js

# OpenAI兼容模式测试
node qwenai_openai_compatible_test.js

# 流式输出测试
node qwenai_stream_test.js

# 高级功能测试
node qwenai_advanced_test.js

# 服务模块测试
node qwenai_service_test.js

# 视频理解功能测试
node qwenai_video_test.js
```

### 视频理解功能使用

视频理解功能允许您上传视频并使用通义千问对视频内容进行分析和问答。您可以：

1. 使用命令行工具测试视频理解：
   ```bash
   node qwenai_video_test.js
   
   # 在交互式界面中使用以下命令
   # 本地视频测试
   local <视频路径> <问题>
   
   # 远程视频URL测试
   remote <视频URL> <问题>
   ```

2. 在React应用中集成视频理解组件：
   ```javascript
   import { QwenVideoChat } from './components/QwenVideoChat';
   
   function App() {
     return (
       <div className="App">
         <QwenVideoChat />
       </div>
     );
   }
   ```

### 在React应用中使用

1. 将`src/services/qwenai_service.js`添加到你的项目中
2. 在组件中导入服务：
   ```javascript
   import { qwenAIService } from '../services/qwenai_service';
   ```
3. 初始化服务：
   ```javascript
   useEffect(() => {
     qwenAIService.init({
       apiKey: process.env.REACT_APP_DASHSCOPE_API_KEY,
       defaultModel: 'qwen-plus',
       useCompatibleMode: false
     });
   }, []);
   ```
4. 发送请求：
   ```javascript
   // 普通请求
   const response = await qwenAIService.chat('你好，请介绍一下自己');
   console.log(response.text);
   
   // 流式请求
   await qwenAIService.chat('你好，请介绍一下自己', {
     stream: true,
     onChunk: (chunk) => {
       console.log(chunk);
     }
   });
   
   // 视频理解请求
   const videoBase64 = await qwenAIService.videoToBase64(videoFile);
   const response = await qwenAIService.understandVideo(
     videoBase64,
     '这个视频展示了什么?',
     { model: 'qwen-vl-max' }
   );
   console.log(response.text);
   ```

## 支持的模型

### 文本模型
- qwen-turbo - 通义千问-Turbo
- qwen-plus - 通义千问-Plus
- qwen-max - 通义千问-Max
- qwen2.5-72b-instruct - 通义千问2.5-72B

### 多模态模型
- qwen-vl-plus - 通义千问VL-Plus
- qwen-vl-max - 通义千问VL-Max
- qwen2.5-vl-72b-instruct - 通义千问2.5-VL-72B

## 视频理解功能说明

通义千问VL模型支持对视频内容进行理解和分析。使用视频理解功能时，需要注意以下限制：

- 视频文件大小：Qwen2.5-VL模型支持的视频大小不超过500MB，其他模型不超过150MB
- 视频文件格式：MP4、AVI、MKV、MOV、FLV、WMV等常见格式
- 视频时长：Qwen2.5-VL模型支持的视频时长为2秒至10分钟，其他模型为2秒至40秒
- 视频尺寸：无限制，但视频文件会被调整到约600k像素数
- 当前暂不支持对视频文件的音频进行理解

视频理解功能目前需要申请后才能使用，请先提交工单申请权限。

## 注意事项

- 使用多模态模型时，需要确保图片格式正确（支持base64编码或URL）
- 流式输出在React应用中需要特殊处理，参考`QwenAIChat.js`组件
- 历史记录会占用上下文窗口，建议定期清理或限制长度
- 视频文件处理需要较长时间，推荐使用较小的视频文件进行测试

## 参考资料

- [通义千问API文档](https://help.aliyun.com/document_detail/2400395.html)
- [通义千问VL视频理解功能文档](https://help.aliyun.com/zh/model-studio/developer-reference/qwenvl-video-understanding)
- [DashScope开发者平台](https://dashscope.aliyun.com/)

# AnswerMan - 智能视频理解助手

AnswerMan是一个基于React的Web应用，利用千问大语言模型提供视频理解能力，帮助用户更好地理解视频内容。

## 功能特点

- 视频上传和处理
- 视频帧提取分析
- 字幕文件上传和解析
- 基于视频内容的智能问答
- 图片上传辅助问答

## 项目结构

```
answerman/
├── docs/             # 文档文件
├── public/           # 静态资源
├── scripts/          # 脚本文件
│   ├── proxy-server.js    # API代理服务器
│   └── start-answerman.sh # 启动脚本
├── src/              # 源代码
│   ├── components/   # 组件
│   │   ├── Logger/   # 日志组件
│   │   └── VideoUnderstanding.js # 视频理解主组件
│   ├── services/     # 服务
│   │   ├── logService.js      # 日志服务
│   │   └── qwenai_service.js  # 千问API服务
│   ├── utils/        # 工具
│   │   └── subtitleParser.js  # 字幕解析工具
│   ├── App.js        # 应用入口
│   └── index.js      # React入口
└── tests/            # 测试文件
```

## 环境要求

- Node.js 16+
- npm 7+

## 环境变量

创建一个`.env`文件在项目根目录，包含以下内容：

```
DASHSCOPE_API_KEY=您的千问API密钥
REACT_APP_PROXY_URL=http://localhost:8766
```

## 安装和运行

1. 克隆仓库
```bash
git clone https://github.com/yourusername/answerman.git
cd answerman
```

2. 安装依赖
```bash
npm install
```

3. 启动应用
```bash
bash scripts/start-answerman.sh
```

或者分别启动：

```bash
# 启动代理服务器
node scripts/proxy-server.js

# 启动前端应用
npm start
```

应用将在 http://localhost:3000 运行。

## GitHub部署

本项目已配置好Git版本控制，并已排除不必要的文件和目录（如node_modules、日志、缓存等）。要将项目部署到GitHub：

1. 在GitHub上创建一个新的仓库

2. 关联本地仓库与远程仓库
```bash
git remote add origin https://github.com/yourusername/answerman.git
```

3. 推送代码到GitHub
```bash
git push -u origin main
```

4. 后续代码更新
```bash
git add .
git commit -m "描述更新内容"
git push
```

## 代码贡献

1. Fork本仓库
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个Pull Request

## 配置

`answerman.config` 文件包含以下配置项：

```
# 应用配置
APP_PORT=3000
NODE_ENV=development

# 代理服务器配置
PROXY_PORT=8766
PROXY_TIMEOUT=60000
PROXY_MAX_BODY_SIZE=50mb
```

## 许可证

MIT 