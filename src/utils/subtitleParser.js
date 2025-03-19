/**
 * 字幕解析工具
 * 提供解析SRT格式字幕文件的功能
 */

/**
 * 解析SRT格式的字幕文件
 * @param {string} srtContent SRT文件内容
 * @returns {Array} 解析后的字幕数组，每项包含{startTime, endTime, text}
 */
export function parseSRT(srtContent) {
  if (!srtContent) return [];
  
  // 按空行分割字幕块
  const subtitleBlocks = srtContent.trim().split(/\r?\n\r?\n/);
  const subtitles = [];
  
  for (const block of subtitleBlocks) {
    const lines = block.split(/\r?\n/);
    
    // 至少需要3行：序号、时间码、文本
    if (lines.length < 3) continue;
    
    // 解析时间码行
    const timecodeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timecodeMatch) continue;
    
    // 计算开始时间（秒）
    const startHours = parseInt(timecodeMatch[1], 10);
    const startMinutes = parseInt(timecodeMatch[2], 10);
    const startSeconds = parseInt(timecodeMatch[3], 10);
    const startMilliseconds = parseInt(timecodeMatch[4], 10);
    const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
    
    // 计算结束时间（秒）
    const endHours = parseInt(timecodeMatch[5], 10);
    const endMinutes = parseInt(timecodeMatch[6], 10);
    const endSeconds = parseInt(timecodeMatch[7], 10);
    const endMilliseconds = parseInt(timecodeMatch[8], 10);
    const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
    
    // 提取文本（可能有多行）
    const text = lines.slice(2).join(' ').trim();
    
    subtitles.push({
      startTime,
      endTime,
      text
    });
  }
  
  return subtitles;
}

/**
 * 将字幕数组转换为VTT格式
 * @param {Array} subtitles 字幕数组
 * @returns {string} VTT格式的字幕内容
 */
export function convertToVTT(subtitles) {
  if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
    return 'WEBVTT\n\n';
  }
  
  let vttContent = 'WEBVTT\n\n';
  
  subtitles.forEach((subtitle, index) => {
    // 格式化时间码
    const startTime = formatVTTTime(subtitle.startTime);
    const endTime = formatVTTTime(subtitle.endTime);
    
    vttContent += `${index + 1}\n`;
    vttContent += `${startTime} --> ${endTime}\n`;
    vttContent += `${subtitle.text}\n\n`;
  });
  
  return vttContent;
}

/**
 * 格式化时间为VTT时间码格式
 * @param {number} seconds 秒数
 * @returns {string} 格式化的时间码
 */
function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * 根据当前时间获取字幕上下文
 * @param {Array} subtitles 字幕数组
 * @param {number} currentTime 当前时间（秒）
 * @param {number} contextSize 上下文大小（前后各取多少条字幕）
 * @returns {string} 字幕上下文文本
 */
export function getSubtitleContext(subtitles, currentTime, contextSize = 2) {
  if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
    return '';
  }
  
  // 找到当前时间对应的字幕索引
  let currentIndex = -1;
  for (let i = 0; i < subtitles.length; i++) {
    if (currentTime >= subtitles[i].startTime && currentTime <= subtitles[i].endTime) {
      currentIndex = i;
      break;
    }
  }
  
  // 如果没有找到当前字幕，找最接近的
  if (currentIndex === -1) {
    let minDistance = Infinity;
    for (let i = 0; i < subtitles.length; i++) {
      const distance = Math.min(
        Math.abs(currentTime - subtitles[i].startTime),
        Math.abs(currentTime - subtitles[i].endTime)
      );
      if (distance < minDistance) {
        minDistance = distance;
        currentIndex = i;
      }
    }
  }
  
  // 如果仍然没有找到，返回空字符串
  if (currentIndex === -1) {
    return '';
  }
  
  // 计算上下文范围
  const startIndex = Math.max(0, currentIndex - contextSize);
  const endIndex = Math.min(subtitles.length - 1, currentIndex + contextSize);
  
  // 构建上下文文本
  let contextText = '';
  for (let i = startIndex; i <= endIndex; i++) {
    const subtitle = subtitles[i];
    const timeFormatted = formatTime(subtitle.startTime);
    const isCurrent = i === currentIndex ? '→ ' : '  ';
    contextText += `${isCurrent}[${timeFormatted}] ${subtitle.text}\n`;
  }
  
  return contextText;
}

