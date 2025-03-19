/**
 * 通义千问API服务模块
 * 提供通义千问API的集成功能，包括文本生成、多模态理解和流式输出
 */

import axios from 'axios';
import logCollector from '../utils/LogCollector';

// API端点
const API_ENDPOINTS = {
  // 兼容OpenAI格式的接口 - 修正为文档中的正确地址
  COMPATIBLE: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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
   * @param {Object} options 初始化选项
   * @returns {boolean} 是否初始化成功
   */
  init(options = {}) {
    try {
      this.apiKey = options.apiKey || process.env.REACT_APP_DASHSCOPE_API_KEY;
      
      if (!this.apiKey) {
        console.error('通义千问API初始化失败: 缺少API密钥');
        return false;
      }
      
      // 默认使用兼容模式，因为Omni模型需要OpenAI兼容模式调用
      this.useCompatibleMode = true;
      
      if (options.defaultModel) {
        this.defaultModel = options.defaultModel;
      }
      
      if (options.systemPrompt) {
        this.systemPrompt = options.systemPrompt;
      }
      
      const isOmni = this.isOmniModel(this.defaultModel);
      console.log(`通义千问API服务初始化成功，使用${this.useCompatibleMode ? '标准' : '原生'}模式${isOmni ? '，Omni模型' : ''}`);
      return true;
    } catch (error) {
      console.error('通义千问API初始化失败:', error);
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
   * 发送聊天请求
   * @param {string} message - 用户消息
   * @param {Object} options - 请求选项
   * @param {boolean} options.stream - 是否使用流式输出
   * @param {Function} options.onUpdate - 流式输出回调函数
   * @param {string} options.systemPrompt - 系统提示词
   * @param {boolean} options.enableLog - 是否记录日志，默认为true
   * @returns {Promise<string>} 返回聊天结果
   */
  async sendChatRequest(message, { stream = false, onUpdate = null, systemPrompt = null, enableLog = true } = {}) {
    // 确认API密钥存在
    if (!this.apiKey) {
      const error = new Error('缺少API密钥');
      if (enableLog) {
        logCollector.addLog({
          service: 'qwen',
          model: 'qwen-max',
          type: 'error',
          error: error,
          timestamp: new Date()
        });
      }
      throw error;
    }

    const useProxy = true; // 是否使用代理
    const proxyUrl = process.env.REACT_APP_PROXY_URL || 'http://localhost:8767/proxy'; // 代理服务器URL

    let apiUrl;
    let requestData;

    // 根据兼容模式和消息类型选择API
    if (this.useCompatibleMode === 'omni' || typeof message !== 'string') {
      // 通过代理访问Omni模式的API
      const targetUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      apiUrl = useProxy ? proxyUrl : targetUrl;

      // 构建请求数据
      requestData = {
        model: this.defaultModel,
        input: {
          messages: typeof message === 'string' ? [{
            role: 'user',
            content: message
          }] : message
        },
        parameters: {
          result_format: "message",
          output_modality: "text",
          temperature: 0.7,
          top_p: 0.95,
          top_k: 50
        },
        stream: stream
      };

      // 如果有指定系统提示，添加到消息列表开头
      if (systemPrompt) {
        if (typeof message === 'string') {
          requestData.input.messages.unshift({
            role: 'system',
            content: systemPrompt
          });
        } else if (Array.isArray(message) && !message.find(msg => msg.role === 'system')) {
          requestData.input.messages.unshift({
            role: 'system',
            content: systemPrompt
          });
        }
      }
    } else {
      // 兼容模式API
      const targetUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      apiUrl = useProxy ? proxyUrl : targetUrl;

      // 构建请求数据
      requestData = {
        model: this.defaultModel,
        messages: typeof message === 'string' ? [{
          role: 'user',
          content: message
        }] : message,
        temperature: 0.7,
        top_p: 0.95,
        stream: stream,
        modalities: ["text"] // 添加输出模态为文本
      };

      // 如果有指定系统提示，添加到消息列表开头
      if (systemPrompt) {
        if (typeof message === 'string') {
          requestData.messages.unshift({
            role: 'system',
            content: systemPrompt
          });
        } else if (Array.isArray(message) && !message.find(msg => msg.role === 'system')) {
          requestData.messages.unshift({
            role: 'system',
            content: systemPrompt
          });
        }
      }
    }

    // 设置请求配置
    const requestConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    // 根据环境决定流式输出处理方式
    if (stream) {
      if (typeof window === 'undefined') {
        // Node.js环境
        requestConfig.responseType = 'stream';
      } else {
        // 浏览器环境
        requestConfig.responseType = 'text';
      }
    }

    // 记录请求日志
    let requestLogId = null;
    if (enableLog) {
      requestLogId = logCollector.addLog({
        service: 'qwen',
        model: this.defaultModel,
        type: 'request',
        request: {
          url: apiUrl,
          method: 'POST',
          headers: requestConfig.headers,
          data: requestData
        },
        messages: requestData.messages || requestData.input?.messages,
        timestamp: new Date()
      });
    }

    try {
      let result = '';

      // 发送请求
      if (stream) {
        if (useProxy) {
          // 使用代理发送流式请求
          // 根据请求类型构建不同的代理请求数据
          let proxyRequestData;
          
          // 检查是否包含视频帧分析数据
          const isVideoAnalysis = Array.isArray(message) && message.length > 1 && 
            message[1]?.role === 'user' && Array.isArray(message[1]?.content) &&
            message[1]?.content.some(item => item.type === 'video');
          
          if (isVideoAnalysis) {
            // 视频分析请求 - 使用兼容模式API
            proxyRequestData = {
              url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
              data: {
                model: this.defaultModel,
                messages: message,
                stream: true,
                temperature: 0.7,
                top_p: 0.95,
                modalities: ["text"]
              },
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
              }
            };
            console.log('发送视频分析兼容模式请求');
          } else {
            // 常规请求
            proxyRequestData = {
              url: this.useCompatibleMode === 'omni' ? 
                'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' : 
                'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
              data: requestData,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
              },
              stream: true // 确保代理知道这是流式请求
            };
          }

          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(proxyRequestData)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(`API请求失败: ${response.status} ${response.statusText}`);
            error.response = { status: response.status, data: errorData };
            
            // 记录错误日志
            if (enableLog && requestLogId) {
              logCollector.updateLog(requestLogId, {
                type: 'error',
                error: error,
                response: {
                  status: response.status,
                  headers: Object.fromEntries(response.headers.entries()),
                  data: errorData
                },
                timestamp: new Date()
              });
            }
            
            throw error;
          }

          // 记录响应日志
          if (enableLog && requestLogId) {
            logCollector.updateLog(requestLogId, {
              type: 'response',
              response: {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries())
              },
              timestamp: new Date()
            });
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let fullContent = '';
          let pendingText = '';
          
          // 流式处理响应
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, {stream: true});
            pendingText += chunk;
            
            // 处理流式响应，确保每行是完整的
            const lines = pendingText.split('\n');
            // 最后一行可能不完整，保留到下一次处理
            pendingText = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim() || line.includes('data: [DONE]')) continue;
              
              try {
                // 提取JSON数据
                if (!line.startsWith('data:')) continue;
                
                const jsonData = line.replace(/^data: /, '').trim();
                if (!jsonData) continue;
                
                const data = JSON.parse(jsonData);
                if (data.choices && data.choices.length > 0) {
                  const content = data.choices[0].delta?.content || data.choices[0].message?.content || '';
                  if (content) {
                    fullContent += content;
                    if (onUpdate) {
                      // 将完整内容作为context.fullText传递，避免前端重复累加
                      onUpdate(content, { fullText: fullContent });
                    }
                  }
                }
              } catch (e) {
                console.warn('解析流数据失败:', e, line);
              }
            }
          }
          
          // 处理剩余的未处理文本
          if (pendingText.trim()) {
            try {
              if (pendingText.startsWith('data:')) {
                const jsonData = pendingText.replace(/^data: /, '').trim();
                if (jsonData && !jsonData.includes('[DONE]')) {
                  const data = JSON.parse(jsonData);
                  if (data.choices && data.choices.length > 0) {
                    const content = data.choices[0].delta?.content || data.choices[0].message?.content || '';
                    if (content) {
                      fullContent += content;
                      if (onUpdate) {
                        // 将完整内容作为context.fullText传递
                        onUpdate(content, { fullText: fullContent });
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('解析最后一行数据失败:', e);
            }
          }
          
          // 标记流式响应完成
          if (onUpdate) {
            onUpdate('', { done: true, fullText: fullContent });
          }
          
          result = fullContent;
        } else {
          throw new Error('非代理模式下不支持流式请求');
        }
      } else {
        // 非流式请求
        let response;
        
        if (useProxy) {
          // 使用代理
          response = await axios.post(apiUrl, requestData, { headers: requestConfig.headers });
        } else {
          // 直接请求API
          response = await axios.request({
            url: apiUrl,
            ...requestConfig,
            data: requestData
          });
        }
        
        // 记录响应日志
        if (enableLog && requestLogId) {
          logCollector.updateLog(requestLogId, {
            type: 'response',
            response: {
              status: response.status,
              headers: response.headers,
              data: response.data
            },
            timestamp: new Date()
          });
        }
        
        // 从响应中提取内容
        if (this.useCompatibleMode === 'omni') {
          if (response.data.output && response.data.output.choices && response.data.output.choices.length > 0) {
            result = response.data.output.choices[0].message.content;
          }
        } else {
          if (response.data.choices && response.data.choices.length > 0) {
            result = response.data.choices[0].message.content;
          }
        }
        
        // 更新日志
        if (enableLog && requestLogId) {
          logCollector.updateLog(requestLogId, {
            result: result,
            timestamp: new Date()
          });
        }
      }

      return result;
    } catch (error) {
      console.error('通义API请求失败:', error);
      
      // 记录错误日志
      if (enableLog) {
        if (requestLogId) {
          logCollector.updateLog(requestLogId, {
            type: 'error',
            error: error,
            timestamp: new Date()
          });
        } else {
          logCollector.addLog({
            service: 'qwen',
            model: this.defaultModel,
            type: 'error',
            error: error,
            request: {
              url: apiUrl,
              method: 'POST',
              data: requestData
            },
            timestamp: new Date()
          });
        }
      }
      
      throw error;
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
    if (!response) {
      throw new Error('无效的响应对象');
    }
    
    try {
      if (this.useCompatibleMode) {
        // 兼容模式响应格式
        if (response.choices && 
            response.choices.length > 0 &&
            response.choices[0].message) {
          // 处理不同的消息格式
          const message = response.choices[0].message;
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
        if (response.output && 
            response.output.choices && 
            response.output.choices.length > 0) {
          const choice = response.output.choices[0];
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
      
      // 如果无法提取出文本，返回整个响应的字符串表示
      console.warn('无法从响应中提取文本，返回原始响应');
      return JSON.stringify(response);
    } catch (error) {
      console.error('提取响应文本时出错:', error);
      throw new Error('无法从API响应中提取回答');
    }
  }

  /**
   * 使用通义千问Omni模型分析视频帧
   * @param {Array} frameList 视频帧列表（Base64格式）
   * @param {string} prompt 用户提示
   * @param {Object} options 配置选项
   * @returns {Promise<string>} 分析结果
   */
  async understandVideoFrames(frameList, prompt, options = {}) {
    try {
      console.log(`准备视频帧分析，共 ${frameList.length} 帧，当前模型: ${this.defaultModel}`);
      
      if (!this.isOmniModel(this.defaultModel)) {
        throw new Error('视频帧分析需要使用Omni模型');
      }
      
      // 对于通义千问Omni，必须使用兼容模式
      const originalMode = this.useCompatibleMode;
      this.useCompatibleMode = 'compatible'; // 强制使用兼容模式
      
      // 准备消息数组
      const messages = [];
      
      // 添加系统提示
      if (options.systemPrompt) {
        messages.push(this.createSystemMessage(options.systemPrompt));
      } else {
        messages.push(this.createSystemMessage('你是视频理解助手，正在分析用户上传的视频。请根据视频内容回答用户问题。'));
      }
      
      // 添加用户消息
      const userMessage = {
        role: 'user',
        content: []
      };
      
      // 添加视频帧 - 使用文档中规定的格式
      userMessage.content.push({
        type: 'video',
        video: frameList.map(frame => `data:image/jpeg;base64,${frame}`)
      });
      
      // 添加文本提示
      userMessage.content.push({
        type: 'text',
        text: prompt
      });
      
      messages.push(userMessage);
      
      // 添加字幕如果有
      if (this.subtitles && this.subtitles.length > 0) {
        const subtitleText = this.createSubtitleText(this.subtitles);
        
        // 修改用户消息，在提示前添加字幕信息
        userMessage.content[1].text = `${subtitleText}\n\n${prompt}`;
      }
      
      const streamOption = options.stream !== false;
      
      // 发送请求
      console.log(`发送视频理解请求，模型: ${this.defaultModel}, 流式输出: ${streamOption}`);
      
      // 直接使用简化的请求格式，确保messages正确传递
      const requestOptions = {
        stream: streamOption,
        onUpdate: options.onChunk,
        systemPrompt: null, // 已在messages中包含
        enableLog: true
      };
      
      const response = await this.sendChatRequest(messages, requestOptions);
      
      // 恢复原始兼容模式设置
      this.useCompatibleMode = originalMode;
      
      return response;
    } catch (error) {
      console.log(' 视频帧理解请求出错:', error);
      throw error;
    }
  }

  /**
   * 处理流式响应
   * @param {Object} response Axios响应对象
   * @param {Function} onChunk 处理数据块的回调函数
   * @returns {Promise<string>} 完整的响应文本
   */
  async handleStreamResponse(response, onChunk) {
    if (!response || !response.data) {
      console.error('无效的流式响应:', response);
      throw new Error('无效的流式响应');
    }

    let fullContent = '';
    
    try {
      // SSE格式的文本响应处理
      if (typeof response.data === 'string') {
        console.log('处理文本格式SSE响应');
        const lines = response.data.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataContent = line.substring(5).trim();
            
            if (dataContent === '[DONE]') {
              continue; // 流结束标记
            }
            
            try {
              const jsonData = JSON.parse(dataContent);
              
              if (jsonData.choices && jsonData.choices.length > 0) {
                const delta = jsonData.choices[0].delta;
                
                if (delta && delta.content) {
                  fullContent += delta.content;
                  onChunk(delta.content);
                }
              }
            } catch (e) {
              console.warn('解析SSE数据块失败:', e);
            }
          }
        }
      }
      // 直接返回JSON对象
      else if (typeof response.data === 'object') {
        console.log('处理JSON对象响应');
        
        if (response.data.choices && response.data.choices.length > 0) {
          const choice = response.data.choices[0];
          
          if (choice.message && choice.message.content) {
            let content = '';
            
            if (typeof choice.message.content === 'string') {
              content = choice.message.content;
            } 
            else if (Array.isArray(choice.message.content)) {
              // 找到文本部分
              for (const item of choice.message.content) {
                if (item.type === 'text') {
                  content = item.text;
                  break;
                }
              }
            }
            
            if (content) {
              fullContent = content;
              onChunk(content);
            }
          }
        }
      }
      
      console.log(`流式处理完成，总内容长度: ${fullContent.length}`);
      return fullContent;
    } catch (error) {
      console.error('处理流式响应时出错:', error);
      throw new Error(`流处理错误: ${error.message}`);
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
                          onChunk(content, { fullText: fullText });
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
