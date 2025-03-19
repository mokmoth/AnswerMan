/**
 * AI聊天服务协调器
 * 根据对话轮次动态选择不同的模型服务
 */

import { qwenAIService } from './qwenai_service';
import { volcengineService } from './VolcengineService';

class AIChatService {
  constructor() {
    this.services = {
      qwen: qwenAIService,
      volcengine: volcengineService
    };
    
    this.currentRound = 0;
    this.activeService = 'qwen'; // 默认使用通义千问
    this.systemPrompt = '';
    this.chatHistory = [];
    this.initialized = false;
    this._volcengineAvailable = true; // 默认火山方舟可用
    this.conversationRound = 0;
    this.autoSwitchByRound = true;
    this.autoSwitchOnFailure = true;
    this.messageHistory = [];
  }
  
  /**
   * 初始化服务
   * @param {Object} options 配置选项
   * @returns {boolean} 初始化结果
   */
  init(options = {}) {
    try {
      console.log('AIChatService初始化开始，选项:', {
        qwenApiKey: options.qwenApiKey ? '已提供' : '未提供',
        volcengineApiKey: options.volcengineApiKey ? '已提供' : '未提供',
        qwenDefaultModel: options.qwenDefaultModel,
        volcengineDefaultModel: options.volcengineDefaultModel
      });
      
      // 初始化通义千问服务
      const qwenInit = this.services.qwen.init({
        apiKey: options.qwenApiKey || process.env.REACT_APP_DASHSCOPE_API_KEY,
        defaultModel: options.qwenDefaultModel || process.env.REACT_APP_DEFAULT_MODEL || 'qwen-omni-turbo',
        systemPrompt: options.systemPrompt || ''
      });
      
      console.log('通义千问服务初始化结果:', qwenInit);
      
      // 初始化火山方舟服务
      const volcengineInit = this.services.volcengine.init({
        apiKey: options.volcengineApiKey || process.env.REACT_APP_VOLCENGINE_API_KEY,
        defaultModel: options.volcengineDefaultModel || process.env.REACT_APP_VOLCENGINE_DEFAULT_MODEL || 'ep-20250207170747-dm2jv',
        systemPrompt: options.systemPrompt || ''
      });
      
      console.log('火山方舟服务初始化结果:', volcengineInit);
      
      // 修改服务初始化逻辑，即使火山方舟初始化失败，只要通义千问成功就继续
      if (!qwenInit) {
        console.error('AI聊天服务初始化失败: 通义千问服务初始化失败');
        return false;
      }
      
      if (!volcengineInit) {
        console.warn('警告: 火山方舟服务初始化失败，多轮对话将使用通义千问替代');
        // 标记火山方舟不可用
        this._volcengineAvailable = false;
      } else {
        this._volcengineAvailable = true;
      }
      
      this.systemPrompt = options.systemPrompt || '';
      this.initialized = true;
      
      console.log('AI聊天服务初始化成功');
      return true;
    } catch (error) {
      console.error('AI聊天服务初始化失败:', error);
      return false;
    }
  }
  
  /**
   * 获取当前活跃的服务
   * @returns {Object} 当前活跃的服务
   */
  getCurrentService() {
    return this.services[this.activeService];
  }
  
  /**
   * 根据对话轮次切换服务
   */
  switchServiceByRound() {
    if (this.currentRound === 0) {
      // 第一轮对话使用通义千问
      this.activeService = 'qwen';
      console.log('第一轮对话，使用通义千问服务');
    } else {
      // 非第一轮对话根据可用性选择服务
      if (this._volcengineAvailable) {
        // 火山方舟服务可用时使用火山方舟
        this.activeService = 'volcengine';
        
        // 同步历史记录到火山方舟服务
        this.services.volcengine.setChatHistory(this.chatHistory);
        
        console.log(`第${this.currentRound + 1}轮对话，使用火山方舟服务`);
      } else {
        // 火山方舟服务不可用时继续使用通义千问
        this.activeService = 'qwen';
        console.log(`第${this.currentRound + 1}轮对话，火山方舟不可用，继续使用通义千问服务`);
      }
    }
  }
  
  /**
   * 手动设置要使用的服务
   * @param {string} serviceName 服务名称 ('qwen' 或 'volcengine')
   * @returns {boolean} 是否设置成功
   */
  setActiveService(serviceName) {
    if (serviceName !== 'qwen' && serviceName !== 'volcengine') {
      console.error(`无效的服务名称: ${serviceName}，有效值为 'qwen' 或 'volcengine'`);
      return false;
    }
    
    if (serviceName === 'volcengine' && !this._volcengineAvailable) {
      console.warn('火山方舟服务不可用，无法切换');
      return false;
    }
    
    this.activeService = serviceName;
    console.log(`已手动切换到${serviceName === 'qwen' ? '通义千问' : '火山方舟'}服务`);
    
    // 如果切换到火山方舟，同步历史记录
    if (serviceName === 'volcengine') {
      this.services.volcengine.setChatHistory(this.chatHistory);
    }
    
    return true;
  }
  
