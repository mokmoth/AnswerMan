// 日志服务：收集和管理应用程序的操作日志
class LogService {
  constructor() {
    this.logs = [];
    this.listeners = [];
    this.maxLogs = 1000; // 最大日志数量限制
    this.enabled = true; // 是否启用日志
    
    // 尝试从 localStorage 恢复日志设置
    try {
      const savedEnabled = localStorage.getItem('log_service_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      }
      
      // 从 localStorage 恢复日志
      const savedLogs = localStorage.getItem('application_logs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
      }
    } catch (error) {
      console.error('无法恢复日志设置:', error);
    }
    
    // 定期将日志保存到 localStorage
    this.saveInterval = setInterval(() => {
      this.saveLogs();
    }, 30000); // 每30秒保存一次
  }
  
  // 记录日志
  log(category, action, details = {}) {
    if (!this.enabled) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      category, // 类别：video, subtitle, bookmark, model, screenshot 等
      action,   // 动作：upload, generate, create, ask 等
      details   // 详细信息，可以是任何对象
    };
    
    this.logs.unshift(logEntry); // 新日志添加到前面
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // 通知所有监听器
    this.notifyListeners();
    
    return logEntry;
  }
  
  // 清除所有日志
  clearLogs() {
    this.logs = [];
    this.saveLogs();
    this.notifyListeners();
  }
  
  // 启用或禁用日志
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('log_service_enabled', enabled.toString());
    return this.enabled;
  }
  
  // 保存日志到 localStorage
  saveLogs() {
    try {
      localStorage.setItem('application_logs', JSON.stringify(this.logs.slice(0, 200))); // 只保存最近200条到localStorage
    } catch (error) {
      console.error('保存日志失败:', error);
    }
  }
  
  // 获取所有日志
  getLogs() {
    return [...this.logs];
  }
  
  // 获取指定类别的日志
  getLogsByCategory(category) {
    return this.logs.filter(log => log.category === category);
  }
  
  // 添加日志变更监听器
  addListener(callback) {
    if (typeof callback === 'function' && !this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  }
  
  // 移除日志变更监听器
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }
  
  // 通知所有监听器
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.logs);
      } catch (error) {
        console.error('日志监听器执行错误:', error);
      }
    }
  }
  
  // 导出日志为JSON字符串
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
  
  // 清理资源
  dispose() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.listeners = [];
    this.saveLogs();
  }
}

// 导出单例实例
export const logService = new LogService();

// 便捷记录方法
export const logEvent = (category, action, details) => {
  return logService.log(category, action, details);
}; 