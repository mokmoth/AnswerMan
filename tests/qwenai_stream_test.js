/**
 * 通义千问API 流式输出(SSE)测试脚本
 * 这个脚本用于测试通义千问API的流式输出功能
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

// API端点 (使用OpenAI兼容接口进行流式输出测试)
const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

/**
 * 向通义千问发送问题并获取流式回答
 * @param {string} question 用户问题
 * @param {function} onChunk 处理每个数据块的回调函数
 * @returns {Promise<string>} 完整回答
 */
async function askQwenStream(question, onChunk) {
  try {
    console.log(`发送问题到通义千问 (流式输出): "${question}"`);
    
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
      top_p: 0.8,
      stream: true
    };
    
    // 发送请求到API并获取流式响应
    const response = await axios.post(API_ENDPOINT, requestData, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
      let fullAnswer = '';
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
            if (json.choices && json.choices.length > 0) {
              const delta = json.choices[0].delta;
              const content = delta.content || '';
              
              if (content) {
                fullAnswer += content;
                onChunk(content);
              }
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
              
              if (json.choices && json.choices.length > 0) {
                const delta = json.choices[0].delta;
                const content = delta.content || '';
                
                if (content) {
                  fullAnswer += content;
                  onChunk(content);
                }
              }
            } catch (error) {
              // 忽略最后可能不完整的数据
            }
          }
        }
        
        console.log('\n流式响应结束');
        resolve(fullAnswer);
      });
      
      response.data.on('error', (error) => {
        reject(error);
      });
    });
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
  
  console.log('=== 通义千问API 流式输出测试工具 ===');
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
        // 打印回答标题
        process.stdout.write('\n回答: ');
        
        // 设置流式输出回调
        const onChunk = (chunk) => {
          process.stdout.write(chunk);
        };
        
        // 发送问题到API并处理流式响应
        await askQwenStream(input, onChunk);
        
        // 添加空行
        console.log('\n');
      } catch (error) {
        console.error(`\n错误: ${error.message}`);
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
    console.log('测试通义千问API流式输出连接...');
    
    // 设置流式输出回调
    let testResponse = '';
    const onChunk = (chunk) => {
      process.stdout.write(chunk);
      testResponse += chunk;
    };
    
    process.stdout.write('模型回答: ');
    
    // 发送测试问题
    await askQwenStream('你好，请简单自我介绍', onChunk);
    
    console.log('\n\nAPI连接测试成功!');
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