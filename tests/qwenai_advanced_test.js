/**
 * 通义千问API高级功能测试脚本
 * 这个脚本集成了多种高级功能:
 * - 聊天历史记录
 * - 多模态输入支持
 * - 流式输出
 * - 错误处理
 */

const axios = require('axios');
const dotenv = require('dotenv');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// 加载环境变量
dotenv.config();

// 配置API密钥
const DASHSCOPE_API_KEY = process.env.REACT_APP_DASHSCOPE_API_KEY;

// 如果API密钥未配置，则无法继续
if (!DASHSCOPE_API_KEY) {
  console.error('错误: 未设置通义千问API密钥。请在.env文件中设置REACT_APP_DASHSCOPE_API_KEY');
  process.exit(1);
}

// API端点
const API_ENDPOINTS = {
  // 兼容OpenAI格式的接口
  COMPATIBLE: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  // 纯文本生成接口
  TEXT: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  // 多模态生成接口（2023年之后的新版API）
  MULTIMODAL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
};

// 支持的模型
const MODELS = {
  // 文本模型
  TEXT: {
    'qwen-turbo': '通义千问-Turbo',
    'qwen-plus': '通义千问-Plus',
    'qwen-max': '通义千问-Max',
  },
  // 多模态模型
  MULTIMODAL: {
    'qwen-vl-plus': '通义千问VL-Plus',
    'qwen-vl-max': '通义千问VL-Max',
  }
};

// 聊天历史
let chatHistory = [];

/**
 * 将图片转换为适合API的格式
 * @param {string} imagePath 图片路径
 * @returns {Promise<string>} base64编码的图片
 */
async function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    return base64Image;
  } catch (error) {
    console.error(`读取图片失败: ${error.message}`);
    throw new Error(`无法读取图片: ${error.message}`);
  }
}

/**
 * 创建用户文本消息
 * @param {string} text 文本内容
 * @returns {Object} 消息对象
 */
function createUserTextMessage(text) {
  return {
    role: 'user',
    content: text
  };
}

/**
 * 创建系统消息
 * @param {string} text 系统指令
 * @returns {Object} 消息对象
 */
function createSystemMessage(text) {
  return {
    role: 'system',
    content: text
  };
}

/**
 * 创建助手消息
 * @param {string} text 助手回复
 * @returns {Object} 消息对象
 */
function createAssistantMessage(text) {
  return {
    role: 'assistant',
    content: text
  };
}

/**
 * 创建多模态消息 (兼容模式)
 * @param {string} text 文本内容
 * @param {Array<string>} imagePaths 图片路径数组
 * @returns {Promise<Object>} 消息对象
 */