  /**
   * 检查服务是否可用
   * @param {string} serviceName 服务名称
   * @returns {boolean} 是否可用
   */
  isServiceAvailable(serviceName) {
    if (serviceName === 'qwen') {
      return true; // 通义千问始终可用
    } else if (serviceName === 'volcengine') {
      return this._volcengineAvailable;
    }
    return false;
  }
  
  /**
   * 与当前激活的服务进行聊天
   * @param {string} message - 用户消息
   * @param {Object} options - 聊天选项
   * @returns {Promise<string>} - 返回聊天结果
   */
  async chat(message, options = {}) {
    // 如果没有可用的服务，返回错误
    if (!this.isAnyServiceAvailable()) {
      throw new Error('无可用的AI服务，请配置API密钥');
    }

    // 增加聊天轮次
    this.conversationRound++;
    
    // 根据轮次自动切换服务（如果配置允许）
    if (this.autoSwitchByRound) {
      await this.switchServiceByRound();
    }

    // 如果没有激活的服务，返回错误
    if (!this.activeService) {
      throw new Error('没有激活的AI服务');
    }

    try {
      // 根据当前激活的服务，调用相应的API
      if (this.activeService === 'qwen') {
        // 调用通义千问API
        return await this.services.qwen.chat(message, options);
      } else if (this.activeService === 'volcengine') {
        // 调用火山方舟API，启用推理过程和日志记录
        const volcengineOptions = {
          ...options,
          enableReasoning: true,
          enableLog: true,
          onUpdate: options.onUpdate || null,
          stream: options.stream || false
        };
        
        return await this.services.volcengine.chat(this.messageHistory, volcengineOptions);
      }
    } catch (error) {
      console.error(`${this.activeService} 聊天请求失败:`, error);
      
      // 如果出错，尝试切换到备选服务
      if (this.autoSwitchOnFailure && this.isServiceAvailable(this.getAlternativeService(this.activeService))) {
        console.log(`尝试切换到备选服务: ${this.getAlternativeService(this.activeService)}`);
        
        const prevService = this.activeService;
        this.activeService = this.getAlternativeService(this.activeService);
        
        try {
          // 使用新服务重试
          let result;
          if (this.activeService === 'qwen') {
            result = await this.services.qwen.chat(message, options);
          } else if (this.activeService === 'volcengine') {
            const volcengineOptions = {
              ...options,
              enableReasoning: true,
              enableLog: true,
              onUpdate: options.onUpdate || null,
              stream: options.stream || false
            };
            
            result = await this.services.volcengine.chat(this.messageHistory, volcengineOptions);
          }
          console.log(`使用备选服务 ${this.activeService} 成功`);
          return result;
        } catch (retryError) {
          // 备选服务也失败，恢复原服务
          console.error(`备选服务 ${this.activeService} 也失败:`, retryError);
          this.activeService = prevService;
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
   * 发送视频理解请求
   * @param {Array} frameList 视频帧列表
   * @param {string} prompt 提示词
   * @param {Object} options 选项
   * @returns {Promise<Object>} 响应结果
   */
  async understandVideoFrames(frameList, prompt, options = {}) {
    // 视频理解功能的处理逻辑：
    // 1. 第一轮对话时使用通义千问，因为第一轮必须支持视频多模态输入
    // 2. 后续轮次尊重用户选择的服务，如果用户当前选择的服务不支持视频理解，则使用普通文本聊天
    
    // 获取当前服务
    let service = null;
    
    // 第一轮对话强制使用通义千问服务进行视频理解
    if (this.currentRound === 0) {
      service = this.services.qwen;
      console.log('第一轮对话，使用通义千问服务进行视频理解');
    } else {
      // 后续轮次尊重用户选择
      const activeService = this.activeService;
      
      if (activeService === 'qwen') {
        // 通义千问支持视频理解，直接使用
        service = this.services.qwen;
        console.log('后续轮次，使用用户选择的通义千问服务继续视频理解');
      } else if (activeService === 'volcengine') {
        // 火山方舟不支持多模态输入，但可以使用常规聊天功能
        try {
          // 构建增强的系统提示，告知模型这是关于视频的后续对话
          const enhancedSystemPrompt = options.systemPrompt || "这是关于之前分析视频的后续讨论，请基于已有的对话历史回答问题。";
          
          console.log('后续轮次，使用火山方舟服务进行常规文本聊天');
          
          // 使用火山方舟的常规聊天功能
          const chatOptions = {
            ...options,
            enableHistory: true, // 确保使用对话历史
            systemPrompt: enhancedSystemPrompt,
            enableReasoning: true, // 开启推理能力
            stream: options.stream || false,
            onUpdate: options.onUpdate || null
          };
          
          // 将chatOptions中的onChunk重命名为onUpdate，因为火山方舟服务使用onUpdate
          if (chatOptions.onChunk && !chatOptions.onUpdate) {
            chatOptions.onUpdate = chatOptions.onChunk;
            delete chatOptions.onChunk;
          }
          
          // 确保传递给火山方舟服务的是纯文本格式的prompt，而不是数组
          console.log('传递给火山方舟服务的提示词:', prompt);
          
          const response = await this.services.volcengine.chat(prompt, chatOptions);
          
          // 更新对话轮次
          this.currentRound++;
          
          return response;
        } catch (error) {
          console.error('火山方舟服务常规聊天失败:', error);
          
          // 失败时回退到通义千问
          console.log('回退到通义千问服务');
          service = this.services.qwen;
        }
      }
    }
    
    // 如果没有确定服务，默认使用通义千问
    if (!service) {
      service = this.services.qwen;
      console.log('未确定服务，默认使用通义千问');
    }
    
    try {
      const response = await service.understandVideoFrames(frameList, prompt, options);
      
      // 更新对话轮次
      this.currentRound++;
      
      // 保存对话历史（用于在服务之间同步）
      if (options.useHistory !== false && !options.stream) {
        // 由于视频理解会自动记录历史，我们只需要从服务同步
        this.chatHistory = [...service.chatHistory];
      }
      
      return response;
    } catch (error) {
      console.error('视频理解请求失败:', error);
      throw error;
    }
  }
  
  /**
   * 清空聊天历史记录
   */
  clearHistory() {
    this.chatHistory = [];
    this.currentRound = 0;
    
    // 同步清空所有服务的历史记录
    Object.values(this.services).forEach(service => {
      if (typeof service.clearHistory === 'function') {
        service.clearHistory();
      }
    });
  }
  
  /**
   * 清空视频数据
   */
  clearVideoData() {
    // 通义千问支持视频数据清理
    if (typeof this.services.qwen.clearVideoData === 'function') {
      this.services.qwen.clearVideoData();
    }
  }
  
  /**
   * 视频转换为Base64
   * @param {File} videoFile 视频文件
   * @returns {Promise<string>} Base64字符串
   */
  async videoToBase64(videoFile) {
    return this.services.qwen.videoToBase64(videoFile);
  }
  
  /**
   * 图片转换为Base64
   * @param {File} imageFile 图片文件
   * @returns {Promise<string>} Base64字符串
   */
  async imageToBase64(imageFile) {
    return this.services.qwen.imageToBase64(imageFile);
  }
  
  /**
   * 获取当前使用的服务名称
   * @returns {string} 服务名称
   */
  getCurrentServiceName() {
    return this.activeService;
  }
  
  /**
   * 获取当前对话轮次
   * @returns {number} 对话轮次
   */
  getCurrentRound() {
    return this.currentRound;
  }
  
  /**
   * 设置字幕数据
   * @param {Array} subtitles 字幕数组
   */
  setSubtitles(subtitles) {
    // 仅通义千问支持设置字幕
    if (typeof this.services.qwen.setSubtitles === 'function') {
      this.services.qwen.setSubtitles(subtitles);
      console.log(`已设置${subtitles.length}条字幕到通义千问服务`);
    } else {
      console.warn('通义千问服务不支持setSubtitles方法');
    }
  }
  
  /**
   * 检查是否有可用的服务
   * @returns {boolean} 是否有可用的服务
   */
  isAnyServiceAvailable() {
    return this.isServiceAvailable('qwen') || this.isServiceAvailable('volcengine');
  }
  
  /**
   * 获取备选服务
   * @param {string} serviceName 当前服务名称
   * @returns {string} 备选服务名称
   */
  getAlternativeService(serviceName) {
    if (serviceName === 'qwen') {
      return 'volcengine';
    } else if (serviceName === 'volcengine') {
      return 'qwen';
    }
    throw new Error('无效的服务名称');
  }
}

// 导出单例实例
export const aiChatService = new AIChatService();
export default aiChatService; 