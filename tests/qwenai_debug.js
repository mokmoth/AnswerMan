/**
 * 通义千问API调试脚本
 * 用于打印API完整响应并诊断问题
 */

const axios = require('axios');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 配置API密钥
const DASHSCOPE_API_KEY = process.env.REACT_APP_DASHSCOPE_API_KEY;

// 如果API密钥未配置，则无法继续
if (!DASHSCOPE_API_KEY) {
  console.error('错误: 未设置通义千问API密钥。请在.env文件中设置REACT_APP_DASHSCOPE_API_KEY');
  process.exit(1);
}

console.log('API密钥:', DASHSCOPE_API_KEY);

// 使用原生API格式的请求
async function testNativeAPI() {
  console.log('------ 测试原生API格式 ------');
  const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  
  try {
    const requestData = {
      model: 'qwen-plus',
      input: {
        messages: [
          {
            role: 'system',
            content: '你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'
          },
          {
            role: 'user',
            content: '你好，请简单自我介绍'
          }
        ]
      },
      parameters: {
        result_format: 'message'
      }
    };
    
    console.log('请求数据:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(API_ENDPOINT, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('响应状态:', response.status);
    console.log('响应头:', JSON.stringify(response.headers, null, 2));
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('API错误:', error);
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// 使用OpenAI兼容模式的请求
async function testCompatibleAPI() {
  console.log('------ 测试OpenAI兼容模式 ------');
  const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    const requestData = {
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: '你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'
        },
        {
          role: 'user',
          content: '你好，请简单自我介绍'
        }
      ],
      temperature: 0.7,
      top_p: 0.8
    };
    
    console.log('请求数据:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(API_ENDPOINT, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('响应状态:', response.status);
    console.log('响应头:', JSON.stringify(response.headers, null, 2));
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('API错误:', error);
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// 执行测试
async function runTests() {
  try {
    console.log('开始通义千问API调试测试...');
    
    // 分别测试两种API格式
    await testNativeAPI();
    console.log('\n');
    await testCompatibleAPI();
    
    console.log('\nAPI测试完成');
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 启动测试
runTests(); 