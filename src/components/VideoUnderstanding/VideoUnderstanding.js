const handleSendMessage = async (message) => {
  try {
    setIsLoadingResponse(true);
    
    // 添加用户消息到列表
    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    // 添加临时AI消息
    const tempAiMessageId = Date.now().toString();
    const tempAiMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      id: tempAiMessageId,
      temp: true,
    };
    
    setMessages(prevMessages => [...prevMessages, tempAiMessage]);
    
    // 获取滚动容器引用
    const scrollContainer = messagesEndRef.current?.parentElement;
    
    // 准备系统提示信息
    const systemPrompt = getSystemPrompt();
    
    const onChunk = (chunk) => {
      // 直接将chunk添加到临时消息的内容中
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        const tempMessageIndex = newMessages.findIndex(m => m.id === tempAiMessageId);
        
        if (tempMessageIndex !== -1) {
          newMessages[tempMessageIndex] = {
            ...newMessages[tempMessageIndex],
            content: newMessages[tempMessageIndex].content + chunk
          };
        }
        
        return newMessages;
      });
      
      // 确保UI滚动到最新消息
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 50);
      }
    };
    
    // 调用API
    const response = await qwenaiService.chat({
      message,
      systemPrompt,
      options: {
        stream: true,
        onChunk,
        videoName: currentVideo?.name || "未指定视频",
        currentTime: getCurrentTimeFormatted(),
        subtitles: getCurrentSubtitles(),
        frameCount: keyframes.length,
        keyframes
      }
    });

    // 流式响应完成后，将临时消息替换为最终消息
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      const tempMessageIndex = newMessages.findIndex(m => m.id === tempAiMessageId);
      
      if (tempMessageIndex !== -1) {
        // 保留流式构建的内容，只移除temp标志
        newMessages[tempMessageIndex] = {
          ...newMessages[tempMessageIndex],
          temp: false
        };
      }
      
      return newMessages;
    });
    
    // 保存对话历史到localStorage
    saveConversationToLocalStorage([...messages, userMessage, {
      role: "assistant",
      content: response.text,
      timestamp: new Date().toISOString()
    }]);
    
  } catch (error) {
    console.error("发送消息时出错:", error);
    // 显示错误通知
    toast.error("发送消息时出错，请稍后重试");
    
    // 移除临时AI消息
    setMessages(prevMessages => 
      prevMessages.filter(m => !m.temp)
    );
  } finally {
    setIsLoadingResponse(false);
  }
}; 