async function createMultiModalMessageCompatible(text, imagePaths = []) {
  if (!imagePaths || imagePaths.length === 0) {
    return createUserTextMessage(text);
  }
  
  const content = [];
  
  // 添加文本
  if (text && text.trim() !== '') {
    content.push({
      type: 'text',
      text: text
    });
  }
  
  // 添加图片
  for (const imagePath of imagePaths) {
    try {
      const base64Image = await imageToBase64(imagePath);
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`
        }
      });
    } catch (error) {
      console.error(`处理图片 ${imagePath} 时出错:`, error);
      // 继续处理其他图片
    }
  }
  
  return {
    role: 'user',
    content: content
  };
}

/**
 * 创建多模态消息 (原生模式)
 * @param {string} text 文本内容
 * @param {Array<string>} imagePaths 图片路径数组
 * @returns {Promise<Object>} 消息对象
 */
async function createMultiModalMessageNative(text, imagePaths = []) {
  if (!imagePaths || imagePaths.length === 0) {
    return {
      role: 'user',
      content: text
    };
  }
  
  const content = [];
  
  // 添加文本
  if (text && text.trim() !== '') {
    content.push({
      type: 'text',
      text: text
    });
  }
  
  // 添加图片
  for (const imagePath of imagePaths) {
    try {
      const base64Image = await imageToBase64(imagePath);
      content.push({
        type: 'image',
        image: {
          format: 'jpg',
          data: base64Image
        }
      });
    } catch (error) {
      console.error(`处理图片 ${imagePath} 时出错:`, error);
      // 继续处理其他图片
    }
  }
  
  return {
    role: 'user',
    content: content
  };
}

/**
 * 向通义千问API发送请求 (OpenAI兼容模式)
 * @param {Array} messages 消息数组
 * @param {Object} options 配置选项
 * @param {function} onChunk 流回调函数
 * @returns {Promise<Object>} 响应数据
 */
async function sendCompatibleRequest(messages, options = {}, onChunk = null) {
  const model = options.model || 'qwen-plus';
  const temperature = options.temperature || 0.7;
  const topP = options.topP || 0.8;
  const stream = options.stream || false;
  
  const requestData = {
    model: model,
    messages: messages,
    temperature: temperature,
    top_p: topP,
    stream: stream
  };
  
  const requestConfig = {
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (stream) {
    requestConfig.responseType = 'stream';
  }
  
  try {
    const response = await axios.post(
      API_ENDPOINTS.COMPATIBLE, 
      requestData, 
      requestConfig
    );
    
    if (stream && onChunk) {
      return handleStreamResponse(response, onChunk);
    } else {
      return response.data;
    }
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * 向通义千问API发送请求 (原生模式)
 * @param {Array} messages 消息数组
 * @param {Object} options 配置选项
 * @param {function} onChunk 流回调函数
 * @returns {Promise<Object>} 响应数据
 */
async function sendNativeRequest(messages, options = {}, onChunk = null) {
  const model = options.model || 'qwen-plus';
  const temperature = options.temperature || 0.7;
  const topP = options.topP || 0.8;
  const stream = options.stream || false;
  
  // 判断是多模态还是纯文本请求
  const isMultiModal = messages.some(msg => {
    return msg.content && Array.isArray(msg.content) && 
           msg.content.some(item => item.type === 'image' || item.type === 'image_url');
  });
  
  const apiUrl = isMultiModal ? API_ENDPOINTS.MULTIMODAL : API_ENDPOINTS.TEXT;
  
  const requestData = {
    model: model,
    input: {
      messages: messages
    },
    parameters: {
      temperature: temperature,
      top_p: topP,
      result_format: 'message'
    }
  };
  
  // 如果是流式输出
  if (stream) {
    requestData.parameters.incremental_output = true;
  }
  
  const requestConfig = {
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (stream) {
    requestConfig.headers['X-DashScope-SSE'] = 'enable';
    requestConfig.responseType = 'stream';
  }
  
  try {
    const response = await axios.post(
      apiUrl, 
      requestData, 
      requestConfig
    );
    
    if (stream && onChunk) {
      return handleStreamResponse(response, onChunk);
    } else {
      return response.data;
    }
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * 处理API错误
 * @param {Error} error 错误对象
 */
function handleApiError(error) {
  if (error.response) {
    // API返回了错误响应
    console.error('API错误:', {
      status: error.response.status,
      data: error.response.data
    });
    throw new Error(`API错误 (${error.response.status}): ${error.response.data.message || '未知错误'}`);
  } else if (error.request) {
    // 请求发出但没有收到响应
    throw new Error('未收到API响应，请检查网络连接');
  } else {
    // 请求设置时出错
    throw new Error(`请求错误: ${error.message}`);
  }
}

/**
 * 处理流式响应
 * @param {Object} response Axios响应对象
 * @param {function} onChunk 处理数据块的回调函数
 * @returns {Promise<string>} 完整响应文本
 */
function handleStreamResponse(response, onChunk) {
  return new Promise((resolve, reject) => {
    let fullResponse = '';
    let buffer = '';
    
    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      buffer += chunkStr;
      
      // 处理可能的多个事件
      let parts = buffer.split('\n\n');
      buffer = parts.pop(); // 最后一个可能不完整
      
      for (const part of parts) {
        if (part.trim() === '') continue;
        if (!part.startsWith('data: ')) continue;
        
        // 提取JSON数据
        const data = part.substring(6);
        try {
          if (data.trim() === '[DONE]') {
            // 流结束
            return;
          }
          
          const json = JSON.parse(data);
          
          // 提取内容
          let content = '';
          
          // 兼容模式
          if (json.choices && json.choices.length > 0 && json.choices[0].delta) {
            content = json.choices[0].delta.content || '';
          }
          // 原生模式
          else if (json.output && json.output.choices && json.output.choices.length > 0) {
            const choice = json.output.choices[0];
            if (choice.message && choice.message.content) {
              content = choice.message.content;
            }
          }
          
          if (content) {
            fullResponse += content;
            onChunk(content);
          }
        } catch (error) {
          console.error('解析SSE数据错误:', error);
          console.error('引起错误的数据:', data);
        }
      }
    });
    
    response.data.on('end', () => {
      // 处理缓冲区中剩余的内容
      if (buffer.trim() !== '') {
        const parts = buffer.split('\n\n');
        for (const part of parts) {
          if (part.trim() === '' || !part.startsWith('data: ')) continue;
          
          const data = part.substring(6);
          try {
            if (data.trim() === '[DONE]') continue;
            
            const json = JSON.parse(data);
            
            // 提取内容
            let content = '';
            
            // 兼容模式
            if (json.choices && json.choices.length > 0 && json.choices[0].delta) {
              content = json.choices[0].delta.content || '';
            }
            // 原生模式
            else if (json.output && json.output.choices && json.output.choices.length > 0) {
              const choice = json.output.choices[0];
              if (choice.message && choice.message.content) {
                content = choice.message.content;
              }
            }
            
            if (content) {
              fullResponse += content;
              onChunk(content);
            }
          } catch (error) {
            // 忽略最后可能不完整的数据
          }
        }
      }
      
      resolve(fullResponse);
    });
    
    response.data.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 提取API响应中的文本
 * @param {Object} responseData API返回的数据
 * @returns {string} 提取的文本内容
 */
function extractTextFromResponse(responseData) {
  // 对于兼容模式的响应
  if (responseData.choices && 
      responseData.choices.length > 0 &&
      responseData.choices[0].message) {
    return responseData.choices[0].message.content;
  }
  
  // 对于原生模式的响应
  if (responseData.output && 
      responseData.output.choices && 
      responseData.output.choices.length > 0) {
    const choice = responseData.output.choices[0];
    if (choice.message && choice.message.content) {
      return choice.message.content;
    }
  }
  
  throw new Error('无法从API响应中提取回答');
}

/**
 * 发送问题到通义千问并获取回答
 * @param {string} question 问题文本
 * @param {Array<string>} imagePaths 图片路径数组
 * @param {Object} options 配置选项
 * @returns {Promise<string>} 回答文本
 */
async function askQuestion(question, imagePaths = [], options = {}) {
  const useCompatibleMode = options.useCompatibleMode || false;
  const model = options.model || (imagePaths.length > 0 ? 'qwen-vl-plus' : 'qwen-plus');
  const stream = options.stream || false;
  const onChunk = options.onChunk || null;
  
  try {
    console.log(`发送问题到通义千问 (${useCompatibleMode ? '兼容模式' : '原生模式'}): "${question}"`);
    
    // 准备消息
    let messages = [];
    
    // 添加系统消息
    messages.push(createSystemMessage('你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'));
    
    // 添加历史对话
    messages = messages.concat(chatHistory);
    
    // 添加当前问题 (可能包含图片)
    const userMessage = useCompatibleMode 
      ? await createMultiModalMessageCompatible(question, imagePaths)
      : await createMultiModalMessageNative(question, imagePaths);
    
    messages.push(userMessage);
    
    // 发送请求
    const response = useCompatibleMode
      ? await sendCompatibleRequest(messages, { ...options, model, stream }, onChunk)
      : await sendNativeRequest(messages, { ...options, model, stream }, onChunk);
    
    // 如果是流式输出，那么回答已经通过onChunk处理
    if (stream && onChunk) {
      const answer = response;  // 这是完整的回答文本
      
      // 更新聊天历史
      chatHistory.push(userMessage);
      chatHistory.push(createAssistantMessage(answer));
      
      // 限制历史长度，防止超出上下文窗口
      if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(chatHistory.length - 10);
      }
      
      return answer;
    } else {
      // 提取回答
      const answer = extractTextFromResponse(response);
      
      // 更新聊天历史
      chatHistory.push(userMessage);
      chatHistory.push(createAssistantMessage(answer));
      
      // 限制历史长度，防止超出上下文窗口
      if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(chatHistory.length - 10);
      }
      
      return answer;
    }
  } catch (error) {
    console.error(`处理问题时出错: ${error.message}`);
    throw error;
  }
}

/**
 * 清空聊天历史
 */
function clearChatHistory() {
  chatHistory = [];
  console.log('聊天历史已清空');
}

/**
 * 创建命令行交互界面
 */
function createInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  let useCompatibleMode = false;
  let currentModel = 'qwen-plus';
  let useStreamMode = true;
  
  console.log('=== 通义千问API高级测试工具 ===');
  console.log('命令:');
  console.log('  exit            - 退出程序');
  console.log('  clear           - 清空聊天历史');
  console.log('  mode            - 切换API模式 (兼容/原生)');
  console.log('  model <名称>    - 切换模型');
  console.log('  stream          - 切换流式输出');
  console.log('  image <路径>    - 发送带图片的问题');
  console.log('  models          - 列出可用模型');
  console.log('  help            - 显示帮助信息');
  console.log('\n当前设置:');
  console.log(`  - 模式: ${useCompatibleMode ? '兼容模式' : '原生模式'}`);
  console.log(`  - 模型: ${currentModel}`);
  console.log(`  - 流式输出: ${useStreamMode ? '开启' : '关闭'}`);
  console.log('');
  
  function promptQuestion() {
    rl.question('> ', async (input) => {
      try {
        // 处理命令
        if (input.toLowerCase() === 'exit') {
          console.log('再见!');
          rl.close();
          return;
        } else if (input.toLowerCase() === 'clear') {
          clearChatHistory();
        } else if (input.toLowerCase() === 'mode') {
          useCompatibleMode = !useCompatibleMode;
          console.log(`已切换到 ${useCompatibleMode ? '兼容模式' : '原生模式'}`);
        } else if (input.toLowerCase() === 'stream') {
          useStreamMode = !useStreamMode;
          console.log(`流式输出已 ${useStreamMode ? '开启' : '关闭'}`);
        } else if (input.toLowerCase() === 'models') {
          console.log('\n可用模型:');
          console.log('文本模型:');
          for (const [code, name] of Object.entries(MODELS.TEXT)) {
            console.log(`  - ${code} (${name})`);
          }
          console.log('多模态模型:');
          for (const [code, name] of Object.entries(MODELS.MULTIMODAL)) {
            console.log(`  - ${code} (${name})`);
          }
        } else if (input.toLowerCase() === 'help') {
          console.log('\n命令:');
          console.log('  exit            - 退出程序');
          console.log('  clear           - 清空聊天历史');
          console.log('  mode            - 切换API模式 (兼容/原生)');
          console.log('  model <名称>    - 切换模型');
          console.log('  stream          - 切换流式输出');
          console.log('  image <路径>    - 发送带图片的问题');
          console.log('  models          - 列出可用模型');
          console.log('  help            - 显示帮助信息');
        } else if (input.toLowerCase().startsWith('model ')) {
          const modelName = input.substring(6).trim();
          
          // 检查模型是否存在
          let modelExists = false;
          for (const category of Object.values(MODELS)) {
            if (modelName in category) {
              modelExists = true;
              break;
            }
          }
          
          if (modelExists) {
            currentModel = modelName;
            console.log(`已切换到模型: ${currentModel}`);
          } else {
            console.log(`错误: 未知模型 "${modelName}". 使用 "models" 命令查看可用模型。`);
          }
        } else if (input.toLowerCase().startsWith('image ')) {
          const parts = input.substring(6).trim().split(' ');
          const imagePath = parts[0];
          const question = parts.slice(1).join(' ');
          
          // 验证图片路径
          if (!fs.existsSync(imagePath)) {
            console.error(`错误: 找不到图片 "${imagePath}"`);
          } else if (!question || question.trim() === '') {
            console.error('错误: 请提供问题文本');
          } else {
            // 设置一个多模态模型
            let modelToUse = currentModel;
            if (!Object.keys(MODELS.MULTIMODAL).includes(currentModel)) {
              // 如果当前不是多模态模型，自动切换
              modelToUse = 'qwen-vl-plus';
              console.log(`注意: 自动切换到多模态模型 ${modelToUse}`);
            }
            
            // 打印回答标题
            process.stdout.write('\n回答: ');
            
            // 设置回调
            const onChunk = useStreamMode ? (chunk) => {
              process.stdout.write(chunk);
            } : null;
            
            // 发送问题
            const answer = await askQuestion(
              question, 
              [imagePath], 
              { 
                useCompatibleMode, 
                model: modelToUse,
                stream: useStreamMode,
                onChunk 
              }
            );
            
            // 如果不是流式输出，打印完整回答
            if (!useStreamMode) {
              console.log(answer);
            }
            
            console.log('\n');
          }
        } else if (input.trim() !== '') {
          // 普通问题

          // 打印回答标题
          process.stdout.write('\n回答: ');
          
          // 设置回调
          const onChunk = useStreamMode ? (chunk) => {
            process.stdout.write(chunk);
          } : null;
          
          // 发送问题
          const answer = await askQuestion(
            input, 
            [], 
            { 
              useCompatibleMode, 
              model: currentModel,
              stream: useStreamMode,
              onChunk 
            }
          );
          
          // 如果不是流式输出，打印完整回答
          if (!useStreamMode) {
            console.log(answer);
          }
          
          console.log('\n');
        }
      } catch (error) {
        console.error(`\n错误: ${error.message}`);
      }
      
      // 显示当前设置和继续提问
      console.log('\n当前设置:');
      console.log(`  - 模式: ${useCompatibleMode ? '兼容模式' : '原生模式'}`);
      console.log(`  - 模型: ${currentModel}`);
      console.log(`  - 流式输出: ${useStreamMode ? '开启' : '关闭'}`);
      console.log('');
      
      promptQuestion();
    });
  }
  
  // 开始提问循环
  promptQuestion();
}

// 执行测试
async function runTest() {
  try {
    // 测试API连接
    console.log('测试通义千问API连接...');
    
    // 设置流式输出回调
    let testResponse = '';
    const onChunk = (chunk) => {
      process.stdout.write(chunk);
      testResponse += chunk;
    };
    
    process.stdout.write('模型回答: ');
    
    // 发送测试问题
    await askQuestion(
      '你好，请简单自我介绍并说明你的功能', 
      [], 
      { useCompatibleMode: false, model: 'qwen-plus', stream: true, onChunk }
    );
    
    console.log('\n\nAPI连接测试成功!');
    console.log('开始高级交互模式...\n');
    
    // 启动交互界面
    createInterface();
  } catch (error) {
    console.error(`初始化测试失败: ${error.message}`);
    process.exit(1);
  }
}

// 启动测试
runTest(); 