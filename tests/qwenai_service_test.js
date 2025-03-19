/**
 * 通义千问API服务测试脚本
 * 使用原生方式测试通义千问API
 */

const axios = require('axios');
const dotenv = require('dotenv');
const readline = require('readline');

// 加载环境变量
dotenv.config();

// API密钥
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
  // 多模态生成接口
  MULTIMODAL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
};

// 支持的模型
const QWEN_MODELS = {
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
 * 创建系统消息
 * @param {string} content 系统消息内容
 * @returns {Object} 消息对象
 */
function createSystemMessage(content) {
  return {
    role: 'system',
    content: content
  };
}

/**
 * 创建用户消息
 * @param {string} content 用户消息内容
 * @returns {Object} 消息对象
 */
function createUserMessage(content) {
  return {
    role: 'user',
    content: content
  };
}

/**
 * 创建助手消息
 * @param {string} content 助手消息内容
 * @returns {Object} 消息对象
 */
function createAssistantMessage(content) {
  return {
    role: 'assistant',
    content: content
  };
}

/**
 * 向通义千问发送问题并获取回答 (标准模式)
 * @param {string} question 用户问题
 * @param {Object} options 选项
 * @returns {Promise<string>} 模型回答
 */
async function askQwenStandard(question, options = {}) {
  try {
    console.log(`发送问题到通义千问 (标准模式): "${question}"`);
    
    // 准备消息
    const messages = [];
    
    // 添加系统消息
    messages.push(createSystemMessage('你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'));
    
    // 添加历史对话
    if (options.useHistory !== false && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }
    
    // 添加当前问题
    messages.push(createUserMessage(question));
    
    const requestData = {
      model: options.model || 'qwen-plus',
      input: {
        messages: messages
      },
      parameters: {
        result_format: 'message'
      }
    };
    
    // 发送请求到API
    const response = await axios.post(API_ENDPOINTS.TEXT, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 检查响应状态
    if (response.status !== 200) {
      throw new Error(`API返回错误状态码: ${response.status}`);
    }
    
    // 提取回答文本
    const responseData = response.data;
    
    if (responseData.output && 
        responseData.output.choices && 
        responseData.output.choices.length > 0 &&
        responseData.output.choices[0].message &&
        responseData.output.choices[0].message.content) {
      
      const answer = responseData.output.choices[0].message.content;
      
      // 更新聊天历史
      if (options.useHistory !== false) {
        chatHistory.push(createUserMessage(question));
        chatHistory.push(createAssistantMessage(answer));
        
        // 限制历史长度
        if (chatHistory.length > 10) {
          chatHistory = chatHistory.slice(chatHistory.length - 10);
        }
      }
      
      return answer;
    } else {
      console.error('无法识别的API响应格式:', JSON.stringify(responseData, null, 2));
      throw new Error('无法从API响应中提取回答');
    }
  } catch (error) {
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
}

/**
 * 向通义千问发送问题并获取回答 (OpenAI兼容模式)
 * @param {string} question 用户问题
 * @param {Object} options 选项
 * @returns {Promise<string>} 模型回答
 */
async function askQwenCompatible(question, options = {}) {
  try {
    console.log(`发送问题到通义千问 (OpenAI兼容模式): "${question}"`);
    
    // 准备消息
    const messages = [];
    
    // 添加系统消息
    messages.push(createSystemMessage('你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'));
    
    // 添加历史对话
    if (options.useHistory !== false && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }
    
    // 添加当前问题
    messages.push(createUserMessage(question));
    
    const requestData = {
      model: options.model || 'qwen-plus',
      messages: messages,
      temperature: 0.7,
      top_p: 0.8
    };
    
    // 发送请求到API
    const response = await axios.post(API_ENDPOINTS.COMPATIBLE, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 检查响应状态
    if (response.status !== 200) {
      throw new Error(`API返回错误状态码: ${response.status}`);
    }
    
    // 提取回答文本
    const responseData = response.data;
    
    if (responseData.choices && 
        responseData.choices.length > 0 &&
        responseData.choices[0].message &&
        responseData.choices[0].message.content) {
      
      const answer = responseData.choices[0].message.content;
      
      // 更新聊天历史
      if (options.useHistory !== false) {
        chatHistory.push(createUserMessage(question));
        chatHistory.push(createAssistantMessage(answer));
        
        // 限制历史长度
        if (chatHistory.length > 10) {
          chatHistory = chatHistory.slice(chatHistory.length - 10);
        }
      }
      
      return answer;
    } else {
      console.error('无法识别的API响应格式:', JSON.stringify(responseData, null, 2));
      throw new Error('无法从API响应中提取回答');
    }
  } catch (error) {
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
  
  // 当前设置
  let useCompatibleMode = false;
  let currentModel = 'qwen-plus';
  let useHistory = true;
  
  console.log('=== 通义千问API服务测试工具 ===');
  console.log('可用命令:');
  console.log('  exit       - 退出程序');
  console.log('  clear      - 清空聊天历史');
  console.log('  history    - 显示聊天历史');
  console.log('  mode       - 切换API模式');
  console.log('  model <名称> - 切换模型');
  console.log('  models     - 显示可用模型');
  console.log('  usehistory - 切换历史记录使用');
  console.log('  help       - 显示帮助信息');
  console.log('\n当前设置:');
  console.log(`  - 模式: ${useCompatibleMode ? 'OpenAI兼容' : '标准'}模式`);
  console.log(`  - 模型: ${currentModel}`);
  console.log(`  - 使用历史: ${useHistory ? '是' : '否'}`);
  
  function promptQuestion() {
    rl.question('\n> ', async (input) => {
      try {
        // 处理命令
        if (input.toLowerCase() === 'exit') {
          console.log('再见!');
          rl.close();
          return;
        } else if (input.toLowerCase() === 'clear') {
          clearChatHistory();
        } else if (input.toLowerCase() === 'history') {
          console.log('\n聊天历史:');
          if (chatHistory.length === 0) {
            console.log('(无历史记录)');
          } else {
            chatHistory.forEach((msg, index) => {
              console.log(`[${index + 1}] ${msg.role}: ${msg.content}`);
            });
          }
        } else if (input.toLowerCase() === 'mode') {
          useCompatibleMode = !useCompatibleMode;
          console.log(`已切换到${useCompatibleMode ? 'OpenAI兼容' : '标准'}模式`);
        } else if (input.toLowerCase() === 'models') {
          console.log('\n可用模型:');
          console.log('文本模型:');
          Object.entries(QWEN_MODELS.TEXT).forEach(([id, name]) => {
            console.log(`  ${id} - ${name}`);
          });
          console.log('多模态模型:');
          Object.entries(QWEN_MODELS.MULTIMODAL).forEach(([id, name]) => {
            console.log(`  ${id} - ${name}`);
          });
        } else if (input.toLowerCase().startsWith('model ')) {
          const modelName = input.substring(6).trim();
          
          // 检查模型是否存在
          let modelExists = false;
          for (const category of Object.values(QWEN_MODELS)) {
            if (modelName in category) {
              modelExists = true;
              break;
            }
          }
          
          if (modelExists) {
            currentModel = modelName;
            console.log(`已切换到模型: ${modelName}`);
          } else {
            console.log(`错误: 未知模型 "${modelName}". 使用 "models" 命令查看可用模型。`);
          }
        } else if (input.toLowerCase() === 'usehistory') {
          useHistory = !useHistory;
          console.log(`历史记录使用已${useHistory ? '开启' : '关闭'}`);
        } else if (input.toLowerCase() === 'help') {
          console.log('\n可用命令:');
          console.log('  exit       - 退出程序');
          console.log('  clear      - 清空聊天历史');
          console.log('  history    - 显示聊天历史');
          console.log('  mode       - 切换API模式');
          console.log('  model <名称> - 切换模型');
          console.log('  models     - 显示可用模型');
          console.log('  usehistory - 切换历史记录使用');
          console.log('  help       - 显示帮助信息');
        } else if (input.trim() !== '') {
          // 发送问题
          const startTime = Date.now();
          
          // 根据模式选择不同的函数
          const answer = useCompatibleMode
            ? await askQwenCompatible(input, { model: currentModel, useHistory })
            : await askQwenStandard(input, { model: currentModel, useHistory });
          
          const endTime = Date.now();
          
          console.log('\n回答:');
          console.log(answer);
          console.log(`\n(用时: ${endTime - startTime}ms)`);
        }
      } catch (error) {
        console.error(`错误: ${error.message}`);
      }
      
      // 显示当前设置
      console.log('\n当前设置:');
      console.log(`  - 模式: ${useCompatibleMode ? 'OpenAI兼容' : '标准'}模式`);
      console.log(`  - 模型: ${currentModel}`);
      console.log(`  - 使用历史: ${useHistory ? '是' : '否'}`);
      
      // 继续提问
      promptQuestion();
    });
  }
  
  // 开始提问循环
  promptQuestion();
}

// 执行测试
async function runTest() {
  try {
    console.log('测试通义千问API连接...');
    
    // 测试标准模式
    const standardAnswer = await askQwenStandard('你好，请简单自我介绍', { useHistory: false });
    console.log('标准模式测试成功! 回答:');
    console.log(standardAnswer);
    
    // 测试兼容模式
    const compatibleAnswer = await askQwenCompatible('你好，请简单自我介绍', { useHistory: false });
    console.log('\nOpenAI兼容模式测试成功! 回答:');
    console.log(compatibleAnswer);
    
    console.log('\n开始交互模式...');
    
    // 启动交互界面
    createInterface();
  } catch (error) {
    console.error(`初始化测试失败: ${error.message}`);
    process.exit(1);
  }
}

// 启动测试
runTest(); 