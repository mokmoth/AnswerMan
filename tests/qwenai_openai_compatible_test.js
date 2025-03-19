/**
 * 通义千问API OpenAI兼容模式测试脚本
 * 这个脚本用于测试通义千问API的OpenAI兼容模式
 */

const axios = require('axios');
const dotenv = require('dotenv');
const readline = require('readline');

// 加载环境变量
dotenv.config();

// 配置API密钥
const DASHSCOPE_API_KEY = process.env.REACT_APP_DASHSCOPE_API_KEY;

// 如果API密钥未配置，则无法继续
if (!DASHSCOPE_API_KEY) {
  console.error('错误: 未设置通义千问API密钥。请在.env文件中设置REACT_APP_DASHSCOPE_API_KEY');
  process.exit(1);
}

// API端点 (OpenAI兼容接口)
const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

/**
 * 向通义千问发送问题并获取回答 (使用OpenAI兼容模式)
 * @param {string} question 用户问题
 * @returns {Promise<string>} 模型回答
 */
async function askQwenOpenAIMode(question) {
  try {
    console.log(`发送问题到通义千问 (OpenAI兼容模式): "${question}"`);
    
    const requestData = {
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: '你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.7,
      top_p: 0.8
    };
    
    // 发送请求到API
    const response = await axios.post(API_ENDPOINT, requestData, {
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
    
    // 根据调试结果修改提取内容的逻辑
    if (responseData.choices && 
        responseData.choices.length > 0 &&
        responseData.choices[0].message &&
        responseData.choices[0].message.content) {
      return responseData.choices[0].message.content;
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
 * 创建命令行交互界面
 */
function createInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('=== 通义千问API (OpenAI兼容模式) 测试工具 ===');
  console.log('输入你的问题，或输入"exit"退出');
  
  function promptQuestion() {
    rl.question('> ', async (input) => {
      // 检查是否退出
      if (input.toLowerCase() === 'exit') {
        console.log('再见!');
        rl.close();
        return;
      }
      
      try {
        // 发送问题到API
        const answer = await askQwenOpenAIMode(input);
        console.log('\n回答:');
        console.log(answer);
        console.log('\n');
      } catch (error) {
        console.error(`错误: ${error.message}`);
      }
      
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
    // 测试API连接
    console.log('测试通义千问API (OpenAI兼容模式) 连接...');
    const testAnswer = await askQwenOpenAIMode('你好，请简单自我介绍');
    console.log('API连接测试成功! 回答:');
    console.log(testAnswer);
    console.log('\n开始交互模式...\n');
    
    // 启动交互界面
    createInterface();
  } catch (error) {
    console.error(`初始化测试失败: ${error.message}`);
    process.exit(1);
  }
}

// 启动测试
runTest(); 