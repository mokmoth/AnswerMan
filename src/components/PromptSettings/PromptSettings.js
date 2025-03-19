import React, { useState, useEffect } from 'react';
import './PromptSettings.css';

/**
 * 提示词设置组件
 * 允许用户自定义与大模型交互的提示词模板
 */
const PromptSettings = ({ isOpen, onClose, onSave }) => {
  // 提示词状态
  const [systemPrompt, setSystemPrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [subtitlePrompt, setSubtitlePrompt] = useState('');
  const [keyframePrompt, setKeyframePrompt] = useState('');
  const [activeTab, setActiveTab] = useState('system');
  const [previewPrompt, setPreviewPrompt] = useState('');
  
  // 用户变量状态
  const [grade, setGrade] = useState('初中');
  const [subject, setSubject] = useState('数学');
  const [chapter, setChapter] = useState('');
  const [section, setSection] = useState('');
  const [subsection, setSubsection] = useState('');
  const [knowledgePoint, setKnowledgePoint] = useState('');
  
  // 加载保存的提示词设置
  useEffect(() => {
    const loadPromptSettings = () => {
      // 从localStorage加载设置
      const savedSystemPrompt = localStorage.getItem('systemPrompt');
      if (savedSystemPrompt) {
        setSystemPrompt(savedSystemPrompt);
      } else {
        setSystemPrompt('你是视频理解助手，正在分析用户上传的视频。请根据视频内容回答用户问题。');
      }
      
      const savedVideoPrompt = localStorage.getItem('videoPrompt');
      if (savedVideoPrompt) {
        setVideoPrompt(savedVideoPrompt);
      } else {
        // 使用普通字符串，而不是模板字符串
        setVideoPrompt('正在分析视频：${videoName}。当前视频播放时间: ${currentTime}');
      }
      
      const savedSubtitlePrompt = localStorage.getItem('subtitlePrompt');
      if (savedSubtitlePrompt) {
        setSubtitlePrompt(savedSubtitlePrompt);
      } else {
        // 使用普通字符串，而不是模板字符串
        setSubtitlePrompt('视频字幕内容: ${subtitles}');
      }
      
      const savedKeyframePrompt = localStorage.getItem('keyframePrompt');
      if (savedKeyframePrompt) {
        setKeyframePrompt(savedKeyframePrompt);
      } else {
        // 使用普通字符串，而不是模板字符串
        setKeyframePrompt('这些是视频的${frameCount}个关键帧，请根据这些关键帧回答用户问题。');
      }
      
      // 加载用户变量设置
      const savedGrade = localStorage.getItem('userVar_grade');
      if (savedGrade) setGrade(savedGrade);
      
      const savedSubject = localStorage.getItem('userVar_subject');
      if (savedSubject) setSubject(savedSubject);
      
      const savedChapter = localStorage.getItem('userVar_chapter');
      if (savedChapter) setChapter(savedChapter);
      
      const savedSection = localStorage.getItem('userVar_section');
      if (savedSection) setSection(savedSection);
      
      const savedSubsection = localStorage.getItem('userVar_subsection');
      if (savedSubsection) setSubsection(savedSubsection);
      
      const savedKnowledgePoint = localStorage.getItem('userVar_knowledgePoint');
      if (savedKnowledgePoint) setKnowledgePoint(savedKnowledgePoint);
    };
    
    loadPromptSettings();
  }, []);
  
  // 保存设置
  const handleSaveSettings = () => {
    // 保存到localStorage
    localStorage.setItem('systemPrompt', systemPrompt);
    localStorage.setItem('videoPrompt', videoPrompt);
    localStorage.setItem('subtitlePrompt', subtitlePrompt);
    localStorage.setItem('keyframePrompt', keyframePrompt);
    
    // 保存用户变量
    localStorage.setItem('userVar_grade', grade);
    localStorage.setItem('userVar_subject', subject);
    localStorage.setItem('userVar_chapter', chapter);
    localStorage.setItem('userVar_section', section);
    localStorage.setItem('userVar_subsection', subsection);
    localStorage.setItem('userVar_knowledgePoint', knowledgePoint);
    
    if (onSave) {
      onSave({
        systemPrompt,
        videoPrompt,
        subtitlePrompt,
        keyframePrompt,
        userVariables: {
          grade,
          subject,
          chapter,
          section,
          subsection,
          knowledgePoint
        }
      });
    }
    
    onClose();
  };
  
  // 生成提示词预览
  const generatePreview = () => {
    try {
      // 示例变量值
      const exampleVideoName = "示例视频.mp4";
      const exampleCurrentTime = "00:01:30";
      const exampleSubtitles = "这是当前视频位置的字幕内容";
      const exampleFrameCount = "40";
      const exampleFullSubtitles = "[00:00:10-00:00:15] 字幕内容1\n[00:00:20-00:00:25] 字幕内容2\n[00:00:30-00:00:35] 字幕内容3";
      const exampleTranscript = "这是一份示例文稿内容，包含了视频的完整文字记录。\n这可以帮助模型更好地理解视频的整体内容和背景。";
      
      // 用户变量
      const userVars = {
        grade,
        subject,
        chapter,
        section,
        subsection,
        knowledgePoint
      };
      
      // 根据当前激活的标签页来预览不同的提示词
      let template = '';
      if (activeTab === 'system') {
        template = systemPrompt;
      } else if (activeTab === 'video') {
        template = videoPrompt;
      } else if (activeTab === 'subtitle') {
        template = subtitlePrompt;
      } else if (activeTab === 'keyframe') {
        template = keyframePrompt;
      } else if (activeTab === 'variables') {
        // 在变量页面，预览系统提示词
        template = systemPrompt;
      }
      
      // 替换视频相关变量
      let preview = template
        .replace(/\$\{videoName\}/g, exampleVideoName)
        .replace(/\$\{currentTime\}/g, exampleCurrentTime)
        .replace(/\$\{subtitles\}/g, exampleSubtitles)
        .replace(/\$\{frameCount\}/g, exampleFrameCount)
        .replace(/\$\{fullSubtitles\}/g, exampleFullSubtitles)
        .replace(/\$\{transcript\}/g, exampleTranscript);
      
      // 替换用户变量
      Object.keys(userVars).forEach(key => {
        const value = userVars[key] || `[未设置${key}]`;
        preview = preview.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      });
      
      setPreviewPrompt(preview);
    } catch (error) {
      console.error("预览生成错误:", error);
      setPreviewPrompt("预览生成失败: " + error.message);
    }
  };
  
  // 重置为默认设置
  const handleResetDefaults = () => {
    setSystemPrompt('你是视频理解助手，正在分析用户上传的视频。请根据视频内容回答用户问题。');
    // 使用普通字符串，而不是模板字符串
    setVideoPrompt('正在分析视频：${videoName}。当前视频播放时间: ${currentTime}');
    setSubtitlePrompt('视频字幕内容: ${subtitles}');
    setKeyframePrompt('这些是视频的${frameCount}个关键帧，请根据这些关键帧回答用户问题。');
    
    // 重置用户变量
    setGrade('初中');
    setSubject('数学');
    setChapter('');
    setSection('');
    setSubsection('');
    setKnowledgePoint('');
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="prompt-settings-overlay">
      <div className="prompt-settings-container">
        <div className="prompt-settings-header">
          <h2>提示词设置</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="prompt-settings-tabs">
          <button 
            className={`tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            系统提示词
          </button>
          <button 
            className={`tab ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            视频提示词
          </button>
          <button 
            className={`tab ${activeTab === 'subtitle' ? 'active' : ''}`}
            onClick={() => setActiveTab('subtitle')}
          >
            字幕提示词
          </button>
          <button 
            className={`tab ${activeTab === 'keyframe' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyframe')}
          >
            关键帧提示词
          </button>
          <button 
            className={`tab ${activeTab === 'variables' ? 'active' : ''}`}
            onClick={() => setActiveTab('variables')}
          >
            用户变量
          </button>
          <button 
            className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('preview');
              generatePreview();
            }}
          >
            预览
          </button>
        </div>
        
        <div className="prompt-settings-content">
          {activeTab === 'system' && (
            <div className="prompt-section">
              <label htmlFor="system-prompt">基础系统提示词</label>
              <p className="prompt-description">
                这是向AI模型提供的基础系统指令，定义了AI的角色和任务。
                <br/>可以使用所有视频变量和用户变量，例如: {'${grade}'}, {'${subject}'}, {'${chapter}'}等。
              </p>
              <textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="输入系统提示词..."
              />
            </div>
          )}
          
          {activeTab === 'video' && (
            <div className="prompt-section">
              <label htmlFor="video-prompt">视频信息提示词</label>
              <p className="prompt-description">
                用于告知AI当前视频信息的提示词。可使用以下变量：
                <br />{'${videoName}'} - 视频文件名
                <br />{'${currentTime}'} - 当前播放时间
                <br />{'${fullSubtitles}'} - 视频的完整字幕内容
                <br />{'${transcript}'} - 上传的文稿内容
              </p>
              <textarea
                id="video-prompt"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={6}
                placeholder="输入视频信息提示词..."
              />
            </div>
          )}
          
          {activeTab === 'subtitle' && (
            <div className="prompt-section">
              <label htmlFor="subtitle-prompt">字幕信息提示词</label>
              <p className="prompt-description">
                用于告知AI当前视频字幕信息的提示词。可使用以下变量：
                <br />{'${subtitles}'} - 当前时间点附近的字幕内容
                <br />{'${fullSubtitles}'} - 视频的完整字幕内容
              </p>
              <textarea
                id="subtitle-prompt"
                value={subtitlePrompt}
                onChange={(e) => setSubtitlePrompt(e.target.value)}
                rows={6}
                placeholder="输入字幕信息提示词..."
              />
            </div>
          )}
          
          {activeTab === 'keyframe' && (
            <div className="prompt-section">
              <label htmlFor="keyframe-prompt">关键帧提示词</label>
              <p className="prompt-description">
                用于告知AI关键帧信息的提示词。可使用以下变量：
                <br />{'${frameCount}'} - 关键帧数量
              </p>
              <textarea
                id="keyframe-prompt"
                value={keyframePrompt}
                onChange={(e) => setKeyframePrompt(e.target.value)}
                rows={6}
                placeholder="输入关键帧提示词..."
              />
            </div>
          )}
          
          {activeTab === 'variables' && (
            <div className="prompt-section">
              <label>用户自定义变量</label>
              <p className="prompt-description">
                设置可在提示词中使用的变量值。这些变量可以在系统提示词中使用，格式为{'${变量名}'}。
              </p>
              
              <div className="variable-group">
                <div className="variable-field">
                  <label htmlFor="grade">学段 (必选)</label>
                  <select 
                    id="grade" 
                    value={grade} 
                    onChange={(e) => setGrade(e.target.value)}
                    required
                  >
                    <option value="小学">小学</option>
                    <option value="初中">初中</option>
                    <option value="高中">高中</option>
                    <option value="中职">中职</option>
                  </select>
                </div>
                
                <div className="variable-field">
                  <label htmlFor="subject">学科 (必选)</label>
                  <select 
                    id="subject" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  >
                    <option value="数学">数学</option>
                    <option value="物理">物理</option>
                    <option value="语文">语文</option>
                    <option value="化学">化学</option>
                    <option value="英语">英语</option>
                    <option value="生物">生物</option>
                    <option value="地理">地理</option>
                  </select>
                </div>
              </div>
              
              <div className="variable-group">
                <div className="variable-field">
                  <label htmlFor="chapter">章节 (选填)</label>
                  <input 
                    type="text" 
                    id="chapter" 
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    placeholder="例如：第一章 函数与导数"
                  />
                </div>
                
                <div className="variable-field">
                  <label htmlFor="section">大节 (选填)</label>
                  <input 
                    type="text" 
                    id="section" 
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="例如：1.2 导数的概念"
                  />
                </div>
              </div>
              
              <div className="variable-group">
                <div className="variable-field">
                  <label htmlFor="subsection">小节 (选填)</label>
                  <input 
                    type="text" 
                    id="subsection" 
                    value={subsection}
                    onChange={(e) => setSubsection(e.target.value)}
                    placeholder="例如：1.2.1 导数的几何意义"
                  />
                </div>
                
                <div className="variable-field">
                  <label htmlFor="knowledgePoint">知识点 (选填)</label>
                  <input 
                    type="text" 
                    id="knowledgePoint" 
                    value={knowledgePoint}
                    onChange={(e) => setKnowledgePoint(e.target.value)}
                    placeholder="例如：切线斜率与导数"
                  />
                </div>
              </div>
              
              <div className="variables-help">
                <p>变量使用说明：</p>
                <ul>
                  <li>{'${grade}'} - 引用学段</li>
                  <li>{'${subject}'} - 引用学科</li>
                  <li>{'${chapter}'} - 引用章节</li>
                  <li>{'${section}'} - 引用大节</li>
                  <li>{'${subsection}'} - 引用小节</li>
                  <li>{'${knowledgePoint}'} - 引用知识点</li>
                </ul>
              </div>
            </div>
          )}
          
          {activeTab === 'preview' && (
            <div className="prompt-section">
              <label htmlFor="preview-prompt">最终提示词预览</label>
              <p className="prompt-description">
                这是合并了所有设置后，实际发送给AI模型的完整提示词示例。
              </p>
              <pre className="prompt-preview">
                {previewPrompt}
              </pre>
            </div>
          )}
        </div>
        
        <div className="prompt-settings-actions">
          <button 
            className="reset-btn"
            onClick={handleResetDefaults}
          >
            重置为默认值
          </button>
          <button 
            className="save-btn"
            onClick={handleSaveSettings}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptSettings; 