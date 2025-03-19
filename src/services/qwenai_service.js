/**
 * 通义千问API服务模块
 * 提供通义千问API的集成功能，包括文本生成、多模态理解和流式输出
 */

import axios from 'axios';

// API端点
const API_ENDPOINTS = {
  // 兼容OpenAI格式的接口
  COMPATIBLE: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  // 纯文本生成接口
  TEXT: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  // 多模态生成接口
  MULTIMODAL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
};

// 支持的模型
export const QWEN_MODELS = {
  // 文本模型
  TEXT: {
    'qwen-turbo': '通义千问-Turbo',
    'qwen-plus': '通义千问-Plus',
    'qwen-max': '通义千问-Max',
    'qwen2.5-72b-instruct': '通义千问2.5-72B'
  },
  // 多模态模型
  MULTIMODAL: {
    'qwen-vl-plus': '通义千问VL-Plus',
    'qwen-vl-max': '通义千问VL-Max',
    'qwen2.5-vl-72b-instruct': '通义千问2.5-VL-72B'
  },
  // 全模态（Omni）模型
  OMNI: {
    'qwen-omni-turbo': '通义千问Omni-Turbo',
    'qwen-omni-turbo-latest': '通义千问Omni-Turbo最新版',
    'qwen-omni-turbo-2025-01-19': '通义千问Omni-Turbo-0119'
  }
};

/**
 * 通义千问API服务类
 */
class QwenAIService {
  constructor() {
    this.apiKey = null;
    this.defaultModel = 'qwen-plus';
    this.useCompatibleMode = false;
    this.systemPrompt = '你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。';
    this.chatHistory = [];
    this.subtitles = null;      // 存储视频字幕
    this.videoFrames = [];      // 存储视频截图
    this.videoMetadata = null;  // 存储视频元数据
  }

