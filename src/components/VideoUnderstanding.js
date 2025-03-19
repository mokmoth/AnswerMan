import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiChatService } from '../services/AIChatService';
import './VideoUnderstanding.css';
import PromptSettings from './PromptSettings/PromptSettings';
import DebugPanel from './DebugPanel';

/**
 * 视频理解组件
 * 集成视频播放器和通义千问聊天功能，实现视频理解和多轮对话
 */
const VideoUnderstanding = () => {
  // 状态
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('请上传视频开始分析');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiInitialized, setApiInitialized] = useState(false);
  const [videoSize, setVideoSize] = useState(0);
  const [keyFrames, setKeyFrames] = useState([]);
  const [keyFramesBase64, setKeyFramesBase64] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const [subtitles, setSubtitles] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  
  // 新增状态
  const [transcriptFile, setTranscriptFile] = useState(null); // 文稿文件
  const [transcriptContent, setTranscriptContent] = useState(''); // 文稿内容
  const [transcriptFileName, setTranscriptFileName] = useState(''); // 文稿文件名
  
  // 添加关键帧提取方式相关的状态
  const [frameExtractionMode, setFrameExtractionMode] = useState('none'); // 'none', 'interval', 'subtitle'
  const [frameInterval, setFrameInterval] = useState(5); // 默认5秒提取一帧
  const [extractedFrames, setExtractedFrames] = useState([]); // 提取的全部帧
  const [selectedFrameIndices, setSelectedFrameIndices] = useState([]); // 用户选择的帧索引
  const [isExtracting, setIsExtracting] = useState(false); // 是否正在提取帧
  const [showFrameSelector, setShowFrameSelector] = useState(false); // 是否显示帧选择界面
  
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [promptSettings, setPromptSettings] = useState({
    systemPrompt: '你是视频理解助手，正在分析用户上传的视频。请根据视频内容回答用户问题。',
    videoPrompt: '正在分析视频：${videoName}。当前视频播放时间: ${currentTime}',
    subtitlePrompt: '视频字幕内容: ${subtitles}',
    keyframePrompt: '这些是视频的${frameCount}个关键帧，请根据这些关键帧回答用户问题。',
    userVariables: {}
  });
  
  // 引用
  const videoInputRef = useRef(null);
  const subtitleInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameIntervalInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const transcriptInputRef = useRef(null); // 新增文稿上传引用

  // 关键帧提取配置
  const MIN_FRAMES = 4;  // 至少需要4张图片
  const MAX_FRAMES = 80; // 最多提取80帧，增加上限
  const FRAME_QUALITY = 0.6; // JPEG压缩质量

  // 添加图片上传相关状态
  const [inputImage, setInputImage] = useState(null); // 保存用户输入的图片
  const [inputImageB64, setInputImageB64] = useState(null); // Base64格式的图片

  // 添加模型信息状态
  const [modelInfo, setModelInfo] = useState('通义千问');

  // 新增调试面板状态
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // 初始化API
  useEffect(() => {
    const apiKey = process.env.REACT_APP_DASHSCOPE_API_KEY;
    if (apiKey) {
      try {
        const initResult = aiChatService.init({
          apiKey,
          defaultModel: 'qwen-omni-turbo-2025-01-19',
          useCompatibleMode: true
        });
        
        if (initResult) {
          console.log('通义千问API初始化成功');
          setApiInitialized(true);
          setMessages([{ 
            role: 'system', 
            content: '视频理解助手已准备就绪，请上传视频开始分析。' 
          }]);
        }
      } catch (err) {
        setError('API初始化失败: ' + err.message);
      }
    } else {
      setError('未找到API密钥，请在.env文件中设置REACT_APP_DASHSCOPE_API_KEY');
    }
  }, []);
  
  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 确保视频元素已正确初始化
  useEffect(() => {
    // 检查视频元素是否已正确挂载
    if (!videoRef.current) {
      console.warn('视频元素不存在或未正确初始化');
    } else {
      console.log('视频元素已初始化', videoRef.current);
      
      // 添加视频元素事件监听器，监控视频元素状态
      const videoEl = videoRef.current;
      
      const handleVideoError = (e) => {
        console.error('视频元素发生错误:', e);
      };
      
      videoEl.addEventListener('error', handleVideoError);
      
      // 清理函数
      return () => {
        videoEl.removeEventListener('error', handleVideoError);
      };
    }
  }, []);
  
  // 当视频URL改变时更新视频元素
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      // 确保清理之前的事件处理器
      const videoEl = videoRef.current;
      videoEl.onloadeddata = null;
      videoEl.oncanplay = null;
      videoEl.onerror = null;
      
      // 设置新的src并加载
      videoEl.src = videoUrl;
      
      // 在某些浏览器中，特别是移动浏览器，需要主动设置crossOrigin
      videoEl.crossOrigin = "anonymous";
      
      // 设置预加载策略，告诉浏览器需要完整加载视频
      videoEl.preload = "auto";
      
      try {
        // 对于某些浏览器，如Edge，可能需要延迟加载以确保DOM完全更新
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.load();
            console.log('视频URL更新后已重新加载', videoUrl);
          }
        }, 100);
      } catch (e) {
        console.error('视频加载出错:', e);
      }
    }
  }, [videoUrl]);
  
  /**
   * 提取视频关键帧
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @returns {Promise<Array>} - 提取的关键帧数组，每个元素是base64编码的图片
   */
  const extractKeyFrames = (videoElement) => {
    return new Promise((resolve, reject) => {
      try {
        // 确保视频已准备就绪
        if (videoElement.readyState < 2) {
          console.warn('视频未完全加载，尝试等待加载');
          videoElement.currentTime = 0;
        }
        
        // 创建canvas用于绘制视频帧
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 获取视频时长和尺寸
        const duration = videoElement.duration;
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;
        
        // 检查视频是否正确加载
        if (!duration || !width || !height || isNaN(duration)) {
          console.error('视频参数检查失败:', { duration, width, height });
          throw new Error('视频未正确加载，请检查视频格式或重新上传');
        }
        
        // 设置canvas尺寸
        canvas.width = width > 1280 ? 1280 : width; // 限制最大宽度
        canvas.height = height * (canvas.width / width); // 保持宽高比
        
        const frames = [];
        const framesBase64 = [];
        
        // 计算需要提取的帧数和间隔
        const targetFrameCount = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.ceil(duration)));
        const timeInterval = duration / targetFrameCount;
        let currentFrame = 0;
        let errorCount = 0;
        const MAX_ERRORS = 3; // 最大错误重试次数
        
        // 设置状态消息
        setMessage(`正在提取视频关键帧 (0/${targetFrameCount})...`);
        setFrameCount(targetFrameCount);
        
        // 添加超时保护
        let seekTimeout;
        
        // 清理事件监听器的函数
        const cleanupListeners = () => {
          if (seekTimeout) {
            clearTimeout(seekTimeout);
          }
          videoElement.onseeked = null;
          videoElement.onerror = null;
        };
        
        // 捕获帧的函数
        const captureFrame = (time) => {
          // 日志当前状态
          console.log(`正在提取第${currentFrame + 1}/${targetFrameCount}帧，时间点: ${time.toFixed(2)}秒`);
          
          // 添加超时保护，防止seek事件不触发
          if (seekTimeout) {
            clearTimeout(seekTimeout);
          }
          
          seekTimeout = setTimeout(() => {
            console.warn(`视频seek超时，当前帧: ${currentFrame}，时间: ${time}，重试中...`);
            errorCount++;
            
            if (errorCount > MAX_ERRORS) {
              cleanupListeners();
              if (frames.length >= MIN_FRAMES) {
                // 如果已经有足够的帧，就使用现有的
                console.warn(`提取帧过程中出现多次错误，但已提取了${frames.length}帧，继续使用这些帧`);
                setKeyFrames(frames);
                setKeyFramesBase64(framesBase64);
                setMessage(`提取关键帧部分成功 (${frames.length}/${targetFrameCount})，可能影响分析效果`);
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('视频帧提取失败，请重新上传或尝试其他视频'));
              }
            } else {
              // 尝试再次设置当前时间
              try {
                // 如果视频状态不佳，尝试暂停一下再继续
                if (videoElement.paused) {
                  videoElement.play().then(() => {
                    videoElement.pause();
                    videoElement.currentTime = time;
                  }).catch(e => {
                    console.error('视频播放失败:', e);
                    videoElement.currentTime = time;
                  });
                } else {
                  videoElement.currentTime = time;
                }
              } catch (e) {
                console.error('设置视频时间失败:', e);
                // 尝试跳到下一帧
                currentFrame++;
                if (currentFrame < targetFrameCount) {
                  captureFrame(Math.min(duration - 0.1, (currentFrame) * timeInterval));
                } else {
                  // 已经是最后一帧，尝试结束
                  if (frames.length >= MIN_FRAMES) {
                    resolve({ frames, framesBase64 });
                  } else {
                    reject(new Error('无法提取足够的关键帧'));
                  }
                }
              }
            }
          }, 8000); // 增加超时到8秒
          
          // 设置视频时间
          try {
            videoElement.currentTime = time;
          } catch (e) {
            console.error('设置视频时间出错:', e);
            clearTimeout(seekTimeout);
            
            // 尝试进行错误恢复
            errorCount++;
            if (errorCount > MAX_ERRORS) {
              if (frames.length >= MIN_FRAMES) {
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('设置视频时间失败'));
              }
            } else {
              // 尝试暂停视频后再设置时间
              videoElement.pause();
              setTimeout(() => {
                try {
                  videoElement.currentTime = time;
                } catch (e2) {
                  console.error('第二次设置视频时间失败:', e2);
                  // 尝试跳到下一帧
                  currentFrame++;
                  if (currentFrame < targetFrameCount) {
                    captureFrame(Math.min(duration - 0.1, (currentFrame) * timeInterval));
                  } else if (frames.length >= MIN_FRAMES) {
                    resolve({ frames, framesBase64 });
                  } else {
                    reject(new Error('无法提取足够的关键帧'));
                  }
                }
              }, 500);
            }
          }
        };
        
        // 视频错误处理
        videoElement.onerror = (e) => {
          cleanupListeners();
          console.error('视频播放错误:', e);
          reject(new Error('视频播放错误，请检查视频格式或重新上传'));
        };
        
        // 时间更新时捕获帧
        videoElement.onseeked = () => {
          try {
            // 清除超时
            if (seekTimeout) {
              clearTimeout(seekTimeout);
              seekTimeout = null;
            }
            
            // 绘制当前帧到canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // 转为base64
            const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY);
            const frameBase64 = dataUrl.split(',')[1]; // 移除data:image/jpeg;base64,前缀
            
            // 检查base64数据是否有效
            if (!frameBase64 || frameBase64.length < 100) {
              throw new Error('帧数据无效');
            }
            
            // 创建Blob用于预览
            const frameUrl = URL.createObjectURL(
              new Blob([new Uint8Array(atob(frameBase64).split('').map(c => c.charCodeAt(0)))], 
              {type: 'image/jpeg'})
            );
            
            frames.push(frameUrl);
            framesBase64.push(frameBase64);
            
            currentFrame++;
            setMessage(`正在提取视频关键帧 (${currentFrame}/${targetFrameCount})...`);
            
            // 如果已经提取完所有帧
            if (currentFrame >= targetFrameCount) {
              console.log(`完成提取${frames.length}个关键帧`);
              cleanupListeners();
              setKeyFrames(frames);
              setKeyFramesBase64(framesBase64);
              setMessage(`成功提取 ${frames.length} 帧关键画面`);
              resolve({ frames, framesBase64 });
            } else {
              // 在提取下一帧前添加短暂延迟，避免浏览器资源紧张
              setTimeout(() => {
                // 提取下一帧
                captureFrame(Math.min(duration - 0.1, (currentFrame) * timeInterval));
              }, 100);
            }
          } catch (frameError) {
            console.error('处理帧时出错:', frameError);
            errorCount++;
            
            if (errorCount > MAX_ERRORS) {
              cleanupListeners();
              if (frames.length >= MIN_FRAMES) {
                // 如果已经有足够的帧，就使用现有的
                console.warn(`处理帧过程中出现多次错误，但已提取了${frames.length}帧，继续使用这些帧`);
                setKeyFrames(frames);
                setKeyFramesBase64(framesBase64);
                setMessage(`提取关键帧部分成功 (${frames.length}/${targetFrameCount})，可能影响分析效果`);
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('处理视频帧失败，请重新上传或尝试其他视频'));
              }
            } else {
              // 跳到下一帧
              currentFrame++;
              setTimeout(() => {
                captureFrame(Math.min(duration - 0.1, (currentFrame) * timeInterval));
              }, 100);
            }
          }
        };
        
        // 确保视频已暂停
        videoElement.pause();
        
        // 重置视频时间到开头
        videoElement.currentTime = 0;
        
        // 添加短暂延迟，确保视频引擎已准备好
        setTimeout(() => {
          // 开始提取第一帧
          captureFrame(0);
        }, 500);
        
      } catch (err) {
        console.error('关键帧提取初始化错误:', err);
        reject(err);
      }
    });
  };
  
  // 处理视频文件选择
  const handleVideoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // 检查文件类型
      const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
      if (!validVideoTypes.includes(file.type)) {
        setError(`不支持的视频格式: ${file.type}，请使用MP4、WebM或其他常见格式`);
        return;
      }
      
      // 检查原始文件大小
      if (file.size > 150 * 1024 * 1024) {
        setError('视频文件太大，最大支持150MB');
        return;
      }
      
      setIsLoading(true);
      setMessage('正在加载视频文件...');
      
      // 清除旧的关键帧和数据
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl); // 释放旧的URL
      }
      keyFrames.forEach(url => URL.revokeObjectURL(url)); // 释放所有关键帧URL
      
      // 重置状态
      setKeyFrames([]);
      setKeyFramesBase64([]);
      setExtractedFrames([]);
      setSelectedFrameIndices([]);
      setFrameExtractionMode('none');
      setShowFrameSelector(false);
      setError(null);
      
      // 创建预览URL并设置到状态中
      console.log('创建文件URL:', file.name, file.type, file.size);
      const previewUrl = URL.createObjectURL(file);
      setVideoUrl(previewUrl);
      setVideoFile(file);
      setVideoSize(file.size);
      
      // 设置加载提示更新器
      let loadingProgressTimer = setInterval(() => {
        if (videoRef.current) {
          const progress = Math.min(100, Math.round((videoRef.current.readyState / 4) * 100));
          setMessage(`视频加载中... ${progress}%`);
        }
      }, 500);
      
      // 使用HTML5 Video元素API加载视频
      console.log('等待DOM更新和视频元素加载...');
      
      // 使用Promise和setTimeout确保DOM已更新且视频元素可用
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!videoRef.current) {
        console.error('视频元素不存在，无法加载视频');
        clearInterval(loadingProgressTimer);
        setError('视频元素初始化失败，请刷新页面重试');
        setIsLoading(false);
        return;
      }
      
      console.log('视频元素状态:', {
        videoElement: videoRef.current,
        readyState: videoRef.current.readyState,
        src: videoRef.current.src,
        networkState: videoRef.current.networkState
      });
      
      // 使用Promise等待视频加载完成
      try {
        await new Promise((resolve, reject) => {
          const videoElement = videoRef.current;
          
          // 设置加载超时 - 增加到60秒，特别是对于大型视频文件
          const timeoutId = setTimeout(() => {
            console.warn('视频加载超时 (60秒)，可能是由于视频较大或网络问题');
            reject(new Error('视频加载超时，请检查网络连接或尝试其他视频'));
          }, 60000); // 增加到60秒
          
          // 监听更多的加载事件，确保不会错过加载完成信号
          const handleAnyLoadEvent = () => {
            console.log('视频加载事件触发:', {
              readyState: videoElement.readyState,
              duration: videoElement.duration,
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight
            });
            
            // 如果视频已经加载了足够的数据
            if (videoElement.readyState >= 2 && 
                videoElement.duration && 
                videoElement.videoWidth && 
                videoElement.videoHeight) {
              console.log('视频数据已足够，继续处理');
              clearTimeout(timeoutId);
              resolve();
            }
          };
          
          // 监听加载完成事件
          const handleLoaded = () => {
            console.log('视频loadeddata事件触发');
            handleAnyLoadEvent();
          };
          
          // 监听可播放事件
          const handleCanPlay = () => {
            console.log('视频canplay事件触发');
            handleAnyLoadEvent();
          };
          
          // 监听元数据加载事件
          const handleLoadedMetadata = () => {
            console.log('视频loadedmetadata事件触发');
            handleAnyLoadEvent();
          };
          
          // 监听进度事件，检查是否已缓冲足够数据
          const handleProgress = () => {
            if (videoElement.buffered.length > 0) {
              const bufferedEnd = videoElement.buffered.end(0);
              const duration = videoElement.duration;
              console.log(`视频已缓冲: ${Math.round(bufferedEnd / duration * 100)}%`);
              
              // 如果缓冲了至少10秒或50%的视频，我们认为可以开始处理
              if (bufferedEnd >= 10 || bufferedEnd / duration >= 0.5) {
                console.log('视频已缓冲足够数据，继续处理');
                handleAnyLoadEvent();
              }
            }
          };
          
          // 监听错误事件
          const handleError = (e) => {
            console.error('视频加载出错:', e, videoElement.error);
            clearTimeout(timeoutId);
            reject(new Error(`视频加载失败: ${videoElement.error ? videoElement.error.message : '未知错误'}`));
          };
          
          // 添加事件监听器
          videoElement.addEventListener('loadeddata', handleLoaded);
          videoElement.addEventListener('canplay', handleCanPlay);
          videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.addEventListener('progress', handleProgress);
          videoElement.addEventListener('error', handleError);
          
          // 设置清理函数
          const cleanup = () => {
            videoElement.removeEventListener('loadeddata', handleLoaded);
            videoElement.removeEventListener('canplay', handleCanPlay);
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.removeEventListener('progress', handleProgress);
            videoElement.removeEventListener('error', handleError);
          };
          
          // 在Promise解决时清理事件
          Promise.resolve().then(() => {
            // 添加到Promise链以确保清理会执行
            return () => cleanup();
          });
          
          // 立即检查视频状态 - 如果已经加载过了，可能事件已经触发过
          if (videoElement.readyState >= 2 && 
              videoElement.duration && 
              videoElement.videoWidth && 
              videoElement.videoHeight) {
            console.log('视频已经准备好，无需等待事件');
            clearTimeout(timeoutId);
            resolve();
          }
          
          // 手动触发一次进度检查
          handleProgress();
        });
        
        clearInterval(loadingProgressTimer);
        
        // 视频已加载完成
        if (!videoRef.current || !videoRef.current.videoWidth) {
          throw new Error('视频加载后数据无效，请尝试其他视频格式');
        }
        
        const video = videoRef.current;
        console.log('视频就绪:', {
          duration: video.duration,
          dimensions: `${video.videoWidth}x${video.videoHeight}`,
          readyState: video.readyState
        });
        
        setMessage(`视频加载完成（视频时长: ${Math.round(video.duration)}秒）。请选择提取关键帧的方式。`);
        
        // 确保视频位于开头位置
        video.currentTime = 0;
        
        // 添加消息
        setMessages(prev => [...prev, {
          role: 'system',
          content: `视频已上传: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB), 时长: ${Math.round(video.duration)}秒`
        }]);
        
      } catch (videoError) {
        console.error('视频处理错误:', videoError);
        setError(`视频处理错误: ${videoError.message}`);
      } finally {
        clearInterval(loadingProgressTimer);
        setIsLoading(false);
      }
      
    } catch (error) {
      console.error('视频上传错误:', error);
      setError(`视频上传错误: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // 处理字幕文件选择
  const handleSubtitleSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // 读取字幕文件
      const text = await file.text();
      
      // 导入字幕解析函数
      const { parseSRT } = await import('../utils/subtitleParser');
      
      // 解析字幕内容
      const parsedSubtitles = parseSRT(text);
      
      if (parsedSubtitles && parsedSubtitles.length > 0) {
        // 设置字幕到本地状态
        setSubtitles(parsedSubtitles);
        
        // 设置字幕到服务
        aiChatService.setSubtitles(parsedSubtitles);
        
        setMessage(`成功解析字幕文件: ${file.name}，共 ${parsedSubtitles.length} 条字幕`);
        
        // 添加消息
        setMessages(prev => [...prev, {
          role: 'system',
          content: `字幕已上传: ${file.name} (${parsedSubtitles.length} 条字幕)`
        }]);
      } else {
        setError(`字幕解析失败: 未找到有效字幕`);
      }
      
      setError(null);
    } catch (error) {
      console.error('字幕处理错误:', error);
      setError(`字幕处理错误: ${error.message}`);
    }
  };
  
  // 处理视频时间更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  
  // 处理点击字幕跳转
  const handleSubtitleClick = (startTime) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      // 如果视频暂停中，自动开始播放
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => console.error('播放失败:', e));
      }
    }
  };
  
  // 清除视频
  const handleClearVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    
    // 清除关键帧URL
    keyFrames.forEach(url => URL.revokeObjectURL(url));
    
    // 清除字幕和视频相关数据
    aiChatService.clearVideoData();
    setSubtitles([]);
    
    setVideoFile(null);
    setVideoUrl(null);
    setKeyFrames([]);
    setKeyFramesBase64([]);
    setVideoSize(0);
    setMessage('视频已清除，请重新上传视频开始分析');
  };
  
  // 格式化时间（秒转为 MM:SS 格式）
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 添加timeupdate事件监听
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
      return () => {
        videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [videoUrl]); // 当视频URL变化时重新设置监听器
  
  // 字幕区域JSX部分（添加到视频区域渲染部分之后）
  const renderSubtitlesSection = () => {
    if (!subtitles || subtitles.length === 0) return null;

    return (
      <div style={{ 
        marginTop: '15px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
        maxHeight: keyFrames.length > 0 ? '150px' : '250px'
      }}>
        <div style={{
          padding: '10px 15px',
          backgroundColor: '#edf2f7',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#2d3748' }}>
            字幕 ({subtitles.length})
          </h3>
          <span style={{ fontSize: '13px', color: '#718096' }}>
            点击字幕可跳转到对应时间点
          </span>
        </div>
        
        <div style={{
          height: keyFrames.length > 0 ? '120px' : '220px',
          overflowY: 'auto',
          padding: '10px'
        }}>
          {subtitles.map((subtitle, index) => (
            <div 
              key={index}
              onClick={() => handleSubtitleClick(subtitle.startTime)}
              style={{
                padding: '8px 12px',
                margin: '4px 0',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 
                  currentTime >= subtitle.startTime && currentTime <= subtitle.endTime 
                    ? '#e6f7ff' 
                    : 'transparent',
                border: 
                  currentTime >= subtitle.startTime && currentTime <= subtitle.endTime 
                    ? '1px solid #91d5ff' 
                    : '1px solid transparent',
                transition: 'background-color 0.2s ease',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentTime >= subtitle.startTime && currentTime <= subtitle.endTime ? '#e6f7ff' : '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = currentTime >= subtitle.startTime && currentTime <= subtitle.endTime ? '#e6f7ff' : 'transparent'}
            >
              <span style={{ 
                minWidth: '50px', 
                color: '#718096', 
                fontSize: '13px', 
                marginRight: '10px'
              }}>
                {formatTime(subtitle.startTime)}
              </span>
              <span style={{ flex: 1, fontSize: '14px' }}>
                {subtitle.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // 处理图片上传
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) { // 10MB
          setError('图片大小不能超过10MB');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageDataUrl = e.target.result;
          setInputImage(imageDataUrl);
          // 提取Base64部分
          const base64Data = imageDataUrl.split(',')[1];
          setInputImageB64(base64Data);
        };
        reader.readAsDataURL(file);
      } else {
        setError('请上传图片格式的文件');
      }
    }
  };

  // 处理粘贴事件
  const handlePaste = (event) => {
    const items = (event.clipboardData || window.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob.size > 10 * 1024 * 1024) { // 10MB
          setError('图片大小不能超过10MB');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageDataUrl = e.target.result;
          setInputImage(imageDataUrl);
          // 提取Base64部分
          const base64Data = imageDataUrl.split(',')[1];
          setInputImageB64(base64Data);
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  // 移除已上传的图片
  const handleRemoveImage = () => {
    setInputImage(null);
    setInputImageB64(null);
  };
  
  // 加载提示词设置
  useEffect(() => {
    const loadPromptSettings = () => {
      const savedSystemPrompt = localStorage.getItem('systemPrompt');
      const savedVideoPrompt = localStorage.getItem('videoPrompt');
      const savedSubtitlePrompt = localStorage.getItem('subtitlePrompt');
      const savedKeyframePrompt = localStorage.getItem('keyframePrompt');
      
      // 加载用户变量
      const userVariables = {
        grade: localStorage.getItem('userVar_grade') || '初中',
        subject: localStorage.getItem('userVar_subject') || '数学',
        chapter: localStorage.getItem('userVar_chapter') || '',
        section: localStorage.getItem('userVar_section') || '',
        subsection: localStorage.getItem('userVar_subsection') || '',
        knowledgePoint: localStorage.getItem('userVar_knowledgePoint') || ''
      };
      
      const settings = {
        systemPrompt: savedSystemPrompt || promptSettings.systemPrompt,
        videoPrompt: savedVideoPrompt || promptSettings.videoPrompt,
        subtitlePrompt: savedSubtitlePrompt || promptSettings.subtitlePrompt,
        keyframePrompt: savedKeyframePrompt || promptSettings.keyframePrompt,
        userVariables: userVariables
      };
      
      setPromptSettings(settings);
    };
    
    loadPromptSettings();
  }, []);
  
  // 保存提示词设置
  const handleSavePromptSettings = (settings) => {
    console.log('保存提示词设置:', settings);
    
    // 保存到本地状态
    setPromptSettings(settings);
    
    // 同步保存到localStorage，确保所有变量都被持久化
    if (settings.userVariables) {
      const { grade, subject, chapter, section, subsection, knowledgePoint } = settings.userVariables;
      localStorage.setItem('userVar_grade', grade || '');
      localStorage.setItem('userVar_subject', subject || '');
      localStorage.setItem('userVar_chapter', chapter || '');
      localStorage.setItem('userVar_section', section || '');
      localStorage.setItem('userVar_subsection', subsection || '');
      localStorage.setItem('userVar_knowledgePoint', knowledgePoint || '');
    }
  };
  
  // 根据提示词模板和当前状态生成实际提示词
  const generateSystemPrompt = (template, variables) => {
    let prompt = template;
    
    // 替换视频相关变量
    Object.keys(variables).forEach(key => {
      prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), variables[key]);
    });
    
    // 替换用户自定义变量
    const userVariables = promptSettings.userVariables || {};
    Object.keys(userVariables).forEach(key => {
      const value = userVariables[key] || '';
      prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    });
    
    return prompt;
  };
  
  // 修改发送消息函数，添加图片处理逻辑和使用自定义提示词
  const handleSendMessage = async () => {
    if ((!input.trim() && !inputImage) || isLoading) return;
    
    // 记录是否有用户上传的图片
    const hasImage = Boolean(inputImage);
    let imageData = inputImageB64;
    
    // 处理用户输入内容
    let enhancedUserInput = input.trim();
    
    // 清空输入
    setInput('');
    setInputImage(null);
    setInputImageB64(null);
    
    // 添加用户消息到界面
    const userMessage = {
      role: 'user',
      content: enhancedUserInput,
      hasImage: hasImage,
      id: `user-${Date.now()}`
    };
    
    // 添加AI临时消息
    const assistantTempMessage = {
      role: 'assistant',
      content: '思考中...',
      id: `assistant-${Date.now()}`
    };
    
    // 更新消息列表，同时添加用户消息和AI临时消息
    setMessages(prevMessages => [...prevMessages, userMessage, assistantTempMessage]);
    
    // 设置加载状态
    setIsLoading(true);
    
    try {
      // 查找当前视频时间点附近的字幕
      const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
      const currentSubtitles = subtitles ? subtitles.filter(
        sub => currentTime >= sub.startTime - 2 && currentTime <= sub.endTime + 2
      ) : [];
      
      // 构建完整字幕文本
      const fullSubtitlesText = subtitles && subtitles.length > 0
        ? subtitles.map(sub => `[${formatTime(sub.startTime)}-${formatTime(sub.endTime)}] ${sub.text}`).join('\n')
        : '无可用字幕';
      
      // 构建变量对象
      const variables = {
        videoName: videoFile ? videoFile.name : '未知视频',
        currentTime: formatTime(currentTime),
        subtitles: currentSubtitles && currentSubtitles.length > 0 
          ? currentSubtitles.map(sub => sub.text).join(' ') 
          : '无可用字幕',
        fullSubtitles: fullSubtitlesText,
        transcript: transcriptContent || '未上传文稿',
        frameCount: keyFramesBase64 ? keyFramesBase64.length : 0
      };
      
      // 生成系统提示词
      const systemPromptText = generateSystemPrompt(promptSettings.systemPrompt, variables);
      
      // 添加视频信息提示词
      const videoPromptText = generateSystemPrompt(promptSettings.videoPrompt, variables);
      
      // 添加字幕提示词
      const subtitlePromptText = subtitles && subtitles.length > 0 
        ? generateSystemPrompt(promptSettings.subtitlePrompt, variables)
        : '';
      
      // 添加关键帧提示词
      const keyframePromptText = keyFramesBase64 && keyFramesBase64.length > 0
        ? generateSystemPrompt(promptSettings.keyframePrompt, variables)
        : '';
      
      // 合并所有提示词
      const enhancedSystemPrompt = `${systemPromptText}\n\n${videoPromptText}${
        subtitlePromptText ? '\n\n' + subtitlePromptText : ''
      }${
        keyframePromptText ? '\n\n' + keyframePromptText : ''
      }`;
      
      console.log('系统提示:', enhancedSystemPrompt);
      
      // 获取当前使用的服务名称
      const serviceName = aiChatService.getCurrentServiceName();
      const currentRound = aiChatService.getCurrentRound();
      let modelName = '通义千问';
      let statusText = '';
      let activeModel = 'qwen-omni-turbo-2025-01-19'; // 默认通义千问的模型

      if (serviceName === 'qwen') {
        modelName = '通义千问';
        activeModel = 'qwen-omni-turbo-2025-01-19'; // 通义千问使用Omni模型
        // 在第0轮是正常的，但在非第0轮可能是因为火山方舟不可用
        if (currentRound > 0 && !aiChatService._volcengineAvailable) {
          statusText = '（火山方舟不可用）';
        }
      } else if (serviceName === 'volcengine') {
        modelName = '火山方舟';
        activeModel = 'ep-20250207170747-dm2jv'; // 火山方舟使用的模型
      }
      
      setModelInfo(`${modelName}（第${currentRound + 1}轮对话）${statusText}`);
      
      // 存储正在构建的响应
      let responseText = "";
      
      // 构建onChunk回调函数，直接更新消息内容
      const onChunk = (chunk, context) => {
        // 检查是否已完成或出错
        if (context?.done || context?.error) {
          console.log('流式响应已完成或出错:', context);
          return;
        }
        
        if (chunk) {
          // 直接使用新的文本内容，避免累加造成重复
          const newContent = context?.fullText || (responseText + chunk);

          // 仅当内容变化时才更新状态
          if (newContent !== responseText) {
            responseText = newContent;
            
            // 使用函数形式的setState确保使用最新状态
            setMessages(prevMessages => {
              // 查找临时消息
              const messageIndex = prevMessages.findIndex(msg => msg.id === assistantTempMessage.id);
              if (messageIndex === -1) return prevMessages;
              
              // 复制消息数组
              const updatedMessages = [...prevMessages];
              
              // 只更新特定消息的内容
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                content: responseText
              };
              
              return updatedMessages;
            });
            
            // 滚动到底部
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      };
      
      // 准备聊天选项
      const chatOptions = {
        model: activeModel, // 使用当前活跃的模型，而不是硬编码
        systemPrompt: enhancedSystemPrompt,
        useHistory: true,
        stream: true,
        onChunk: onChunk
      };
      
      // 如果有用户上传的图片，添加到请求中
      if (hasImage && imageData) {
        chatOptions.images = [`data:image/jpeg;base64,${imageData}`];
        console.log('将用户上传的图片添加到对话API请求中');
      }
      
      // 使用提取的关键帧进行视频理解
      if (keyFramesBase64 && keyFramesBase64.length > 0) {
        const response = await aiChatService.understandVideoFrames(
          keyFramesBase64,
          enhancedUserInput,
          chatOptions
        );
        
        console.log('视频理解API响应:', response);
      } else {
        // 无关键帧时使用普通聊天
        console.log('发送普通聊天请求，参数:', {
          message: enhancedUserInput,
          systemPrompt: enhancedSystemPrompt,
          stream: true,
          onChunk: '函数对象'
        });
        
        const response = await aiChatService.chat({
          message: enhancedUserInput,
          systemPrompt: enhancedSystemPrompt,
          useHistory: true,
          stream: true,
          onChunk: onChunk,
          model: activeModel // 使用当前活跃的模型，而不是硬编码
        });
        
        console.log('聊天API响应:', response);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      
      // 显示错误信息
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          if (msg.id === assistantTempMessage.id) {
            return {
              ...msg,
              content: `出错了: ${error.message || '无法连接到AI服务，请重试'}`
            };
          }
          return msg;
        });
      });
      
      setError(`发送消息失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
      
      // 滚动到底部
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };
  
  // 提取关键帧处理函数 - 根据指定的时间间隔
  const extractFramesByInterval = async (intervalSeconds) => {
    if (!videoRef.current || !videoFile) {
      setError('没有可用的视频，请先上传视频');
      return;
    }
    
    setIsExtracting(true);
    setMessage('正在根据时间间隔提取关键帧...');
    
    try {
      const video = videoRef.current;
      const duration = video.duration;
      
      // 如果间隔太大，调整为更合理的值
      let interval = intervalSeconds;
      if (interval <= 0) interval = 5; // 默认5秒
      if (interval > duration / 2) interval = Math.max(5, Math.floor(duration / 10)); // 确保至少有几帧
      
      // 计算要提取的时间点数组
      const timePoints = [];
      for (let time = 0; time <= duration; time += interval) {
        timePoints.push(time);
      }
      
      // 确保至少有结束帧
      if (timePoints[timePoints.length - 1] < duration - interval / 2) {
        timePoints.push(duration - 0.1);
      }
      
      // 提取帧
      const extractedFrames = await extractMultipleFrames(video, timePoints);
      
      // 保存提取的帧
      setExtractedFrames(extractedFrames);
      setSelectedFrameIndices(extractedFrames.frames.map((_, i) => i)); // 默认选择所有帧
      
      // 显示帧选择界面
      setShowFrameSelector(true);
      setMessage(`已提取 ${extractedFrames.frames.length} 个关键帧（间隔 ${interval} 秒），请选择要使用的帧`);
    } catch (error) {
      console.error('按时间间隔提取帧失败:', error);
      setError(`提取关键帧失败: ${error.message}`);
    } finally {
      setIsExtracting(false);
    }
  };
  
  // 基于字幕提取关键帧
  const extractFramesBySubtitles = async () => {
    if (!videoRef.current || !videoFile) {
      setError('没有可用的视频，请先上传视频');
      return;
    }
    
    if (!subtitles || subtitles.length === 0) {
      setError('没有可用的字幕，请先上传字幕文件');
      return;
    }
    
    setIsExtracting(true);
    setMessage('正在根据字幕时间点提取关键帧...');
    
    try {
      const video = videoRef.current;
      
      // 从字幕中提取时间点
      const timePoints = subtitles.map(subtitle => subtitle.startTime);
      
      // 限制最大帧数
      let filteredTimePoints = timePoints;
      if (timePoints.length > MAX_FRAMES) {
        // 如果字幕过多，进行均匀采样
        const step = Math.ceil(timePoints.length / MAX_FRAMES);
        filteredTimePoints = timePoints.filter((_, index) => index % step === 0);
      }
      
      // 提取帧
      const extractedFrames = await extractMultipleFrames(video, filteredTimePoints);
      
      // 保存提取的帧
      setExtractedFrames(extractedFrames);
      setSelectedFrameIndices(extractedFrames.frames.map((_, i) => i)); // 默认选择所有帧
      
      // 显示帧选择界面
      setShowFrameSelector(true);
      setMessage(`已根据字幕提取 ${extractedFrames.frames.length} 个关键帧，请选择要使用的帧`);
    } catch (error) {
      console.error('按字幕提取帧失败:', error);
      setError(`提取关键帧失败: ${error.message}`);
    } finally {
      setIsExtracting(false);
    }
  };
  
  // 同时提取多个时间点的帧
  const extractMultipleFrames = async (videoElement, timePoints) => {
    return new Promise((resolve, reject) => {
      try {
        // 创建canvas用于绘制视频帧
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 获取视频尺寸
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;
        
        // 设置canvas尺寸
        canvas.width = width > 1280 ? 1280 : width; // 限制最大宽度
        canvas.height = height * (canvas.width / width); // 保持宽高比
        
        const frames = [];
        const framesBase64 = [];
        let currentIndex = 0;
        let errorCount = 0;
        const MAX_ERRORS = 3;
        
        // 设置超时保护
        let seekTimeout;
        
        // 清理函数
        const cleanupListeners = () => {
          if (seekTimeout) {
            clearTimeout(seekTimeout);
          }
          videoElement.onseeked = null;
          videoElement.onerror = null;
        };
        
        // 视频跳转到指定时间后捕获帧
        const captureFrame = (time) => {
          // 更新状态
          setMessage(`正在提取关键帧 (${currentIndex + 1}/${timePoints.length})...`);
          console.log(`提取帧 ${currentIndex + 1}/${timePoints.length}, 时间点: ${time.toFixed(2)}秒`);
          
          // 添加超时保护
          if (seekTimeout) clearTimeout(seekTimeout);
          
          seekTimeout = setTimeout(() => {
            console.warn(`视频跳转超时，当前帧: ${currentIndex}，时间: ${time}秒`);
            errorCount++;
            
            if (errorCount > MAX_ERRORS) {
              cleanupListeners();
              if (frames.length >= MIN_FRAMES) {
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('提取帧超时次数过多'));
              }
            } else {
              // 尝试跳到下一帧
              currentIndex++;
              if (currentIndex < timePoints.length) {
                captureFrame(timePoints[currentIndex]);
              } else if (frames.length >= MIN_FRAMES) {
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('无法提取足够的帧'));
              }
            }
          }, 5000);
          
          try {
            videoElement.currentTime = time;
          } catch (e) {
            console.error('设置视频时间失败:', e);
            clearTimeout(seekTimeout);
            
            // 尝试恢复
            errorCount++;
            if (errorCount > MAX_ERRORS) {
              if (frames.length >= MIN_FRAMES) {
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('设置视频时间失败次数过多'));
              }
            } else {
              // 跳到下一帧
              currentIndex++;
              setTimeout(() => {
                if (currentIndex < timePoints.length) {
                  captureFrame(timePoints[currentIndex]);
                } else if (frames.length > 0) {
                  resolve({ frames, framesBase64 });
                } else {
                  reject(new Error('无法提取任何帧'));
                }
              }, 100);
            }
          }
        };
        
        // 视频错误处理
        videoElement.onerror = (e) => {
          cleanupListeners();
          console.error('视频播放错误:', e);
          reject(new Error('视频播放错误'));
        };
        
        // 时间更新事件处理
        videoElement.onseeked = () => {
          try {
            // 清除超时
            if (seekTimeout) {
              clearTimeout(seekTimeout);
              seekTimeout = null;
            }
            
            // 绘制当前帧到canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // 转为base64
            const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY);
            const frameBase64 = dataUrl.split(',')[1]; // 移除前缀
            
            // 检查base64数据是否有效
            if (!frameBase64 || frameBase64.length < 100) {
              throw new Error('帧数据无效');
            }
            
            // 创建Blob URL用于预览
            const frameUrl = URL.createObjectURL(
              new Blob([new Uint8Array(atob(frameBase64).split('').map(c => c.charCodeAt(0)))], 
              {type: 'image/jpeg'})
            );
            
            frames.push(frameUrl);
            framesBase64.push(frameBase64);
            
            currentIndex++;
            
            // 提取下一帧或完成
            if (currentIndex >= timePoints.length) {
              console.log(`完成提取${frames.length}个关键帧`);
              cleanupListeners();
              resolve({ frames, framesBase64 });
            } else {
              // 短暂延迟后提取下一帧
              setTimeout(() => {
                captureFrame(timePoints[currentIndex]);
              }, 100);
            }
          } catch (frameError) {
            console.error('处理帧时出错:', frameError);
            errorCount++;
            
            if (errorCount > MAX_ERRORS) {
              cleanupListeners();
              if (frames.length >= MIN_FRAMES) {
                resolve({ frames, framesBase64 });
              } else {
                reject(new Error('处理视频帧失败次数过多'));
              }
            } else {
              // 跳到下一帧
              currentIndex++;
              setTimeout(() => {
                if (currentIndex < timePoints.length) {
                  captureFrame(timePoints[currentIndex]);
                } else if (frames.length > 0) {
                  resolve({ frames, framesBase64 });
                } else {
                  reject(new Error('无法提取任何帧'));
                }
              }, 100);
            }
          }
        };
        
        // 确保视频已暂停
        videoElement.pause();
        
        // 添加短暂延迟，确保视频引擎已准备好
        setTimeout(() => {
          // 开始提取第一帧
          if (timePoints.length > 0) {
            captureFrame(timePoints[0]);
          } else {
            reject(new Error('没有要提取的时间点'));
          }
        }, 500);
        
      } catch (err) {
        console.error('关键帧提取初始化错误:', err);
        reject(err);
      }
    });
  };
  
  // 处理用户选择完成的关键帧
  const handleFrameSelectionComplete = () => {
    if (!extractedFrames || !selectedFrameIndices || selectedFrameIndices.length === 0) {
      setError('请至少选择一个关键帧');
      return;
    }
    
    // 获取选中的帧
    const selectedFrames = selectedFrameIndices.map(index => extractedFrames.frames[index]);
    const selectedFramesBase64 = selectedFrameIndices.map(index => extractedFrames.framesBase64[index]);
    
    // 设置为最终使用的关键帧
    setKeyFrames(selectedFrames);
    setKeyFramesBase64(selectedFramesBase64);
    
    // 隐藏选择界面
    setShowFrameSelector(false);
    
    // 更新消息
    setMessage(`已选择 ${selectedFrames.length} 个关键帧用于分析，现在您可以开始提问`);
    
    // 添加系统消息
    setMessages(prev => [...prev, {
      role: 'system',
      content: `已选择 ${selectedFrames.length} 个关键帧用于分析，可以开始提问`
    }]);
  };
  
  // 切换帧的选择状态
  const toggleFrameSelection = (index) => {
    setSelectedFrameIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };
  
  // 切换帧选择器显示状态
  const toggleFrameSelector = () => {
    setShowFrameSelector(prev => !prev);
  };
  
  // 键盘事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 处理文稿上传
  const handleTranscriptUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setTranscriptFile(file);
    setTranscriptFileName(file.name);
    setMessage(`文稿文件 "${file.name}" 已上传，正在解析...`);
    
    try {
      const content = await readTranscriptFile(file);
      setTranscriptContent(content);
      setMessage(`文稿文件 "${file.name}" 已解析完成`);
    } catch (error) {
      console.error('解析文稿文件失败:', error);
      setError(`解析文稿文件失败: ${error.message}`);
    }
  };
  
  // 读取不同格式的文稿文件
  const readTranscriptFile = async (file) => {
    const fileType = file.name.split('.').pop().toLowerCase();
    
    // 简单的文本文件处理 (txt, md)
    if (fileType === 'txt' || fileType === 'md' || fileType === 'markdown') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('读取文件失败'));
        reader.readAsText(file);
      });
    }
    // PDF文件处理
    else if (fileType === 'pdf') {
      // 如果需要PDF解析，可以使用如pdf.js库
      // 这里简化处理，提示用户当前不支持PDF
      throw new Error('目前暂不支持PDF格式，请上传txt或markdown格式的文稿');
    }
    else {
      throw new Error(`不支持的文件格式: ${fileType}，请上传txt或markdown格式的文稿`);
    }
  };
  
  // 清除已上传的文稿
  const clearTranscript = () => {
    setTranscriptFile(null);
    setTranscriptContent('');
    setTranscriptFileName('');
    if (transcriptInputRef.current) {
      transcriptInputRef.current.value = '';
    }
  };
  
  return (
    <div className="video-understanding-container">
      {/* 顶部错误和信息提示 */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="clear-button">清除</button>
        </div>
      )}
      
      {/* 显示加载状态或提示消息 */}
      {message && (
        <div className="info-message">
          <p>{message}</p>
          {isLoading && <div className="loading-spinner"></div>}
        </div>
      )}
      
      {/* 主内容区域 - 使用双栏布局 */}
      <div className="content-layout">
        {/* 左侧栏 - 视频和控制区域 */}
        <div className="left-column">
          {/* 视频上传和文件选择区域 */}
          <div className="media-controls">
            <div className="upload-section">
              <button 
                className="upload-button"
                onClick={() => videoInputRef.current.click()}
              >
                选择视频文件
              </button>
            <input
              type="file"
              ref={videoInputRef}
              onChange={handleVideoSelect}
              accept="video/*"
              style={{ display: 'none' }}
            />
              
            <button 
                className="upload-button"
                onClick={() => subtitleInputRef.current.click()} 
                disabled={!videoFile}
              >
                上传字幕文件
            </button>
            <input
              type="file"
              ref={subtitleInputRef}
              onChange={handleSubtitleSelect}
                accept=".vtt,.srt"
              style={{ display: 'none' }}
            />
              
              {/* 新增文稿上传按钮 */}
            <button 
                className="upload-button"
                onClick={() => transcriptInputRef.current.click()}
              >
                上传文稿文件
            </button>
              <input
                type="file"
                ref={transcriptInputRef}
                onChange={handleTranscriptUpload}
                accept=".txt,.md,.markdown"
                style={{ display: 'none' }}
              />
              
              {transcriptFileName && (
                <div className="transcript-info">
                  <span>已上传文稿: {transcriptFileName}</span>
            <button 
                    className="clear-button"
                    onClick={clearTranscript}
                  >
                    清除
                  </button>
                </div>
              )}
              
              {videoFile && (
                <button 
                  className="clear-button"
              onClick={handleClearVideo}
            >
              清除视频
            </button>
              )}
        </div>
          
            <div className="frame-selection-controls">
              <button
                className="action-button"
                onClick={toggleFrameSelector}
                disabled={!videoFile}
              >
                选择关键帧
              </button>
              
              <button 
                className="action-button"
                onClick={() => setShowPromptSettings(true)}
              >
                提示词设置
              </button>
          </div>
          </div>
          
          {/* 视频显示区域 */}
          {videoUrl && (
            <div className="video-container">
              <video 
                ref={videoRef}
                controls 
                onTimeUpdate={handleTimeUpdate}
                className="video-player"
              >
                <source src={videoUrl} />
                您的浏览器不支持HTML5视频
              </video>
            </div>
          )}
          
          {/* 关键帧提取选项 - 当视频已上传但未提取关键帧时显示 */}
          {videoFile && frameExtractionMode === 'none' && !isExtracting && keyFrames.length === 0 && (
            <div className="frame-extraction-options">
              <h3>选择关键帧提取方式：</h3>
              
              <div className="extraction-method">
                <h4>方式1: 按时间间隔提取</h4>
                <div className="interval-input">
                  <label htmlFor="frame-interval">每隔</label>
                  <input 
                    type="number" 
                    id="frame-interval"
                    ref={frameIntervalInputRef}
                    min="1" 
                    max="60"
                    defaultValue={frameInterval}
                    onChange={(e) => setFrameInterval(parseInt(e.target.value) || 5)}
                  />
                  <label htmlFor="frame-interval">秒提取一帧</label>
                </div>
                <button 
                  className="extract-button"
                  onClick={() => extractFramesByInterval(frameInterval)}
                  disabled={isExtracting}
                >
                  按时间间隔提取
                </button>
              </div>
              
              <div className="extraction-method">
                <h4>方式2: 根据字幕时间点提取</h4>
                <p>{subtitles.length > 0 
                  ? `已上传字幕文件，共${subtitles.length}条字幕` 
                  : "请先上传字幕文件"}</p>
                <button 
                  className="extract-button"
                  onClick={extractFramesBySubtitles}
                  disabled={isExtracting || subtitles.length === 0}
                >
                  根据字幕提取
                </button>
                    </div>
                  </div>
                )}
                
          {/* 关键帧选择界面 */}
          {showFrameSelector && extractedFrames && extractedFrames.frames && extractedFrames.frames.length > 0 && (
            <div className="frame-selector">
              <h3>请选择要使用的关键帧：</h3>
              <p>已提取 {extractedFrames.frames.length} 帧，已选择 {selectedFrameIndices.length} 帧</p>
              
              <div className="frames-grid">
                {extractedFrames.frames.map((frameUrl, index) => (
                  <div 
                    key={index}
                    className={`frame-item ${selectedFrameIndices.includes(index) ? 'selected' : ''}`}
                    onClick={() => toggleFrameSelection(index)}
                  >
                    <img src={frameUrl} alt={`帧 ${index + 1}`} />
                    <div className="frame-index">
                      {selectedFrameIndices.includes(index) ? '✓' : `${index + 1}`}
                </div>
              </div>
                ))}
              </div>
              
              <div className="frame-selection-controls">
                    <button 
                  className="select-all-button"
                  onClick={() => setSelectedFrameIndices(extractedFrames.frames.map((_, i) => i))}
                >
                  全选
                    </button>
                    <button 
                  className="clear-selection-button"
                  onClick={() => setSelectedFrameIndices([])}
                >
                  清除选择
                </button>
                <button 
                  className="use-selected-frames-button"
                  onClick={handleFrameSelectionComplete}
                  disabled={selectedFrameIndices.length === 0}
                >
                  使用选中的 {selectedFrameIndices.length} 帧
                    </button>
                </div>
              </div>
            )}
          
          {/* 关键帧展示区域 */}
          {!showFrameSelector && keyFrames.length > 0 && (
            <div className="keyframes-container">
              <h3>已选择的关键帧：</h3>
              <div className="keyframes-grid">
                {keyFrames.map((frame, index) => (
                  <div key={index} className="keyframe-item">
                    <img src={frame} alt={`关键帧 ${index + 1}`} />
          </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 字幕显示区域 */}
          {subtitles.length > 0 && (
            <div className="subtitles-container">
              <h3>字幕内容：</h3>
              <div className="subtitles-list">
                {subtitles.map((subtitle, index) => (
                  <div 
                    key={index}
                    className={`subtitle-item ${currentTime >= subtitle.startTime && currentTime <= subtitle.endTime ? 'active' : ''}`}
                    onClick={() => handleSubtitleClick(subtitle.startTime)}
                  >
                    <span className="subtitle-time">[{formatTime(subtitle.startTime)}]</span>
                    <span className="subtitle-text">{subtitle.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
                </div>
                
        {/* 右侧栏 - 聊天区域 */}
        <div className="right-column">
          <div className="chat-container">
            <div className="chat-header">
              <h2>视频对话</h2>
              <div className="model-selection">
                <div className="model-info">{modelInfo}</div>
                <button 
                  className="model-switch-button" 
                  onClick={() => {
                    const newService = aiChatService.activeService === 'qwen' ? 'volcengine' : 'qwen';
                    const success = aiChatService.setActiveService(newService);
                    if (success) {
                      // 更新模型信息显示
                      const serviceName = aiChatService.getCurrentServiceName();
                      const currentRound = aiChatService.getCurrentRound();
                      let modelName = serviceName === 'qwen' ? '通义千问' : '火山方舟';
                      let statusText = '';
                      
                      if (serviceName === 'qwen' && currentRound > 0 && !aiChatService._volcengineAvailable) {
                        statusText = '（火山方舟不可用）';
                      }
                      
                      setModelInfo(`${modelName}（手动切换）${statusText}`);
                    } else if (newService === 'volcengine') {
                      // 如果切换失败且目标是火山方舟，显示错误信息
                      setError('无法切换到火山方舟，该服务不可用');
                    }
                  }}
                  title="切换AI模型"
                >
                  切换到{aiChatService.activeService === 'qwen' ? '火山方舟' : '通义千问'}
                </button>
                <button 
                  className="debug-toggle-button" 
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  title="打开调试面板"
                >
                  {showDebugPanel ? '关闭调试' : '打开调试'}
                </button>
              </div>
            </div>
            <div className="chat-messages">
                  {messages.map((msg, index) => (
                    <div 
                      key={index}
                  className={`message ${msg.role === 'temp' ? 'assistant' : msg.role}`}
                >
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : (msg.role === 'assistant' || msg.role === 'temp') ? '🤖' : 'ℹ️'}
                      </div>
                  <div className="message-content">
                        {msg.content}
                        {/* 显示用户上传的图片 */}
                        {msg.image && (
                      <div className="message-image">
                            <img 
                              src={msg.image} 
                              alt="用户上传图片" 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              {/* 显示加载状态 */}
                  {isLoading && !messages.some(msg => msg.role === 'assistant-temp') && (
                <div className="message assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="loading-dots">
                      <span>.</span><span>.</span><span>.</span>
                      </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
                
                {/* 输入区域 */}
            <div className="chat-input-container">
                  {/* 图片预览区域 */}
                  {inputImage && (
                <div className="input-image-preview">
                  <img src={inputImage} alt="预览图片" />
                      <button 
                    className="remove-image-button"
                        onClick={handleRemoveImage}
                        title="删除图片"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
              <div className="input-controls">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      onPaste={handlePaste}
                      placeholder="输入您对视频内容的问题，可以粘贴图片..."
                  disabled={isLoading || !videoFile || keyFrames.length === 0}
                />
                
                <div className="input-buttons">
                      <button
                    className="upload-image-button"
                        onClick={() => fileInputRef.current?.click()}
                    disabled={!videoFile || keyFrames.length === 0 || isLoading || inputImage}
                        title="上传图片"
                      >
                        📷
                      </button>
                      
                      <input 
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      
                      <button
                    className="send-button"
                        onClick={handleSendMessage}
                    disabled={!videoFile || keyFrames.length === 0 || (!input.trim() && !inputImage) || isLoading}
                      >
                        {isLoading ? '处理中...' : '发送'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
        
      {/* 提示词设置组件 */}
      {showPromptSettings && (
        <PromptSettings 
          isOpen={showPromptSettings}
          onClose={() => setShowPromptSettings(false)}
          onSave={handleSavePromptSettings}
        />
      )}
      
      {/* 添加调试面板组件 */}
      <DebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
    </div>
  );
};

export default VideoUnderstanding; 