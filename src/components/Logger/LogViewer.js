import React, { useState, useEffect, useRef } from 'react';
import { logService } from '../../services/logService';
import './LogViewer.css';

const LogViewer = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);
  
  // 日志类别列表
  const categories = [
    { id: 'all', name: '全部' },
    { id: 'video', name: '视频' },
    { id: 'subtitle', name: '字幕' },
    { id: 'bookmark', name: '书签' },
    { id: 'model', name: '模型' },
    { id: 'screenshot', name: '截图' },
    { id: 'system', name: '系统' }
  ];

  // 监听日志更新
  useEffect(() => {
    const handleLogsUpdate = (updatedLogs) => {
      setLogs(updatedLogs);
    };
    
    // 初始加载日志
    setLogs(logService.getLogs());
    
    // 添加日志监听器
    logService.addListener(handleLogsUpdate);
    
    return () => {
      // 移除监听器
      logService.removeListener(handleLogsUpdate);
    };
  }, []);
  
  // 处理自动滚动
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);
  
  // 如果模态框未打开，不渲染内容
  if (!isOpen) return null;
  
  // 过滤日志
  const filteredLogs = logs.filter(log => {
    // 类别过滤
    if (categoryFilter !== 'all' && log.category !== categoryFilter) {
      return false;
    }
    
    // 文本搜索过滤
    if (filter) {
      const searchText = filter.toLowerCase();
      return (
        log.action.toLowerCase().includes(searchText) ||
        log.category.toLowerCase().includes(searchText) ||
        JSON.stringify(log.details).toLowerCase().includes(searchText)
      );
    }
    
    return true;
  });
  
  // 清除所有日志
  const handleClearLogs = () => {
    if (window.confirm('确定要清除所有日志吗？')) {
      logService.clearLogs();
    }
  };
  
  // 导出日志为JSON文件
  const handleExportLogs = () => {
    const json = logService.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `answerman-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // 格式化日期时间
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };
  
  // 格式化详情对象为可读文本
  const formatDetails = (details) => {
    if (!details) return '';
    
    try {
      if (typeof details === 'string') {
        return details;
      }
      
      // 处理特殊字段
      let formattedDetails = { ...details };
      
      // 删除过长的内容如base64字符串等
      if (formattedDetails.content && formattedDetails.content.length > 100) {
        formattedDetails.content = `[内容长度: ${formattedDetails.content.length}]`;
      }
      
      if (formattedDetails.data && typeof formattedDetails.data === 'string' && formattedDetails.data.length > 100) {
        formattedDetails.data = `[数据长度: ${formattedDetails.data.length}]`;
      }
      
      return JSON.stringify(formattedDetails, null, 2);
    } catch (e) {
      return '无法格式化详情';
    }
  };

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer-container">
        <div className="log-viewer-header">
          <h2>操作日志</h2>
          <div className="log-viewer-controls">
            <button className="export-btn" onClick={handleExportLogs}>
              导出日志
            </button>
            <button className="clear-btn" onClick={handleClearLogs}>
              清除日志
            </button>
            <button className="close-btn" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
        
        <div className="log-filter-container">
          <input
            type="text"
            className="log-filter-input"
            placeholder="搜索日志..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          
          <div className="category-filter">
            <span>类别:</span>
            {categories.map(category => (
              <button 
                key={category.id} 
                className={`category-btn ${categoryFilter === category.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          
          <label className="auto-scroll-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            自动滚动到最新
          </label>
        </div>
        
        <div className="log-entries-container" ref={logContainerRef}>
          {filteredLogs.length > 0 ? (
            <table className="log-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类别</th>
                  <th>操作</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr key={index} className={`log-entry ${log.category}`}>
                    <td className="log-time">{formatDateTime(log.timestamp)}</td>
                    <td className="log-category">{log.category}</td>
                    <td className="log-action">{log.action}</td>
                    <td className="log-details">
                      <pre>{formatDetails(log.details)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-logs">
              <p>没有符合条件的日志</p>
            </div>
          )}
        </div>
        
        <div className="log-footer">
          <div className="log-stats">
            共 {logs.length} 条日志，当前显示 {filteredLogs.length} 条
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer; 