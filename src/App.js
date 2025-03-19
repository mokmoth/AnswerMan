import React, { useState, useEffect } from 'react';
import { logEvent } from './components/Logger';
import VideoUnderstanding from './components/VideoUnderstanding';
import './App.css';

function App() {
  // 状态管理
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  
  // 加载配置
  useEffect(() => {
    // 记录系统启动日志
    logEvent('system', '应用启动', { version: process.env.REACT_APP_VERSION || '1.0.0' });
    
    fetch('/config.json')
      .then(response => response.json())
      .then(data => {
        console.log('配置加载成功:', data);
        setConfig(data);
        logEvent('system', '配置加载', { success: true });
      })
      .catch(err => {
        console.error('配置加载失败:', err);
        setError('配置文件加载失败，请检查config.json是否存在');
        logEvent('system', '配置加载失败', { error: err.message });
      });
      
    // 组件卸载时记录日志
    return () => {
      logEvent('system', '应用关闭');
    };
  }, []);
  
  return (
    <div className="app-container">
      {/* 加载错误提示 */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {/* 直接显示视频理解组件 */}
      <VideoUnderstanding />
    </div>
  );
}

export default App;