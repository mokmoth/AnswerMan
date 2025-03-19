/**
 * 解析WebVTT字幕文件内容
 * @param {string} content - WebVTT字幕文本内容
 * @returns {Array} - 解析后的字幕数组，每个元素包含startTime、endTime和text属性
 */
export function parseWebVTT(content) {
  // 检查内容是否为空
  if (!content || typeof content !== 'string') {
    console.error('无效的WebVTT内容');
    return [];
  }

  // 按行分割内容
  const lines = content.trim().split('\n');
  
  // 检查文件头是否为WEBVTT
  if (!lines[0].includes('WEBVTT')) {
    console.error('不是有效的WebVTT格式文件');
    return [];
  }

  const subtitles = [];
  let currentSubtitle = null;
  let collectingCueText = false;
  let cueText = '';

  // 遍历每行
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 空行表示一个字幕块的结束
    if (line === '') {
      if (currentSubtitle) {
        currentSubtitle.text = cueText.trim();
        subtitles.push(currentSubtitle);
        currentSubtitle = null;
        collectingCueText = false;
        cueText = '';
      }
      continue;
    }
    
    // 如果当前正在收集字幕文本
    if (collectingCueText) {
      cueText += line + ' ';
      continue;
    }
    
    // 检查是否是时间行（包含-->）
    if (line.includes('-->')) {
      // 提取开始和结束时间
      const timeParts = line.split('-->').map(part => part.trim());
      if (timeParts.length === 2) {
        const startTime = parseTimeString(timeParts[0]);
        const endTime = parseTimeString(timeParts[1]);
        
        currentSubtitle = {
          startTime,
          endTime,
          text: ''
        };
        
        collectingCueText = true;
      }
    }
  }
  
  // 处理最后一个字幕
  if (currentSubtitle) {
    currentSubtitle.text = cueText.trim();
    subtitles.push(currentSubtitle);
  }
  
  return subtitles;
}

/**
 * 将时间字符串转换为秒数
 * @param {string} timeString - 格式为"00:00:00.000"的时间字符串
 * @returns {number} - 秒数
 */
function parseTimeString(timeString) {
  // 移除可能的额外属性（如位置信息）
  timeString = timeString.split(' ')[0];
  
  const parts = timeString.split(':');
  let seconds = 0;
  
  if (parts.length === 3) { // hh:mm:ss.ms
    seconds += parseInt(parts[0], 10) * 3600; // 小时
    seconds += parseInt(parts[1], 10) * 60;   // 分钟
    seconds += parseFloat(parts[2]);          // 秒和毫秒
  } else if (parts.length === 2) { // mm:ss.ms
    seconds += parseInt(parts[0], 10) * 60;   // 分钟
    seconds += parseFloat(parts[1]);          // 秒和毫秒
  }
  
  return seconds;
}

/**
 * 从SRT文件内容解析字幕
 * @param {string} content - SRT字幕文本内容
 * @returns {Array} - 解析后的字幕数组
 */
export function parseSRT(content) {
  if (!content || typeof content !== 'string') {
    console.error('无效的SRT内容');
    return [];
  }

  const subtitles = [];
  const blocks = content.trim().split(/\r?\n\r?\n/);

  blocks.forEach(block => {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) return; // 跳过格式不正确的块

    // 忽略第一行的序号，直接解析时间行
    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    
    if (!timeMatch) return;
    
    const startTimeStr = timeMatch[1].replace(',', '.');
    const endTimeStr = timeMatch[2].replace(',', '.');
    
    const startTime = parseTimeString(startTimeStr);
    const endTime = parseTimeString(endTimeStr);
    
    // 合并其余行作为字幕文本
    const text = lines.slice(2).join(' ');
    
    subtitles.push({
      startTime,
      endTime,
      text
    });
  });

  return subtitles;
} 