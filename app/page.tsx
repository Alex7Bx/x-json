"use client";

import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { okaidia } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function Home() {
  const [inputJson, setInputJson] = useState('');
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [outputJson, setOutputJson] = useState('');
  const [error, setError] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [softWrap, setSoftWrap] = useState(true);
  const [collapsedLines, setCollapsedLines] = useState<Record<number, boolean>>({});
  const [collapsibleRanges, setCollapsibleRanges] = useState<{start: number, end: number, type: string, count?: number}[]>([]);
  const [hiddenLines, setHiddenLines] = useState<Record<number, boolean>>({});
  const [bracketColors, setBracketColors] = useState<Record<number, string>>({});

  useEffect(() => {
    parseJson();
  }, [inputJson]);

  // 添加自定义样式到head
  useEffect(() => {
    // 创建样式元素
    const styleEl = document.createElement('style');
    styleEl.setAttribute('id', 'json-highlighter-styles');
    
    // 设置样式
    styleEl.innerHTML = `
      html, body {
        overscroll-behavior: none;
      }
      .syntax-highlighter pre {
        white-space: ${softWrap ? 'pre-wrap' : 'pre'} !important;
        word-break: ${softWrap ? 'break-all' : 'normal'} !important;
      }
      .syntax-highlighter code {
        white-space: ${softWrap ? 'pre-wrap' : 'pre'} !important;
        word-break: ${softWrap ? 'break-all' : 'normal'} !important;
      }
      .syntax-highlighter span {
        white-space: ${softWrap ? 'pre-wrap' : 'pre'} !important;
        word-break: ${softWrap ? 'break-all' : 'normal'} !important;
      }
      .line-number {
        width: 60px;
        min-width: 60px;
        color: #75715e;
        text-align: right;
        padding-right: 12px;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        white-space: nowrap;
        overflow: hidden;
      }
      .line-number-text {
        min-width: 24px;
        text-align: right;
        color: #75715e;
      }
      .folding-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        margin-right: 2px;
      }
      .folding-icon {
        display: inline-flex;
        width: 18px;
        height: 18px;
        line-height: 18px;
        text-align: center;
        align-items: center;
        justify-content: center;
        color: rgba(117, 113, 94, 1);
        cursor: pointer;
        user-select: none;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      .folding-icon:hover {
        color: #f8f8f2;
      }
      .json-line {
        display: flex;
        font-family: monospace;
      }
      .collapsed-line {
        display: none;
      }
      .json-ellipsis {
        color: #75715e;
        font-style: italic;
        margin-left: 8px;
        padding: 0 5px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      .line-content {
        padding-left: 12px;
        border-left: 1px solid #444;
        width: calc(100% - 60px);
      }
    `;
    
    // 移除任何现有的样式
    const existingStyle = document.getElementById('json-highlighter-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // 添加样式到头部
    document.head.appendChild(styleEl);
    
    // 清理函数
    return () => {
      const styleToRemove = document.getElementById('json-highlighter-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [softWrap]);

  // 修改元素计数逻辑
  const findFoldableRanges = (jsonStr: string) => {
    const lines = jsonStr.split('\n');
    const ranges: {start: number, end: number, type: string, count?: number}[] = [];
    
    console.log('开始查找可折叠范围，总行数:', lines.length);
    
    // 完全重新实现括号匹配
    // 记录每个开括号的位置和与之匹配的闭括号
    const bracketPairs: {openLine: number, openChar: string, closeLine: number}[] = [];
    const bracketStack: {line: number, position: number, char: string}[] = [];
    
    // 标记字符串开始和结束的位置，避免处理字符串中的括号
    let inString = false;
    let escapeNext = false;
    
    // 逐行逐字符分析
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        
        // 处理转义字符
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        // 处理转义标记
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        // 处理字符串边界
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        // 只处理不在字符串内的括号
        if (!inString) {
          // 处理开括号
          if (char === '{' || char === '[') {
            bracketStack.push({
              line: lineIndex,
              position: charIndex,
              char: char
            });
          }
          // 处理闭括号
          else if (char === '}' || char === ']') {
            if (bracketStack.length > 0) {
              const lastOpenBracket = bracketStack.pop()!;
              const expectedClosing = lastOpenBracket.char === '{' ? '}' : ']';
              
              // 检查括号是否匹配
              if (char === expectedClosing) {
                // 记录这对匹配的括号
                bracketPairs.push({
                  openLine: lastOpenBracket.line,
                  openChar: lastOpenBracket.char,
                  closeLine: lineIndex
                });
              } else {
                console.warn(`括号不匹配: 第${lastOpenBracket.line+1}行的${lastOpenBracket.char}与第${lineIndex+1}行的${char}`);
                // 不匹配时尝试在堆栈中查找匹配的括号
                let matchFound = false;
                for (let i = bracketStack.length - 1; i >= 0; i--) {
                  const openBracket = bracketStack[i];
                  const expected = openBracket.char === '{' ? '}' : ']';
                  if (char === expected) {
                    // 找到匹配，记录并移除
                    bracketPairs.push({
                      openLine: openBracket.line,
                      openChar: openBracket.char,
                      closeLine: lineIndex
                    });
                    bracketStack.splice(i, 1);
                    matchFound = true;
                    break;
                  }
                }
                
                // 如果没找到匹配，则将错误的开括号重新放回堆栈
                if (!matchFound) {
                  bracketStack.push(lastOpenBracket);
                }
              }
            } else {
              console.warn(`在第${lineIndex+1}行发现未匹配的闭括号: ${char}`);
            }
          }
        }
      }
    }
    
    console.log('找到的括号对:', bracketPairs);
    
    // 将bracketPairs转换为可折叠范围和括号匹配
    const bracketMatches: Record<number, number> = {}; // 开始行号到结束行号的映射
    const bracketTypes: Record<number, string> = {}; // 记录每行括号的类型
    
    bracketPairs.forEach(pair => {
      // 记录匹配关系
      bracketMatches[pair.openLine] = pair.closeLine;
      // 记录括号类型
      bracketTypes[pair.openLine] = pair.openChar;
    });
    
    console.log('括号匹配结果:', bracketMatches);
    console.log('括号类型:', bracketTypes);
    
    // 括号颜色列表
    const colors = [
      '#e6194B', '#3cb44b', '#ffe119', '#4363d8', 
      '#f58231', '#911eb4', '#42d4f4', '#f032e6',
      '#bfef45', '#fabed4', '#469990', '#dcbeff',
      '#9A6324', '#fffac8', '#800000', '#aaffc3',
      '#808000', '#ffd8b1', '#000075', '#a9a9a9'
    ];
    
    // 给每对括号分配颜色
    const newBracketColors: Record<number, string> = {};
    
    // 按照嵌套深度为括号对分配颜色
    // 首先按开括号行号排序，这样外层括号会先于内层括号处理
    const sortedPairs = [...bracketPairs].sort((a, b) => a.openLine - b.openLine);
    
    sortedPairs.forEach((pair, index) => {
      const colorIndex = index % colors.length;
      newBracketColors[pair.openLine] = colors[colorIndex];
      newBracketColors[pair.closeLine] = colors[colorIndex];
    });
    
    console.log('括号颜色:', newBracketColors);
    setBracketColors(newBracketColors);
    
    // 根据括号匹配结果，标记所有的可折叠范围
    for (let i = 0; i < lines.length; i++) {
      if (i in bracketMatches) {
        const endLine = bracketMatches[i];
        // 确保范围至少包含一行
        if (endLine > i) {
          // 确定类型 (object 或 array)
          let type = bracketTypes[i] === '{' ? 'object' : 'array';
          
          // 计算范围内的项数
          let itemCount = 0;
          
          // 简化的计数逻辑
          if (type === 'object') {
            // 对象内的键数量
            let keysCount = 0;
            for (let j = i + 1; j < endLine; j++) {
              const line = lines[j].trim();
              if (line.includes('"') && line.includes(':')) {
                keysCount++;
              }
            }
            itemCount = keysCount;
          } else {
            // 数组内的元素数量
            let elementsCount = 0;
            let level = 0;
            for (let j = i + 1; j < endLine; j++) {
              const line = lines[j].trim();
              if (level === 0 && line !== '' && !line.startsWith(']')) {
                if (!line.endsWith(',')) {
                  // 如果这是最后一个元素
                  elementsCount++;
                } else if (line.endsWith(',')) {
                  elementsCount++;
                }
              }
              
              // 跟踪嵌套层级
              for (let k = 0; k < line.length; k++) {
                const char = line[k];
                if (char === '{' || char === '[') level++;
                else if (char === '}' || char === ']') level--;
              }
            }
            itemCount = elementsCount;
          }
          
          // 添加到可折叠范围列表
          ranges.push({
            start: i,
            end: endLine,
            type: type,
            count: itemCount
          });
          
          console.log(`添加可折叠范围: 第${i+1}行到第${endLine+1}行，类型:${type}，包含${itemCount}项`);
        }
      }
    }
    
    console.log('识别到的可折叠范围:', ranges);
    setCollapsibleRanges(ranges);
  };

  // 解析JSON输入
  const parseJson = () => {
    if (!inputJson.trim()) {
      setOutputJson('');
      setParsedJson(null);
      setError('');
      setIsValid(false);
      setCollapsibleRanges([]);
      setCollapsedLines({});
      setHiddenLines({});
      setBracketColors({});
      return;
    }

    try {
      // 先尝试解析JSON确保有效性
      const parsed = JSON.parse(inputJson);
      
      // 格式化输出，这会对JSON进行统一的格式化处理
      const formatted = JSON.stringify(parsed, null, 2);
      
      console.log('JSON解析成功，开始查找可折叠范围');
      
      // 设置状态
      setOutputJson(formatted);
      setParsedJson(parsed);
      setError('');
      setIsValid(true);
      
      // 使用已格式化的JSON字符串查找可折叠范围
      findFoldableRanges(formatted);
    } catch (err) {
      // 处理解析错误
      const errorMessage = err instanceof Error ? err.message : '无效的JSON';
      console.error('JSON解析错误:', errorMessage);
      
      setError(errorMessage);
      setOutputJson('');
      setParsedJson(null);
      setIsValid(false);
      setCollapsibleRanges([]);
      setCollapsedLines({});
      setHiddenLines({});
      setBracketColors({});
    }
  };

  // 切换折叠状态
  const toggleCollapse = (startLine: number, endLine: number, type: string) => {
    console.log(`切换折叠状态: 行 ${startLine+1}-${endLine+1}, 类型: ${type}`);
    
    setCollapsedLines(prev => {
      const isCollapsed = prev[startLine];
      const newState = { ...prev };
      newState[startLine] = !isCollapsed;
      
      // 更新隐藏的行
      const newHiddenLines = { ...hiddenLines };
      
      if (isCollapsed) {
        // 展开，移除隐藏的行
        for (let i = startLine + 1; i < endLine; i++) {
          delete newHiddenLines[i];
        }
        console.log(`展开了 ${type}, 行 ${startLine+1}-${endLine+1}`);
      } else {
        // 折叠，添加隐藏的行
        for (let i = startLine + 1; i < endLine; i++) {
          newHiddenLines[i] = true;
        }
        console.log(`折叠了 ${type}, 行 ${startLine+1}-${endLine+1}, 隐藏了${endLine-startLine-1}行`);
      }
      
      setHiddenLines(newHiddenLines);
      return newState;
    });
  };

  // 渲染带有折叠功能的JSON
  const renderJSON = () => {
    if (!outputJson) return null;
    
    const lines = outputJson.split('\n');
    return (
      <div>
        {lines.map((line, index) => {
          const isCollapsed = !!collapsedLines[index];
          const isHidden = !!hiddenLines[index];
          
          // 如果是隐藏的行，不渲染
          if (isHidden) {
            return null;
          }
          
          // 查找此行是否是可折叠范围的开始
          const range = collapsibleRanges.find(r => r.start === index);
          const isFoldable = !!range;
          
          // 标记为折叠开始的行
          const isCollapsedStart = collapsedLines[index] === true;
          
          // 处理语法高亮的颜色
          const colorizedLine = () => {
            const trimmedLine = line.trim();
            let indentation = '';
            
            // 获取缩进
            for (let i = 0; i < line.length; i++) {
              if (line[i] === ' ' || line[i] === '\t') {
                indentation += line[i];
              } else {
                break;
              }
            }
            
            // 获取这一行的括号颜色
            const bracketColor = bracketColors[index] || '#f8f8f2';
            
            // 单独一行是括号 {} []
            if (trimmedLine === '{' || trimmedLine === '}' || 
                trimmedLine === '[' || trimmedLine === ']' ||
                trimmedLine === '{,' || trimmedLine === '},' ||
                trimmedLine === '[,' || trimmedLine === '],') {
              return <span><span style={{ color: '#f8f8f2' }}>{indentation}</span><span style={{ color: bracketColor, fontWeight: 'bold' }}>{trimmedLine}</span></span>;
            }
            
            // 处理包含括号的行，比如 "capabilities": [
            // 注意匹配可能嵌入在行内的括号
            if (trimmedLine.includes('{') || trimmedLine.includes('}') || 
                trimmedLine.includes('[') || trimmedLine.includes(']')) {
              
              // 检查是行内最后的字符是否是括号
              const lastChar = trimmedLine[trimmedLine.length - 1];
              const hasEndingBracket = lastChar === '{' || lastChar === '[';
              
              // 检查是行内最开始的字符是否是括号
              const firstChar = trimmedLine[0];
              const hasStartingBracket = firstChar === '}' || firstChar === ']';
              
              if (hasEndingBracket || hasStartingBracket) {
                // 如果是键值对后面带括号，如 "capabilities": [
                if (trimmedLine.includes(':') && hasEndingBracket) {
                  const colonIndex = trimmedLine.indexOf(':');
                  const keyPart = trimmedLine.substring(0, colonIndex + 1);
                  const remainingPart = trimmedLine.substring(colonIndex + 1).trim();
                  
                  return (
                    <span>
                      <span style={{ color: '#f8f8f2' }}>{indentation}</span>
                      <span style={{ color: '#f92672' }}>{keyPart.substring(0, keyPart.length - 1)}</span>
                      <span style={{ color: '#f8f8f2' }}>:</span>
                      <span style={{ color: '#f8f8f2' }}>{remainingPart.substring(0, remainingPart.length - 1)}</span>
                      <span style={{ color: bracketColor, fontWeight: 'bold' }}>{lastChar}</span>
                    </span>
                  );
                }
                
                // 如果是以括号开头并带逗号，如 },
                else if (hasStartingBracket && trimmedLine.endsWith(',')) {
                  return (
                    <span>
                      <span style={{ color: '#f8f8f2' }}>{indentation}</span>
                      <span style={{ color: bracketColor, fontWeight: 'bold' }}>{firstChar}</span>
                      <span style={{ color: '#f8f8f2' }}>{trimmedLine.substring(1)}</span>
                    </span>
                  );
                }
              }
            }
            
            // 匹配键名
            const keyMatch = trimmedLine.match(/^"([^"]+)":/);
            if (keyMatch) {
              const keyPart = keyMatch[0];
              const restPart = trimmedLine.slice(keyPart.length);
              
              return (
                <span>
                  <span style={{ color: '#f8f8f2' }}>{indentation}</span>
                  <span style={{ color: '#f92672' }}>{keyPart.slice(0, -1)}</span>
                  <span style={{ color: '#f8f8f2' }}>:</span>
                  {restPart && (
                    <span>
                      {restPart.endsWith(',') ? (
                        <>
                          <span style={{ color: restPart.includes('"') ? '#a6e22e' : '#ae81ff' }}>{restPart.slice(0, -1)}</span>
                          <span style={{ color: '#f8f8f2' }}>,</span>
                        </>
                      ) : (
                        <span style={{ color: restPart.includes('"') ? '#a6e22e' : '#ae81ff' }}>{restPart}</span>
                      )}
                    </span>
                  )}
                </span>
              );
            }
            
            // 字符串值
            if ((trimmedLine.startsWith('"') && trimmedLine.endsWith('",')) || 
                (trimmedLine.startsWith('"') && trimmedLine.endsWith('"'))) {
              return (
                <span>
                  <span style={{ color: '#f8f8f2' }}>{indentation}</span>
                  {trimmedLine.endsWith(',') ? (
                    <>
                      <span style={{ color: '#a6e22e' }}>{trimmedLine.slice(0, -1)}</span>
                      <span style={{ color: '#f8f8f2' }}>,</span>
                    </>
                  ) : (
                    <span style={{ color: '#a6e22e' }}>{trimmedLine}</span>
                  )}
                </span>
              );
            }
            
            // 数字、布尔值和null
            if (trimmedLine.match(/^(true|false|null|-?\d+\.?\d*)(,?)$/)) {
              const hasComma = trimmedLine.endsWith(',');
              const valueText = hasComma ? trimmedLine.slice(0, -1) : trimmedLine;
              
              return (
                <span>
                  <span style={{ color: '#f8f8f2' }}>{indentation}</span>
                  <span style={{ color: '#ae81ff' }}>{valueText}</span>
                  {hasComma && <span style={{ color: '#f8f8f2' }}>,</span>}
                </span>
              );
            }
            
            // 默认情况
            return <span style={{ color: '#f8f8f2' }}>{line}</span>;
          };
          
          return (
            <div key={index} className="json-line">
              <div className="line-number">
                <div className="folding-controls">
                  {isFoldable && (
                    <span 
                      className="folding-icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(range.start, range.end, range.type);
                      }}
                      title={isCollapsedStart ? '展开' : '折叠'}
                    >
                      {isCollapsedStart ? '+' : '-'}
                    </span>
                  )}
                  {!isFoldable && <span style={{ width: '18px', display: 'inline-block' }}></span>}
                </div>
                <span className="line-number-text">{index + 1}</span>
              </div>
              <div className="line-content">
                {colorizedLine()}
                {isCollapsedStart && range && (
                  <span 
                    className="json-ellipsis" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(range.start, range.end, range.type);
                    }}
                    title="点击展开"
                    style={{ cursor: 'pointer' }}
                  >
                    ... {range.type === 'object' 
                      ? `${range.count} 个属性` 
                      : `${range.count} 个元素`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 添加一个示例JSON
  const exampleJson = `{
    "text": "为什么一周的第一天是星期天？",
    "quest_code": "w01",
    "system_data": {
      "name": "海螺AI",
      "version": "2.0",
      "capabilities": [
        "写作文",
        "答题",
        "文章分析",
        "翻译"
      ],
      "char_limit": 500,
      "description": "海螺AI是一个智能助手，可以回答各种问题。海螺AI是一个智能助手，可以回答各种问题海螺AI是一个智能助手，可以回答各种问题海螺AI是一个智能助手，可以回答各种问题"
    },
    "data": [
      {
        "user_msg": "为什么一周的第一天是星期天？",
        "timestamp": "2023-04-01T12:34:56Z"
      },
      {
        "ai_function_call": {
          "name": "search_web",
          "parameters": {
            "tag": "文化",
            "query_list": [
              "星期天开始 起源",
              "西方日历 星期几 历史"
            ]
          }
        }
      }
    ]
  }`;

  // 添加示例加载函数
  const handleExampleLoad = () => {
    console.log("加载JSON示例");
    
    // 设置输入文本
    setInputJson(exampleJson);
    
    // 使用parseJson函数处理
    try {
      const parsed = JSON.parse(exampleJson);
      const formatted = JSON.stringify(parsed, null, 2);
      
      console.log('示例JSON加载成功，开始查找可折叠范围');
      
      // 设置状态
      setOutputJson(formatted);
      setParsedJson(parsed);
      setError('');
      setIsValid(true);
      
      // 分析可折叠范围
      findFoldableRanges(formatted);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '示例JSON无效';
      console.error('示例JSON解析错误:', errorMessage);
      setError(errorMessage);
    }
    
    console.log("示例JSON加载完成");
  };

  // 全部折叠函数
  const handleCollapseAll = () => {
    if (!isValid || !outputJson) return;
    
    console.log("执行全部折叠操作");
    
    const newCollapsedLines: Record<number, boolean> = {};
    const newHiddenLines: Record<number, boolean> = {};
    
    // 遍历所有可折叠范围，将它们全部折叠
    collapsibleRanges.forEach(range => {
      // 标记折叠起始行
      newCollapsedLines[range.start] = true;
      
      // 隐藏范围内的行
      for (let i = range.start + 1; i < range.end; i++) {
        newHiddenLines[i] = true;
      }
    });
    
    setCollapsedLines(newCollapsedLines);
    setHiddenLines(newHiddenLines);
    
    console.log("全部折叠完成，折叠了", Object.keys(newCollapsedLines).length, "个范围");
  };

  // 全部展开函数
  const handleExpandAll = () => {
    console.log("执行全部展开操作");
    setCollapsedLines({});
    setHiddenLines({});
    console.log("全部展开完成");
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-gray-50 dark:bg-gray-900 overscroll-contain">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
            JSON解析工具
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300">
            输入JSON文本，验证其有效性并格式化显示
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左侧输入框 */}
          <div className="rounded-lg overflow-hidden shadow-sm">
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">输入JSON</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExampleLoad}
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                >
                  加载示例
                </button>
                <button
                  onClick={() => setInputJson('')}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  清空
                </button>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4">
              <textarea
                className="w-full h-[500px] p-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent overscroll-contain"
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                placeholder='在此输入JSON，例如：{"name": "张三", "age": 25}'
              />
            </div>
          </div>

          {/* 右侧输出框 */}
          <div className="rounded-lg overflow-hidden shadow-sm">
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center">
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">格式化JSON</h2>
                {isValid && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                    有效
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCollapseAll}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                  disabled={!isValid || !outputJson}
                >
                  全部折叠
                </button>
                <button
                  onClick={handleExpandAll}
                  className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded"
                  disabled={!isValid || !outputJson}
                >
                  全部展开
                </button>
                <label className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    className="form-checkbox h-3 w-3 text-blue-500 rounded mr-1"
                    checked={softWrap}
                    onChange={(e) => setSoftWrap(e.target.checked)}
                  />
                  自动换行
                </label>
                <button
                  onClick={() => {
                    if (outputJson) {
                      navigator.clipboard.writeText(outputJson);
                    }
                  }}
                  disabled={!outputJson}
                  className={`text-xs ${
                    outputJson 
                      ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300' 
                      : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  复制
                </button>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 h-full">
              {error ? (
                <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-400">无效的JSON</h3>
                      <div className="mt-2 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap font-mono">
                        {error}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[500px] overflow-y-auto overscroll-contain p-2 bg-[#272822] border border-gray-300 dark:border-gray-700 rounded-md">
                  {outputJson ? (
                    <div className="syntax-highlighter h-auto">
                      {renderJSON()}
                    </div>
                  ) : (
                    <span className="text-gray-400">在左侧输入JSON后将在此处显示格式化结果</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">JSON小贴士</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-300">
              <ul className="list-disc pl-5 space-y-1">
                <li>JSON中的键必须用双引号(")包围</li>
                <li>字符串值必须用双引号(")包围</li>
                <li>数字、布尔值(true/false)和null不需要引号</li>
                <li>不要在最后一个元素后面加逗号</li>
                <li>不支持注释</li>
                <li>点击行号左侧的 <span className="inline-block w-4 h-4 leading-4 text-center bg-gray-200 dark:bg-gray-700 rounded" style={{ fontSize: '10px' }}>-</span> 或 <span className="inline-block w-4 h-4 leading-4 text-center bg-gray-200 dark:bg-gray-700 rounded" style={{ fontSize: '10px' }}>+</span> 可以折叠或展开JSON对象和数组</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