/**
 * 格式化时间（秒转为 MM:SS 格式）
 * @param {number} seconds 秒数
 * @returns {string} 格式化后的时间
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 将SRT时间格式转换为秒
export const timeStrToSeconds = (timeStr) => {
  // 格式: 00:00:00,000
  const [time, millis] = timeStr.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  
  return hours * 3600 + minutes * 60 + seconds + parseInt(millis, 10) / 1000;
};

// 将秒转换为SRT时间格式
export const secondsToTimeStr = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
};

// 获取当前时间点的字幕内容
export const getSubtitleAtTime = (subtitles, currentTime) => {
  if (!subtitles || !subtitles.length) return '';
  
  const activeSubtitle = subtitles.find(
    sub => currentTime >= sub.startTime && currentTime <= sub.endTime
  );
  
  return activeSubtitle ? activeSubtitle.text : '';
};

// 获取时间点附近的字幕内容（上下文）
export const getExtendedSubtitleContext = (subtitles, currentTime, windowSize = 15) => {
  if (!subtitles || !subtitles.length) return '';
  
  // 找出在时间窗口内的所有字幕
  const contextSubtitles = subtitles.filter(sub => {
    return (
      (sub.startTime >= currentTime - windowSize && sub.startTime <= currentTime + windowSize) ||
      (sub.endTime >= currentTime - windowSize && sub.endTime <= currentTime + windowSize) ||
      (sub.startTime <= currentTime - windowSize && sub.endTime >= currentTime + windowSize)
    );
  });
  
  return contextSubtitles.map(sub => sub.text).join(' ');
};

// 将字幕内容转换为书签格式
export const convertSubtitleToBookmarks = (srtContent, videoId, interval = 30) => {
  if (!srtContent || !videoId) return [];
  
  // 解析字幕内容
  const subtitles = parseSRT(srtContent);
  if (!subtitles.length) return [];
  
  // 按照指定时间间隔生成书签
  const bookmarks = [];
  const maxTime = subtitles[subtitles.length - 1].endTime;
  
  // 计算需要生成的时间点
  const timePoints = [];
  for (let time = 0; time <= maxTime; time += interval) {
    timePoints.push(time);
  }
  
  // 为每个时间点创建书签
  timePoints.forEach(timePoint => {
    // 找到该时间点附近的字幕
    const nearbySubtitles = subtitles.filter(sub => 
      (timePoint >= sub.startTime - 5 && timePoint <= sub.endTime + 5)
    );
    
    if (nearbySubtitles.length > 0) {
      // 提取该时间点附近的字幕文本作为书签标题
      const subtitleText = nearbySubtitles.map(sub => sub.text).join(' ');
      // 限制标题长度
      const bookmarkTitle = subtitleText.length > 50 
        ? subtitleText.substring(0, 47) + '...' 
        : subtitleText;
      
      bookmarks.push({
        videoId,
        time: timePoint,
        label: bookmarkTitle || `字幕标记 ${secondsToTimeStr(timePoint).substring(3, 8)}`,
        createdAt: new Date().toISOString(),
        fromSubtitle: true
      });
    }
  });
  
  return bookmarks;
};

// 根据字幕条目直接创建书签
export const convertSubtitleToBookmarksByEntry = (srtContent, videoId, maxBookmarks = 0) => {
  if (!srtContent || !videoId) return [];
  
  // 解析字幕内容
  const subtitles = parseSRT(srtContent);
  if (!subtitles.length) return [];
  
  // 按字幕顺序生成书签
  let bookmarks = subtitles.map(subtitle => {
    // 使用字幕开始时间作为书签时间点
    const timePoint = subtitle.startTime;
    
    // 限制标题长度
    const bookmarkTitle = subtitle.text.length > 50 
      ? subtitle.text.substring(0, 47) + '...' 
      : subtitle.text;
    
    return {
      videoId,
      time: timePoint,
      label: bookmarkTitle || `字幕 ${secondsToTimeStr(timePoint).substring(3, 8)}`,
      createdAt: new Date().toISOString(),
      fromSubtitle: true
    };
  });
  
  // 如果指定了最大书签数量并且大于0，选择均匀分布的书签
  if (maxBookmarks > 0 && bookmarks.length > maxBookmarks) {
    const step = Math.floor(bookmarks.length / maxBookmarks);
    const filteredBookmarks = [];
    
    for (let i = 0; i < bookmarks.length && filteredBookmarks.length < maxBookmarks; i += step) {
      filteredBookmarks.push(bookmarks[i]);
    }
    
    bookmarks = filteredBookmarks;
  }
  
  return bookmarks;
};

// 将SRT转换为VTT格式（用于HTML5视频播放器）
export const convertSRTtoVTT = (srtContent) => {
  if (!srtContent) return '';
  
  // WebVTT头部
  let vttContent = 'WEBVTT\n\n';
  
  // 替换时间格式，从00:00:00,000变为00:00:00.000
  const convertedContent = srtContent
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  // 添加转换后的内容
  vttContent += convertedContent;
  
  return vttContent;
}; 