/**
 * 火山方舟API服务模块
 * 提供火山方舟API的集成功能，包括文本生成和流式输出
 */

import axios from 'axios';
import logCollector from '../utils/LogCollector';

// API端点
const API_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// 代理端点，从环境变量获取或使用默认值
const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:8767/proxy';
const PROXY_ENDPOINT = `${PROXY_URL}`;

// 支持的模型
export const VOLCENGINE_MODELS = {
  'ep-20250207170747-dm2jv': '火山方舟通用模型'
};

/**
 * 火山方舟API服务类
 */
class VolcengineService {
  constructor() {
    this.apiKey = null;
    this.defaultModel = 'ep-20250207170747-dm2jv';
    this.systemPrompt = '你是人工智能助手.';
    this.chatHistory = [];
    this.useProxy = true; // 默认使用代理
    this.initialized = false;
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
        console.error('火山方舟API服务初始化失败: 未提供API密钥');
        return false;
      }

      this.defaultModel = options.defaultModel || this.defaultModel;
      this.systemPrompt = options.systemPrompt || this.systemPrompt;
      this.useProxy = options.useProxy !== undefined ? options.useProxy : true;
      this.baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
      this.proxyUrl = PROXY_URL;
      this.initialized = true;
      
      console.log(`火山方舟API服务初始化成功，使用模型: ${this.defaultModel}`);
      return true;
    } catch (error) {
      console.error('火山方舟API服务初始化失败:', error);
      return false;
    }
  }

  /**
   * 创建系统消息
   * @param {string} content 内容
   * @returns {Object} 消息对象
   */
  createSystemMessage(content) {
    return { role: 'system', content };
  }

  /**
   * 创建用户文本消息
   * @param {string} content 内容
   * @returns {Object} 消息对象
   */
  createUserTextMessage(content) {
    return { role: 'user', content };
  }

  /**
   * 创建助手消息
   * @param {string} content 内容
   * @returns {Object} 消息对象
   */
  createAssistantMessage(content) {
    return { role: 'assistant', content };
  }

  /**
   * 设置聊天历史记录
   * @param {Array} history 聊天历史记录
   */
  setChatHistory(history) {
    // 转换通义千问的历史记录格式为火山方舟格式
    this.chatHistory = history.map(msg => {
      // 处理通义千问的多模态消息格式
      if (msg.content && Array.isArray(msg.content)) {
        // 提取文本内容
        const textContent = msg.content
          .filter(item => item.text || (item.type === 'text' && item.text))
          .map(item => item.text || item.text)
          .join('\n');
        
        return {
          role: msg.role,
          content: textContent
        };
      }
      
      return msg;
    });
  }

  /**
   * 发送聊天请求
   * @param {Array|string} messages - 消息列表或文本消息
   * @param {Object} options - 选项
   * @param {boolean} options.stream - 是否流式输出
   * @param {Function} options.onUpdate - 响应更新回调
   * @param {boolean} options.enableReasoning - 是否启用推理过程
   * @param {boolean} options.enableLog - 是否记录日志，默认为true
   * @param {string} options.systemPrompt - 系统提示，如果提供会覆盖初始化时设置的
   * @returns {Promise<string>} - 返回聊天结果
   */
  async chat(messages, { stream = false, onUpdate = null, enableReasoning = false, enableLog = true, systemPrompt = null } = {}) {
    // 确认API密钥和服务已初始化
    if (!this.initialized) {
      const error = new Error('Volcengine服务未初始化，请先配置API密钥');
      if (enableLog) {
        logCollector.addLog({
          service: 'volcengine', 
          model: this.defaultModel,
          type: 'error',
          error: error,
          messages
        });
      }
      throw error;
    }

    try {
      // 处理消息格式 - 支持直接传入字符串或消息数组
      let formattedMessages = [];
      
      // 如果是字符串，转换为用户消息对象
      if (typeof messages === 'string') {
        console.log('将文本转换为用户消息:', messages);
        formattedMessages = [{
          role: 'user',
          content: messages
        }];
      } 
      // 如果已经是数组，使用它
      else if (Array.isArray(messages)) {
        formattedMessages = [...messages];
      } 
      // 如果既不是字符串也不是数组，抛出错误
      else {
        throw new Error('消息必须是字符串或消息对象数组');
      }
      
      // 如果提供了系统提示，使用提供的；否则使用默认的
      const effectiveSystemPrompt = systemPrompt || this.systemPrompt;
      
      // 如果没有系统提示，添加系统提示
      if (!formattedMessages.find(msg => msg.role === 'system')) {
        formattedMessages.unshift({
          role: 'system',
          content: effectiveSystemPrompt
        });
      }

      // 记录处理后的消息
      console.log('火山方舟API请求消息:', formattedMessages);

      // 构建API请求数据
      const requestData = {
        model: this.defaultModel,
        messages: formattedMessages,
        parameters: {
          temperature: 0.7,
          top_p: 0.95,
          top_k: 50,
          response_mode: enableReasoning ? 'all' : 'final_result'
        },
        stream
      };

      // 创建请求URL和配置
      const targetUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      const apiUrl = this.useProxy ? this.proxyUrl : targetUrl;

      // 创建请求配置和代理配置
      const requestConfig = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: requestData
      };
      
      // 代理请求数据
      const proxyData = this.useProxy ? {
        url: targetUrl,
        data: requestData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        stream
      } : null;
      
      // 记录请求日志
      let requestLogId = null;
      if (enableLog) {
        requestLogId = logCollector.addLog({
          service: 'volcengine',
          model: this.defaultModel,
          type: 'request',
          request: {
            url: apiUrl,
            method: 'POST',
            headers: requestConfig.headers,
            data: requestData
          },
          messages: formattedMessages,
          timestamp: new Date()
        });
      }

      let responseLog = {
        status: null,
        headers: null,
        data: null
      };

      let result = null;
      let reasoningSteps = [];
      
      // 发送请求
      if (stream) {
        // 处理流式响应
        result = await this.handleStreamResponse(
          apiUrl,
          {
            ...requestConfig,
            proxyData
          },
          onUpdate,
          (response) => {
            if (enableLog && requestLogId && !responseLog.status) {
              responseLog = {
                status: response.status,
                headers: response.headers
              };
            }
            
            // 检查响应是否包含推理过程
            if (enableReasoning && response.data) {
              if (typeof response.data === 'string') {
                try {
                  const parsedData = JSON.parse(response.data);
                  if (parsedData.type === 'reasoning' && parsedData.content) {
                    reasoningSteps.push(parsedData.content);
                    return;
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              } else if (response.data.type === 'reasoning' && response.data.content) {
                reasoningSteps.push(response.data.content);
                return;
              }
            }
          }
        );
      } else {
        // 处理普通响应
        const response = this.useProxy
          ? await axios.post(apiUrl, proxyData, { 
              headers: { 'Content-Type': 'application/json' } 
            })
          : await axios.request({ url: apiUrl, ...requestConfig });
        
        if (enableLog && requestLogId) {
          responseLog = {
            status: response.status,
            headers: response.headers
          };
        }
        
        const data = response.data;
        
        // 提取回复文本和推理过程
        if (enableReasoning && data.reasoning) {
          reasoningSteps = data.reasoning;
        }
        
        result = enableReasoning ? data.final_result : data.choice.message.content;
      }
      
      // 更新日志
      if (enableLog && requestLogId) {
        logCollector.updateLog(requestLogId, {
          type: 'response',
          response: responseLog,
          result,
          reasoning: reasoningSteps,
          timestamp: new Date()
        });
      }
      
      // 将助手回复添加到聊天历史
      if (result) {
        this.chatHistory.push({
          role: 'assistant',
          content: result
        });
      }
      
      return result;
    } catch (error) {
      console.error('火山引擎 API 请求失败:', error);
      
      if (enableLog) {
        logCollector.addLog({
          service: 'volcengine',
          model: this.defaultModel,
          type: 'error',
          error,
          messages,
          timestamp: new Date()
        });
      }
      
      throw error;
    }
  }
  
  /**
   * 处理流式响应
   * @param {string} url - 请求URL
   * @param {Object} config - 请求配置
   * @param {Function} onUpdate - 更新回调
   * @param {Function} onStreamData - 流数据回调
   * @returns {Promise<string>} - 完整的响应文本
   */
  async handleStreamResponse(url, config, onUpdate, onStreamData) {
    let fullContent = '';
    
    try {
      // 判断运行环境，在浏览器环境中不能使用 responseType: 'stream'
      const isNode = typeof window === 'undefined';
      
      console.log(`处理${isNode ? 'Node.js' : '浏览器'}环境下的流式响应`);
      
      // 在浏览器环境中使用fetch API处理流
      if (!isNode) {
        console.log('使用fetch API处理浏览器环境下的流');
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(config.proxyData)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(`API请求失败: ${response.status} ${response.statusText}`);
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // 处理事件流
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const jsonStr = line.substring(5).trim();
                if (jsonStr === '[DONE]') {
                  // 流结束
                  if (onUpdate) onUpdate(null, { done: true, fullText: fullContent });
                  return fullContent;
                }
                
                const json = JSON.parse(jsonStr);
                const content = json.choices && json.choices[0]?.delta?.content;
                
                if (content) {
                  fullContent += content;
                  if (onUpdate) onUpdate(content, { fullText: fullContent });
                }
              } catch (e) {
                console.error('解析流数据出错:', e, line);
              }
            }
          }
        }
        
        // 处理剩余数据
        if (buffer && buffer.startsWith('data:')) {
          try {
            const jsonStr = buffer.substring(5).trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              const json = JSON.parse(jsonStr);
              const content = json.choices && json.choices[0]?.delta?.content;
              
              if (content) {
                fullContent += content;
                if (onUpdate) onUpdate(content, { fullText: fullContent });
              }
            }
          } catch (e) {
            console.error('解析最后一段数据出错:', e);
          }
        }
        
        // 标记流结束
        if (onUpdate) onUpdate(null, { done: true, fullText: fullContent });
        return fullContent;
      }
      
      // 在Node.js环境中使用axios处理流
      const response = this.useProxy
        ? await axios.post(url, config.proxyData, { 
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream' 
          })
        : await axios.request({ 
            url, 
            method: config.method,
            headers: config.headers,
            data: config.data,
            responseType: 'stream' 
          });
      
      // 调用流数据回调，传递响应头信息
      if (onStreamData) {
        onStreamData(response);
      }
      
      const reader = response.data;
      
      let buffer = '';
      
      // 监听数据事件
      reader.on('data', (chunk) => {
        const decodedChunk = chunk.toString('utf-8');
        buffer += decodedChunk;
        
        // 尝试解析事件流
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // 保留最后一个可能不完整的行
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.substring(5).trim();
              if (jsonStr === '[DONE]') {
                // 流结束
                if (onUpdate) onUpdate(null, { done: true, fullText: fullContent });
                return;
              }
              
              const json = JSON.parse(jsonStr);
              const content = json.choices[0]?.delta?.content;
              
              if (content) {
                fullContent += content;
                if (onUpdate) onUpdate(content, { fullText: fullContent });
              }
            } catch (e) {
              console.error('解析SSE数据出错:', e, line);
            }
          }
        }
      });
      
      // 监听结束事件
      reader.on('end', () => {
        // 添加助手消息到历史记录
        this.chatHistory.push(this.createAssistantMessage(fullContent));
        
        if (onUpdate) onUpdate(null, { done: true, fullText: fullContent });
      });
      
      // 监听错误
      reader.on('error', (err) => {
        console.error('流式响应错误:', err);
        if (onUpdate) onUpdate(null, { error: err.message });
      });
      
    } catch (error) {
      console.error('处理流式响应出错:', error);
      if (onUpdate) onUpdate(null, { error: error.message });
    }
    
    return fullContent;
  }

  /**
   * 清空聊天历史记录
   */
  clearHistory() {
    this.chatHistory = [];
  }
}

// 导出单例实例
export const volcengineService = new VolcengineService();
export default volcengineService; 