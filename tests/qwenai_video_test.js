/**
 * 通义千问API视频理解测试脚本
 * 用于测试通义千问API的视频理解功能
 */

const axios = require('axios');
const dotenv = require('dotenv');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// 加载环境变量
dotenv.config();

// 配置API密钥 - 使用提供的API KEY
const DASHSCOPE_API_KEY = process.env.REACT_APP_DASHSCOPE_API_KEY || 'sk-ab28383c152140a294482e3bd3b69995';

// API端点 (OpenAI兼容接口)
const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// 使用Omni模型
const MODEL = 'qwen-omni-turbo-2025-01-19';

/**
 * 将视频文件转换为Base64编码
 * @param {string} videoPath 视频文件路径
 * @returns {Promise<string>} Base64编码的视频
 */
function videoToBase64(videoPath) {
  try {
    const videoBuffer = fs.readFileSync(videoPath);
    const base64Video = videoBuffer.toString('base64');
    return base64Video;
  } catch (error) {
    console.error(`视频文件读取错误: ${error.message}`);
    throw new Error(`无法读取视频文件: ${error.message}`);
  }
}

/**
 * 向通义千问发送视频和问题
 * @param {string} videoPath 视频文件路径
 * @param {string} question 用户问题
 * @returns {Promise<string>} 模型回答
 */
async function askQwenWithVideo(videoPath, question) {
  try {
    console.log(`正在处理视频: ${videoPath}`);
    console.log(`发送问题: "${question}"`);
    
    // 获取视频格式
    const videoFormat = path.extname(videoPath).substring(1).toLowerCase();
    
    // 将视频转换为Base64
    const base64Video = videoToBase64(videoPath);
    console.log(`视频转换为Base64完成, 大小: ${Math.round(base64Video.length / 1024)} KB`);
    
    const requestData = {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: '你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: `data:video/${videoFormat};base64,${base64Video}`
              }
            },
            {
              type: 'text',
              text: question
            }
          ]
        }
      ],
      modalities: ["text"], // Omni模型必须指定输出模态
      stream: true          // Omni模型必须使用流式输出
    };
    
    // 发送请求到API
    console.log('正在发送请求到通义千问API...');
    const response = await axios.post(API_ENDPOINT, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream' // 设置流式响应
    });
    
    // 处理流式响应
    return await processStreamResponse(response);
  } catch (error) {
    if (error.response) {
      // API返回了错误响应
      console.error('API错误:', {
        status: error.response.status,
        data: error.response.data
      });
      throw new Error(`API错误 (${error.response.status}): ${JSON.stringify(error.response.data)}`);
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
 * 向通义千问发送远程视频URL和问题
 * @param {string} videoUrl 视频URL
 * @param {string} question 用户问题
 * @returns {Promise<string>} 模型回答
 */
async function askQwenWithRemoteVideo(videoUrl, question) {
  try {
    console.log(`使用远程视频URL: ${videoUrl}`);
    console.log(`发送问题: "${question}"`);
    
    const requestData = {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: '你是通义千问，由阿里云开发的AI助手。请提供准确、有帮助的回答。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: videoUrl
              }
            },
            {
              type: 'text',
              text: question
            }
          ]
        }
      ],
      modalities: ["text"], // Omni模型必须指定输出模态
      stream: true          // Omni模型必须使用流式输出
    };
    
    // 发送请求到API
    console.log('正在发送请求到通义千问API...');
    const response = await axios.post(API_ENDPOINT, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream' // 设置流式响应
    });
    
    // 处理流式响应
    return await processStreamResponse(response);
  } catch (error) {
    if (error.response) {
      // API返回了错误响应
      console.error('API错误:', {
        status: error.response.status,
        data: error.response.data
      });
      throw new Error(`API错误 (${error.response.status}): ${JSON.stringify(error.response.data)}`);
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
 * 处理流式响应
 * @param {Object} response 流式响应对象
 * @returns {Promise<string>} 完整响应文本
 */
function processStreamResponse(response) {
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
          
          if (json.choices && json.choices.length > 0) {
            const delta = json.choices[0].delta;
            
            // 处理Omni模型的响应格式
            if (Array.isArray(delta.content)) {
              for (const item of delta.content) {
                if (item.type === 'text') {
                  content = item.text;
                  break;
                }
              }
            } else if (delta.content) {
              // 处理普通响应格式
              content = delta.content;
            } else if (delta.content === null && json.choices[0].finish_reason) {
              // 响应结束
              return;
            }
          }
          
          if (content) {
            fullResponse += content;
            // 实时打印内容
            process.stdout.write(content);
          }
        } catch (error) {
          console.error('解析SSE数据错误:', error);
        }
      }
    });
    
    response.data.on('end', () => {
      console.log('\n'); // 添加换行
      resolve(fullResponse);
    });
    
    response.data.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 创建命令行交互界面
 */
function createInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('=== 通义千问API视频理解测试工具 ===');
  console.log(`当前使用模型: ${MODEL}`);
  console.log('使用方法:');
  console.log('  local <视频路径> <问题>  - 使用本地视频文件进行测试');
  console.log('  remote <视频URL> <问题>  - 使用远程视频URL进行测试');
  console.log('  exit                    - 退出程序');
  console.log('\n示例:');
  console.log('  local ./videos/sample.mp4 "视频中发生了什么事件?"');
  console.log('  remote https://example.com/video.mp4 "描述一下视频的内容"');
  
  function promptCommand() {
    rl.question('\n> ', async (input) => {
      // 检查是否退出
      if (input.toLowerCase() === 'exit') {
        console.log('再见!');
        rl.close();
        return;
      }
      
      // 解析命令
      const parts = input.trim().split(' ');
      const command = parts[0].toLowerCase();
      
      try {
        if (command === 'local') {
          // 检查参数
          if (parts.length < 3) {
            console.error('错误: 请提供视频路径和问题');
            promptCommand();
            return;
          }
          
          const videoPath = parts[1];
          const question = parts.slice(2).join(' ');
          
          // 检查文件是否存在
          if (!fs.existsSync(videoPath)) {
            console.error(`错误: 找不到视频文件 "${videoPath}"`);
            promptCommand();
            return;
          }
          
          // 发送请求
          console.log('\n正在处理...');
          const answer = await askQwenWithVideo(videoPath, question);
          console.log('\n完整回答:');
          console.log(answer);
        }
        else if (command === 'remote') {
          // 检查参数
          if (parts.length < 3) {
            console.error('错误: 请提供视频URL和问题');
            promptCommand();
            return;
          }
          
          const videoUrl = parts[1];
          const question = parts.slice(2).join(' ');
          
          // 发送请求
          console.log('\n正在处理...');
          const answer = await askQwenWithRemoteVideo(videoUrl, question);
          console.log('\n完整回答:');
          console.log(answer);
        }
        else {
          console.error(`错误: 未知命令 "${command}". 可用命令: local, remote, exit`);
        }
      } catch (error) {
        console.error(`错误: ${error.message}`);
      }
      
      // 继续提问
      promptCommand();
    });
  }
  
  // 开始命令循环
  promptCommand();
}

/**
 * 测试通义千问API视频理解功能
 */
async function runTest() {
  try {
    console.log('===== 通义千问API视频理解测试 =====');
    console.log(`使用API KEY: ${DASHSCOPE_API_KEY.substring(0, 8)}...`);
    console.log(`使用模型: ${MODEL}`);
    
    // 使用示例视频进行测试
    const exampleVideoUrl = 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241115/cqqkru/1.mp4';
    console.log('使用示例视频进行测试...');
    console.log(`示例视频URL: ${exampleVideoUrl}`);
    
    const testQuestion = '这段视频的内容是什么?';
    console.log(`测试问题: "${testQuestion}"`);
    
    console.log('\n正在发送测试请求，请稍候...');
    const answer = await askQwenWithRemoteVideo(exampleVideoUrl, testQuestion);
    console.log('\n测试成功! 完整回答:');
    console.log(answer);
    
    console.log('\n开始交互模式...');
    createInterface();
  } catch (error) {
    console.error(`初始化测试失败: ${error.message}`);
    // 跳过初始测试，直接进入交互模式
    console.log('\n跳过初始测试，直接进入交互模式...');
    createInterface();
  }
}

// 启动测试
runTest(); 