  /**
   * 初始化服务
   * @param {Object} options 配置选项
   * @returns {boolean} 初始化结果
   */
  init(options = {}) {
    try {
      this.apiKey = options.apiKey;
      if (!this.apiKey) {
        console.error('通义千问API服务初始化失败: 未提供API密钥');
        return false;
      }

      this.defaultModel = options.defaultModel || this.defaultModel;
      this.useCompatibleMode = options.useCompatibleMode || this.useCompatibleMode;
      this.systemPrompt = options.systemPrompt || this.systemPrompt;
      
      console.log(`通义千问API服务初始化成功，使用${this.useCompatibleMode ? 'OpenAI兼容' : '标准'}模式`);
      return true;
    } catch (error) {
      console.error('通义千问API服务初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查模型是否为Omni系列
   * @param {string} model 模型名称
   * @returns {boolean} 是否为Omni系列模型
   */
  isOmniModel(model) {
    return model.startsWith('qwen-omni');
  }

  /**
   * 创建系统消息
   * @param {string} content 内容
   * @returns {Object} 消息对象
   */
  createSystemMessage(content) {
    return this.useCompatibleMode
      ? { role: 'system', content: [{ type: 'text', text: content }] }
      : { role: 'system', content: [{ text: content }] };
  }

  /**
   * 创建用户文本消息
   * @param {string} content 内容
   * @returns {Object} 消息对象
   */
  createUserTextMessage(content) {
    return this.useCompatibleMode
      ? { role: 'user', content: [{ type: 'text', text: content }] }
      : { role: 'user', content: [{ text: content }] };
  }

  /**
   * 创建多模态用户消息
   * @param {string} text 文本内容
   * @param {Array<Object>} mediaObjects 媒体对象数组
   * @returns {Object} 消息对象
   */
  createMultiModalMessage(text, mediaObjects = []) {
    if (!mediaObjects || mediaObjects.length === 0) {
      return this.createUserTextMessage(text);
    }

    const content = [];
    
    // 添加媒体对象
    for (const media of mediaObjects) {
      content.push(media);
    }
    
    // 添加文本
    if (text && text.trim() !== '') {
      if (this.useCompatibleMode) {
        content.push({ type: 'text', text });
      } else {
        content.push({ text });
      }
    }
    
    return { role: 'user', content };
  }

  /**
   * 创建图片对象
   * @param {string} imageSource 图片源（URL或Base64）
   * @returns {Object} 图片对象
   */
  createImageObject(imageSource) {
    if (this.useCompatibleMode) {
      return {
        type: 'image_url',
        image_url: { url: imageSource }
      };
    } else {
      return {
        image: imageSource
      };
    }
  }

  /**
   * 创建视频对象
   * @param {string} videoSource 视频源（URL或Base64）
   * @param {boolean} isOmniModel 是否为Omni模型
   * @returns {Object} 视频对象
   */
  createVideoObject(videoSource, isOmniModel = false) {
    if (this.useCompatibleMode) {
      // 标准兼容模式 - VL模型和Omni模型都使用这种格式
      return {
        type: 'video_url',
        video_url: { url: videoSource }
      };
    } else {
      // 原生模式
      return {
        video: videoSource
      };
    }
  }

  /**
   * 创建音频对象（仅Omni模型支持）
   * @param {string} audioSource 音频源（URL或Base64）
   * @param {string} format 音频格式（如mp3, wav）
   * @returns {Object} 音频对象
   */
  createAudioObject(audioSource, format = 'mp3') {
    if (this.useCompatibleMode) {
      return {
        type: 'input_audio',
        input_audio: { 
          data: audioSource,
          format: format
        }
      };
    } else {
      // 原生模式下的音频格式，如果需要
      return {
        audio: audioSource
      };
    }
  }

  /**
   * 创建字幕对象
   * @param {Array} subtitles 字幕数组 [{startTime, endTime, text}]
   * @returns {string} 格式化的字幕文本
   */
  createSubtitleText(subtitles) {
    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      return '';
    }
    
    // 创建格式化的字幕文本
    let subtitleText = '以下是视频的字幕内容：\n\n';
    
    subtitles.forEach((sub, index) => {
      const startTime = this.formatTime(sub.startTime);
      const endTime = this.formatTime(sub.endTime);
      subtitleText += `[${startTime} -> ${endTime}] ${sub.text}\n`;
    });
    
    return subtitleText;
  }
  
  /**
   * 格式化时间（秒转为 MM:SS 格式）
   * @param {number} seconds 秒数
   * @returns {string} 格式化后的时间
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 创建助手消息
   * @param {string} content 内容
   * @returns {Object} 消息对象
   */
  createAssistantMessage(content) {
    return this.useCompatibleMode
      ? { role: 'assistant', content: [{ type: 'text', text: content }] }
      : { role: 'assistant', content: [{ text: content }] };
  }

  /**
   * 设置视频字幕
   * @param {Array} subtitles 字幕数组 [{startTime, endTime, text}]
   */
  setSubtitles(subtitles) {
    this.subtitles = subtitles;
    console.log(`已设置${subtitles.length}条字幕`);
  }
  
  /**
   * 添加视频截图
   * @param {Object} frame 截图对象 {imageData, timestamp}
   */
  addVideoFrame(frame) {
    this.videoFrames.push(frame);
    console.log(`已添加视频截图，时间戳: ${this.formatTime(frame.timestamp)}`);
  }
  
  /**
   * 设置视频元数据
   * @param {Object} metadata 视频元数据
   */
  setVideoMetadata(metadata) {
    this.videoMetadata = metadata;
    console.log('已设置视频元数据:', metadata);
  }

  /**
   * 向API发送聊天请求
   * @param {Array} messages 消息数组
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} API响应
   */
  async sendChatRequest(messages, options = {}) {
    const model = options.model || this.defaultModel;
    const stream = options.stream || false;
    const isOmni = this.isOmniModel(model);
    
    // 对于Omni模型，强制设置为流式输出
    const forceStream = isOmni ? true : stream;
    
    try {
      const apiUrl = this.useCompatibleMode ? API_ENDPOINTS.COMPATIBLE : (
        this.isMultiModalChat(messages) ? API_ENDPOINTS.MULTIMODAL : API_ENDPOINTS.TEXT
      );
      
      let requestData;
      
      if (this.useCompatibleMode) {
        // OpenAI兼容模式
        requestData = {
          model,
          messages,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.8,
          stream: forceStream
        };
        
        // 对于Omni模型，需要设置输出模态
        if (isOmni) {
          requestData.modalities = ["text"]; // Omni模型当前仅支持text输出
        }
      } else {
        // 原生模式
        requestData = {
          model,
          input: {
            messages
          },
          parameters: {
            temperature: options.temperature || 0.7,
            top_p: options.topP || 0.8,
            result_format: 'message'
          }
        };
        
        // 如果是流式输出
        if (forceStream) {
          requestData.parameters.incremental_output = true;
        }
      }
      
      const requestConfig = {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      };
      
      // 设置流式输出
      if (forceStream) {
        if (!this.useCompatibleMode) {
          requestConfig.headers['X-DashScope-SSE'] = 'enable';
        }
        // 浏览器环境不支持stream responseType
        if (typeof window === 'undefined') {
          // 仅在Node.js环境下设置
          requestConfig.responseType = 'stream';
        } else {
          // 浏览器环境禁用流式输出，直接返回普通响应
          // 但将API设置为请求流式输出
          if (this.useCompatibleMode) {
            // 在兼容模式中保留stream参数
            if (requestData.stream !== undefined) {
              requestData.stream = true;
            }
          } else {
            // 在原生模式中设置incremental_output
            if (requestData.parameters) {
              requestData.parameters.incremental_output = true;
            }
          }
        }
      }
      
      const response = await axios.post(apiUrl, requestData, requestConfig);
      
      return response;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * 处理API错误
   * @param {Error} error 错误对象
   */
  handleApiError(error) {
    if (error.response) {
      // API返回错误响应
      console.error('通义千问API错误:', {
        status: error.response.status,
        data: error.response.data
      });
      throw new Error(`API错误 (${error.response.status}): ${error.response.data.error?.message || '未知错误'}`);
    } else if (error.request) {
      // 请求发出但没有收到响应
      throw new Error('未收到API响应，请检查网络连接');
    } else {
      // 请求设置时出错
      throw new Error(`请求错误: ${error.message}`);
    }
  }

  /**
   * 检查是否为多模态聊天
   * @param {Array} messages 消息数组
   * @returns {boolean} 是否为多模态聊天
   */
  isMultiModalChat(messages) {
    // 检查消息中是否包含图片、视频或音频
    for (const message of messages) {
      if (message.content && Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.image || item.video || item.audio ||
              (item.type && 
               (item.type === 'image_url' || 
                item.type === 'video_url' || 
                item.type === 'input_audio'))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 从API响应中提取文本
   * @param {Object} response API响应
   * @returns {string} 提取的文本
   */
  extractTextFromResponse(response) {
    if (this.useCompatibleMode) {
      // 兼容模式响应格式
      if (response.data.choices && 
          response.data.choices.length > 0 &&
          response.data.choices[0].message) {
        // 处理不同的消息格式
        const message = response.data.choices[0].message;
        if (typeof message.content === 'string') {
          return message.content;
        } else if (Array.isArray(message.content)) {
          // 找到文本部分
          for (const item of message.content) {
            if (item.type === 'text') {
              return item.text;
            }
          }
        }
      }
    } else {
      // 原生模式响应格式
      if (response.data.output && 
          response.data.output.choices && 
          response.data.output.choices.length > 0) {
        const choice = response.data.output.choices[0];
        if (choice.message) {
          if (Array.isArray(choice.message.content)) {
            // 多模态响应
            for (const item of choice.message.content) {
              if (item.text) {
                return item.text;
              }
            }
          } else if (choice.message.content) {
            // 文本响应
            return choice.message.content;
          }
        }
      }
    }
    
    throw new Error('无法从API响应中提取回答');
  }

  /**
   * 使用图片列表形式调用视频理解功能
   * @param {Array<string>} frameList - base64图片数组
   * @param {string} prompt - 用户提问
   * @param {Object} options - 配置项
   * @returns {Promise<Object>} 返回AI回复
   */
  async understandVideoFrames(frameList, prompt, options = {}) {
    if (!frameList || !Array.isArray(frameList) || frameList.length < 4) {
      throw new Error('至少需要提供4个视频帧');
    }
    
    console.log(`准备视频帧分析，共 ${frameList.length} 帧，当前模型: ${options.model || this.defaultModel}`);
    
    const model = options.model || this.defaultModel;
    let systemPrompt = options.systemPrompt || '你是一个视频分析助手，请分析视频内容并回答问题。';
    const useHistory = options.useHistory !== false;
    // 总是设置流式输出为true，因为Omni模型需要
    const stream = true;
    const onChunk = options.onChunk;
    
    // 处理字幕，如果有的话
    if (options.includeSubtitles && this.subtitles && this.subtitles.length > 0) {
      const subtitleText = this.createSubtitleText(this.subtitles);
      // 在系统提示中加入字幕信息
      systemPrompt += `\n\n${subtitleText}`;
      console.log(`包含${this.subtitles.length}条字幕`);
    }
    
    // 处理当前视频时间信息
    if (options.videoTime !== undefined) {
      const videoTimeFormatted = this.formatTime(options.videoTime);
      console.log(`当前视频时间: ${videoTimeFormatted}`);
      
      // 如果有上下文信息，处理当前时间点附近的字幕
      if (options.context && options.context.currentSubtitles && options.context.currentSubtitles.length > 0) {
        const currentSubtitles = options.context.currentSubtitles;
        systemPrompt += `\n\n当前视频时间: ${videoTimeFormatted}\n当前时间点附近的字幕内容:\n`;
        
        for (const sub of currentSubtitles) {
          const startTimeFormatted = this.formatTime(sub.startTime);
          systemPrompt += `[${startTimeFormatted}] ${sub.text}\n`;
        }
        
        console.log(`包含当前时间(${videoTimeFormatted})附近的${currentSubtitles.length}条字幕`);
      }
    }
    
    // 创建消息历史
    const messages = [];
    
    // 添加系统提示
    if (systemPrompt) {
      console.log('添加系统提示:', systemPrompt);
      messages.push(this.createSystemMessage(systemPrompt));
    }
    
    // 从历史中添加消息
    if (useHistory && this.chatHistory.length > 0) {
      console.log(`添加历史消息 (${this.chatHistory.length}条)`);
      messages.push(...this.chatHistory);
    }
    
    // 构建用户消息(包含多张图片和文本)
    let userMessage;
    
    try {
      if (this.useCompatibleMode) {
        // OpenAI兼容模式下使用视频类型
        console.log('使用OpenAI兼容模式创建视频帧消息');
        const videoUrls = frameList.map(frame => {
          // 如果已经是data:开头的URL，直接使用，否则添加前缀
          return frame.startsWith('data:') ? frame : `data:image/jpeg;base64,${frame}`;
        });
        
        const content = [
          {
            type: 'video',
            video: videoUrls
          },
          {
            type: 'text',
            text: prompt
          }
        ];
        
        userMessage = { role: 'user', content };
        console.log(`成功创建视频消息，包含 ${videoUrls.length} 个帧`);
      } else {
        // 原生模式下直接使用images数组
        userMessage = {
          role: 'user',
          content: {
            video: frameList,
            text: prompt
          }
        };
      }
      
      // 添加用户消息到会话
      messages.push(userMessage);
      
      console.log(`发送视频理解请求，模型: ${model}, 流式输出: ${stream}`);
      
      // 手动收集流式响应的内容
      let fullContent = '';
      
      // 处理流式响应的回调函数
      const handleStreamChunk = (chunk) => {
        if (chunk && chunk.choices && chunk.choices.length > 0) {
          const delta = chunk.choices[0].delta;
          if (delta && delta.content) {
            fullContent += delta.content;
            if (onChunk) {
              // 直接传递文本内容
              onChunk(delta.content);
            }
          }
        } else if (typeof chunk === 'string') {
          // 如果chunk已经是字符串，直接使用
          fullContent += chunk;
          if (onChunk) {
            onChunk(chunk);
          }
        }
      };
      
      // 发送请求
      const response = await this.sendChatRequest(messages, {
        model,
        stream: true,
        onChunk: handleStreamChunk
      });
      
      // 处理流式响应数据
      if (stream) {
        // 原始响应可能是复杂对象，但我们已经收集了完整内容
        if (!fullContent && response && response.data) {
          // 尝试从响应数据提取文本
          console.log('尝试从响应数据中提取文本', response.data);
          
          // 解析SSE格式的响应
          const lines = response.data.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataContent = line.substring(5).trim();
              if (dataContent === '[DONE]') {
                // 流式响应结束标记，跳过解析
                continue;
              }
              
              try {
                const jsonData = JSON.parse(dataContent);
                if (jsonData.choices && jsonData.choices.length > 0) {
                  const delta = jsonData.choices[0].delta;
                  if (delta && delta.content) {
                    fullContent += delta.content;
                    if (onChunk) {
                      onChunk(delta.content);
                    }
                  }
                }
              } catch (e) {
                console.warn('解析数据块失败:', e, line);
              }
            }
          }
        }
      }
      
      // 打印提取的内容
      console.log('从流式响应中提取的完整内容:', fullContent);
      
      // 创建助手消息
      const assistantMessage = this.createAssistantMessage(fullContent || '无法解析视频内容');
      
      // 更新消息历史
      if (useHistory) {
        this.chatHistory.push(userMessage);
        this.chatHistory.push(assistantMessage);
      }
      
      return {
        text: fullContent || '无法解析视频内容',
        message: assistantMessage,
        originalResponse: response.data
      };
    } catch (error) {
      console.error('视频帧理解请求出错:', error);
      
      // 如果是API错误，尝试获取更详细的信息
      if (error.response) {
        console.error('API响应详情:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      throw error;
    }
  }

  /**
   * 处理流式响应
   * @param {Object} response - 响应对象
   * @param {Function} onChunk - 处理每个数据块的回调函数
   * @param {boolean} isCompatibleMode - 是否为兼容模式
   * @returns {Promise<string>} 完整的响应文本
   */
  async handleStreamResponse(response, onChunk, isCompatibleMode = this.useCompatibleMode) {
    if (!response || !response.data) {
      return '';
    }
    
    console.log('处理流式响应:', typeof response.data);
    
    let fullContent = '';
    
    try {
      // 浏览器环境下的处理
      if (typeof window !== 'undefined') {
        if (typeof response.data === 'string') {
          // 如果是字符串，表示已经接收到了完整的响应（可能是SSE格式）
          const lines = response.data.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataContent = line.substring(5).trim();
              if (dataContent === '[DONE]') {
                // 流式响应结束标记，跳过解析
                continue;
              }
              
              try {
                const jsonData = JSON.parse(dataContent);
                if (jsonData.choices && jsonData.choices.length > 0) {
                  // 兼容模式
                  if (isCompatibleMode) {
                    const delta = jsonData.choices[0].delta;
                    if (delta && delta.content) {
                      fullContent += delta.content;
                      if (onChunk) onChunk(delta.content);
                    }
                  } 
                  // 原生模式
                  else {
                    const text = jsonData.output?.text;
                    if (text) {
                      fullContent += text;
                      if (onChunk) onChunk(text);
                    }
                  }
                }
              } catch (e) {
                console.warn('解析SSE数据块失败:', e, line);
              }
            }
          }
        } else {
          console.warn('浏览器环境下预期字符串类型的响应，但收到:', typeof response.data);
        }
        
        return fullContent;
      }
      
      // Node.js环境下的处理（流式响应）
      if (response.data && typeof response.data.on === 'function') {
        return new Promise((resolve, reject) => {
          const dataChunks = [];
          
          response.data.on('data', (chunk) => {
            try {
              const lines = chunk.toString().split('\n\n');
              for (const line of lines) {
                if (line.startsWith('data:')) {
                  const dataContent = line.substring(5).trim();
                  if (dataContent === '[DONE]') {
                    // 流式响应结束标记，跳过解析
                    continue;
                  }
                  
                  try {
                    const jsonData = JSON.parse(dataContent);
                    
                    if (isCompatibleMode) {
                      // 兼容模式
                      if (jsonData.choices && jsonData.choices.length > 0) {
                        const delta = jsonData.choices[0].delta;
                        if (delta && delta.content) {
                          fullContent += delta.content;
                          if (onChunk) onChunk(delta.content);
                        }
                      }
                    } else {
                      // 原生模式
                      const text = jsonData.output?.text;
                      if (text) {
                        fullContent += text;
                        if (onChunk) onChunk(text);
                      }
                    }
                  } catch (e) {
                    console.warn('解析数据块失败:', e);
                  }
                }
              }
            } catch (error) {
              console.error('处理数据块出错:', error);
            }
            
            dataChunks.push(chunk);
          });
          
          response.data.on('end', () => {
            if (!fullContent) {
              // 如果通过解析流未提取到内容，尝试解析完整的响应
              try {
                const completeData = Buffer.concat(dataChunks).toString();
                console.log('尝试解析完整响应:', completeData.substring(0, 200) + '...');
                
                const lines = completeData.split('\n\n');
                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    const dataContent = line.substring(5).trim();
                    if (dataContent === '[DONE]') {
                      // 流式响应结束标记，跳过解析
                      continue;
                    }
                    
                    try {
                      const jsonData = JSON.parse(dataContent);
                      if (isCompatibleMode) {
                        if (jsonData.choices && jsonData.choices.length > 0) {
                          const delta = jsonData.choices[0].delta;
                          if (delta && delta.content) {
                            fullContent += delta.content;
                          }
                        }
                      } else {
                        const text = jsonData.output?.text;
                        if (text) {
                          fullContent += text;
                        }
                      }
                    } catch (e) {
                      console.warn('解析完整响应数据块失败:', e);
                    }
                  }
                }
              } catch (finalError) {
                console.error('解析完整响应失败:', finalError);
              }
            }
            
            console.log('流式响应结束，完整内容:', fullContent);
            resolve(fullContent);
          });
          
          response.data.on('error', (error) => {
            console.error('流式响应出错:', error);
            reject(error);
          });
        });
      }
      
      return fullContent;
    } catch (error) {
      console.error('处理流式响应出错:', error);
      return fullContent;
    }
  }

  /**
   * 发送聊天消息
   * @param {string|Object} promptOrOptions 用户输入或完整的选项对象
   * @param {Object} [options] 选项（当第一个参数为字符串时使用）
   * @returns {Promise<Object>} 响应对象
   */
  async chat(promptOrOptions, options = {}) {
    let prompt;
    let finalOptions;
    
    // 检查第一个参数是否是对象（包含完整选项）
    if (typeof promptOrOptions === 'object' && promptOrOptions !== null) {
      prompt = promptOrOptions.message;
      finalOptions = promptOrOptions;
    } else {
      // 传统调用方式，第一个参数是字符串
      prompt = promptOrOptions;
      finalOptions = options;
    }
    
    const model = finalOptions.model || this.defaultModel;
    const useHistory = finalOptions.useHistory !== false;
    const images = finalOptions.images || [];
    const systemPrompt = finalOptions.systemPrompt || this.systemPrompt;
    const stream = finalOptions.stream || false;
    const onChunk = finalOptions.onChunk;
    
    if (!prompt || typeof prompt !== 'string') {
      console.error('无效的prompt参数:', prompt);
      throw new Error('聊天消息不能为空');
    }
    
    // 创建消息数组
    const messages = [];
    
    // 添加系统提示
    if (systemPrompt) {
      messages.push(this.createSystemMessage(systemPrompt));
    }
    
    // 添加聊天历史
    if (useHistory && this.chatHistory.length > 0) {
      messages.push(...this.chatHistory);
    }
    
    // 创建当前用户消息
    let userMessage;
    if (images && images.length > 0) {
      // 多模态消息（带图片）
      const imageObjects = images.map(img => this.createImageObject(img));
      userMessage = this.createMultiModalMessage(prompt, imageObjects);
    } else {
      // 纯文本消息
      userMessage = this.createUserTextMessage(prompt);
    }
    
    // 处理上下文信息
    if (finalOptions.context) {
      // 如果有上下文信息且systemPrompt中没有包含这些信息，可以考虑在这里处理
      // 这里我们可以在日志中记录上下文信息
      if (finalOptions.context.videoTime !== undefined) {
        console.log(`聊天上下文中的视频时间: ${this.formatTime(finalOptions.context.videoTime)}`);
      }
      
      if (finalOptions.context.currentSubtitles && finalOptions.context.currentSubtitles.length > 0) {
        console.log(`聊天上下文中包含${finalOptions.context.currentSubtitles.length}条当前字幕`);
      }
      
      // 在兼容模式下，我们可以尝试将上下文信息添加到请求的metadata中
      if (this.useCompatibleMode && finalOptions.context && typeof finalOptions.context === 'object') {
        console.log('包含上下文信息到请求中');
        
        // 添加元数据到请求
        if (!finalOptions.requestConfig) {
          finalOptions.requestConfig = {};
        }
        
        finalOptions.requestConfig.metadata = {
          ...finalOptions.requestConfig?.metadata,
          context: JSON.stringify(finalOptions.context)
        };
      }
    }
    
    messages.push(userMessage);
    
    try {
      // 支持流式输出
      if (stream) {
        let fullText = '';
        
        if (this.useCompatibleMode) {
          // 创建请求数据
          const requestData = {
            model,
            messages,
            temperature: finalOptions.temperature || 0.7,
            top_p: finalOptions.topP || 0.8,
            stream: true
          };
          
          // 对于Omni模型，需要设置输出模态
          if (this.isOmniModel(model)) {
            requestData.modalities = ["text"]; // Omni模型当前仅支持text输出
          }
          
          // 添加自定义请求配置
          const requestConfig = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            ...finalOptions.requestConfig
          };
          
          // 创建请求实例
          const controller = new AbortController();
          const { signal } = controller;
          
          try {
            console.log('发送流式请求:', {
              endpoint: API_ENDPOINTS.COMPATIBLE,
              model,
              messagesCount: messages.length,
              firstUserMessage: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
            });
            
            // 发送流式请求
            const response = await fetch(API_ENDPOINTS.COMPATIBLE, {
              method: 'POST',
              headers: requestConfig.headers,
              body: JSON.stringify(requestData),
              signal
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`API错误 (${response.status}): ${errorData.error?.message || '未知错误'}`);
            }
            
            console.log('流式响应已开始，准备处理数据流');
            
            // 处理SSE响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('数据流已全部读取完毕');
                break;
              }
              
              const chunk = decoder.decode(value);
              console.log(`接收到数据块: ${chunk.length} 字节`);
              
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  // 遇到[DONE]标记时，仅跳过当前行的处理
                  if (data === '[DONE]' || data.trim() === '[DONE]') {
                    console.log('检测到流结束标记 [DONE]，完成处理');
                    continue; // 使用continue跳过本次循环，而不是break整个循环
                  }
                  
                  // 确保非空数据才尝试解析
                  if (!data || data.trim() === '') {
                    continue; // 跳过空数据
                  }
                  
                  try {
                    const parsedData = JSON.parse(data);
                    
                    if (parsedData.choices && parsedData.choices.length > 0) {
                      const choice = parsedData.choices[0];
                      
                      if (choice.delta && choice.delta.content) {
                        // 对于文本响应
                        const content = typeof choice.delta.content === 'string' 
                          ? choice.delta.content 
                          : (choice.delta.content[0]?.text || '');
                        
                        fullText += content;
                        console.log(`接收到内容片段: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}"`);
                        
                        if (onChunk) {
                          // 直接传递文本内容给回调函数
                          onChunk(content);
                        }
                      }
                    }
                  } catch (e) {
                    console.error('解析流数据时出错:', e, `数据: "${data.substring(0, 100)}${data.length > 100 ? '...' : ''}"`);
                    // 继续处理后续数据，不中断流程
                  }
                }
              }
            }
            
            console.log(`流式响应完成，总共接收到 ${fullText.length} 个字符`);
            
            // 保存对话历史
            if (useHistory) {
              this.chatHistory.push(userMessage);
              this.chatHistory.push(this.createAssistantMessage(fullText));
            }
            
            return {
              text: fullText,
              finish_reason: 'stop',
              role: 'assistant'
            };
          } catch (error) {
            controller.abort();
            throw error;
          }
        } else {
          // 非兼容模式流式输出
          throw new Error('非兼容模式的流式输出当前不支持');
        }
      } else {
        // 非流式输出
        const response = await this.sendChatRequest(messages, {
          model,
          temperature: finalOptions.temperature || 0.7,
          topP: finalOptions.topP || 0.8
        });
        
        // 提取响应文本
        const text = this.extractTextFromResponse(response);
        
        // 保存对话历史
        if (useHistory) {
          this.chatHistory.push(userMessage);
          this.chatHistory.push(this.createAssistantMessage(text));
        }
        
        return {
          text,
          finish_reason: 'stop',
          role: 'assistant'
        };
      }
    } catch (error) {
      console.error('聊天API调用失败:', error);
      throw error;
    }
  }

  /**
   * 清空聊天历史
   */
  clearHistory() {
    this.chatHistory = [];
    console.log('聊天历史已清空');
  }
  
  /**
   * 清空视频相关数据
   */
  clearVideoData() {
    this.subtitles = null;
    this.videoFrames = [];
    this.videoMetadata = null;
    console.log('视频相关数据已清空');
  }

  /**
   * 将视频转换为Base64（前端使用）
   * @param {File} videoFile 视频文件
   * @returns {Promise<string>} Base64编码的视频
   */
  videoToBase64(videoFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(videoFile);
      reader.onload = () => {
        // 输出格式为 data:video/mp4;base64,/9j/4AAQSkZJRgABAQEA...
        resolve(reader.result);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  }
  
  /**
   * 将图片转换为Base64（前端使用）
   * @param {File|Blob} imageFile 图片文件或Blob对象
   * @returns {Promise<string>} Base64编码的图片
   */
  imageToBase64(imageFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  }
  
  /**
   * 使用视频理解功能
   * @param {string} videoSource 视频源（URL或Base64）
   * @param {string} question 问题
   * @param {Object} options 选项
   * @returns {Promise<Object>} 响应对象
   */
  async understandVideo(videoSource, question, options = {}) {
    // 模型选择
    const defaultModel = options.model || 'qwen-omni-turbo-2025-01-19'; // 优先使用Omni模型
    const model = options.model || defaultModel;
    
    // 构建增强提示
    let enhancedQuestion = question;
    
    // 如果提供了字幕信息，添加到问题中
    if (options.includeSubtitles && this.subtitles) {
      enhancedQuestion = `${question}\n\n参考以下视频字幕:\n${this.createSubtitleText(this.subtitles)}`;
    }
    
    // 强制使用兼容模式和流式输出（对于Omni模型是必需的）
    const isOmni = this.isOmniModel(model);
    const stream = isOmni ? true : (options.stream || false);
    
    // 准备媒体对象
    const mediaOptions = {
      ...options,
      videos: [videoSource]
    };
    
    // 如果有截图，也添加到媒体对象中
    if (options.includeFrames && this.videoFrames && this.videoFrames.length > 0) {
      // 最多添加3张截图，避免上下文过大
      const maxFrames = Math.min(3, this.videoFrames.length);
      const selectedFrames = this.videoFrames.slice(0, maxFrames);
      
      mediaOptions.images = selectedFrames.map(frame => frame.imageData);
    }
    
    // 调用chat方法并传入视频对象
    return this.chat(enhancedQuestion, {
      ...mediaOptions,
      model,
      stream
    });
  }
  
  /**
   * 基于视频片段提问
   * @param {string} question 问题
   * @param {number} startTime 开始时间（秒）
   * @param {number} endTime 结束时间（秒）
   * @param {Object} options 选项
   * @returns {Promise<Object>} 响应对象
   */
  async askAboutVideoSegment(question, startTime, endTime, options = {}) {
    // 获取相关时间段的字幕
    let segmentSubtitles = [];
    if (this.subtitles) {
      segmentSubtitles = this.subtitles.filter(sub => 
        (sub.startTime >= startTime && sub.startTime <= endTime) || 
        (sub.endTime >= startTime && sub.endTime <= endTime)
      );
    }
    
    // 获取相关时间段的截图
    let segmentFrames = [];
    if (this.videoFrames) {
      segmentFrames = this.videoFrames.filter(frame => 
        frame.timestamp >= startTime && frame.timestamp <= endTime
      );
    }
    
    // 构建增强问题
    let enhancedQuestion = `关于视频${this.formatTime(startTime)}到${this.formatTime(endTime)}时间段的问题: ${question}`;
    
    // 如果有字幕，添加到问题中
    if (segmentSubtitles.length > 0) {
      enhancedQuestion += `\n\n该时间段的字幕内容:\n${this.createSubtitleText(segmentSubtitles)}`;
    }
    
    // 准备媒体对象
    const mediaOptions = {
      ...options
    };
    
    // 如果有截图，添加到媒体对象中（最多3张）
    if (segmentFrames.length > 0) {
      const maxFrames = Math.min(3, segmentFrames.length);
      mediaOptions.images = segmentFrames.slice(0, maxFrames).map(frame => frame.imageData);
    }
    
    // 调用chat方法
    return this.chat(enhancedQuestion, mediaOptions);
  }
}

// 导出单例
export const qwenAIService = new QwenAIService();
