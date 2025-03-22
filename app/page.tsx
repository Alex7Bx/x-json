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
        background-color: rgba(255, 255, 255, 0.15);
        color: #f8f8f2;
        border-radius: 4px;
        cursor: pointer;
        user-select: none;
        font-size: 14px;
        font-weight: bold;
        margin-right: 0;
        transition: all 0.2s ease;
      }
      .folding-icon:hover {
        background-color: rgba(255, 255, 255, 0.3);
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
    
    // 第一步: 首先执行括号匹配，记录每个开始括号匹配的结束括号
    // 使用栈来进行括号匹配
    const bracketMatches: Record<number, number> = {}; // 开始行号到结束行号的映射
    const bracketStack: {lineIndex: number, char: string, lineContent: string}[] = [];
    
    // 预处理，先确定每行的实际内容
    const lineContents: string[] = lines.map(line => line.trim());
    
    // 记录每行是否包含各种括号
    for (let i = 0; i < lines.length; i++) {
      const line = lineContents[i];
      if (!line) continue;
      
      // 检查是否包含开始括号 { 或 [
      let containsOpeningBracket = false;
      let openingBracketChar = '';
      if (line === '{' || line.endsWith('{')) {
        containsOpeningBracket = true;
        openingBracketChar = '{';
      } else if (line === '[' || line.endsWith('[')) {
        containsOpeningBracket = true;
        openingBracketChar = '[';
      }
      
      // 处理开始括号
      if (containsOpeningBracket) {
        // 入栈
        bracketStack.push({
          lineIndex: i,
          char: openingBracketChar,
          lineContent: line
        });
      }
      
      // 检查是否包含结束括号 } 或 ]
      let containsClosingBracket = false;
      let closingBracketChar = '';
      if (line === '}' || line === '},' || line.startsWith('}')) {
        containsClosingBracket = true;
        closingBracketChar = '}';
      } else if (line === ']' || line === '],' || line.startsWith(']')) {
        containsClosingBracket = true;
        closingBracketChar = ']';
      }
      
      // 处理结束括号
      if (containsClosingBracket && bracketStack.length > 0) {
        const matchingOpening = bracketStack.pop()!;
        const expectedClosing = matchingOpening.char === '{' ? '}' : ']';
        
        // 确保括号类型匹配
        if (closingBracketChar === expectedClosing) {
          // 记录匹配关系
          bracketMatches[matchingOpening.lineIndex] = i;
        } else {
          console.warn(`括号不匹配: 第${matchingOpening.lineIndex+1}行的${matchingOpening.char}与第${i+1}行的${closingBracketChar}`);
        }
      }
    }
    
    console.log('括号匹配结果:', bracketMatches);
    
    // 第二步: 根据括号匹配结果，标记所有的可折叠范围
    for (let i = 0; i < lines.length; i++) {
      const line = lineContents[i];
      if (!line) continue;
      
      // 如果这一行是开始括号，且有对应的结束括号
      if (i in bracketMatches) {
        const endLine = bracketMatches[i];
        // 确保范围至少包含一行
        if (endLine > i) {
          // 确定类型 (object 或 array)
          let type = 'object';
          if (line === '[' || line.endsWith('[')) {
            type = 'array';
          }
          
          // 计算范围内的项数 - 简化版本
          let itemCount = 0;
          
          // 创建一个包含此范围所有行的字符串
          const rangeText = lines.slice(i, endLine + 1).join('\n');
          
          try {
            // 尝试解析这个范围的JSON片段
            // 先提取要解析的实际JSON
            let jsonToCount = rangeText;
            // 如果行以键名开始，我们需要添加包装使它成为有效JSON
            if (line.includes('"') && line.includes(':')) {
              // 找到冒号位置，只取冒号后面的部分
              const colonIndex = line.indexOf(':');
              if (colonIndex !== -1) {
                const afterColon = line.substring(colonIndex + 1).trim();
                // 如果冒号后是{或[，则只解析该部分
                if (afterColon === '{' || afterColon === '[') {
                  jsonToCount = lines.slice(i, endLine + 1).join('\n');
                }
              }
            }
            
            // 格式检查和调整
            if (type === 'object') {
              // 确保要解析的文本是一个有效的JSON对象
              if (!jsonToCount.startsWith('{')) {
                jsonToCount = '{' + jsonToCount.substring(jsonToCount.indexOf('{') + 1);
              }
              
              if (jsonToCount.trim() === '{' || jsonToCount.trim() === '{}') {
                itemCount = 0;
              } else {
                // 更健壮的计数方法 - 对象属性数量
                // 计算顶层键值对数量
                let keysCount = 0;
                let bracketDepth = 0;
                let inString = false;
                let escape = false;
                
                // 从第一行之后开始，到最后一行之前结束
                for (let j = i + 1; j < endLine; j++) {
                  const currentLine = lineContents[j];
                  if (!currentLine) continue;
                  
                  // 只计算顶层的键
                  if (bracketDepth === 0 && currentLine.includes('"') && currentLine.includes(':')) {
                    keysCount++;
                  }
                  
                  // 跟踪大括号深度
                  for (let k = 0; k < currentLine.length; k++) {
                    const char = currentLine[k];
                    
                    if (escape) {
                      escape = false;
                      continue;
                    }
                    
                    if (char === '\\') {
                      escape = true;
                      continue;
                    }
                    
                    if (char === '"' && !escape) {
                      inString = !inString;
                      continue;
                    }
                    
                    if (!inString) {
                      if (char === '{' || char === '[') {
                        bracketDepth++;
                      } else if (char === '}' || char === ']') {
                        bracketDepth--;
                      }
                    }
                  }
                }
                
                itemCount = keysCount;
              }
            } else if (type === 'array') {
              // 确保要解析的文本是一个有效的JSON数组
              if (!jsonToCount.startsWith('[')) {
                jsonToCount = '[' + jsonToCount.substring(jsonToCount.indexOf('[') + 1);
              }
              
              if (jsonToCount.trim() === '[' || jsonToCount.trim() === '[]') {
                itemCount = 0;
              } else {
                // 计算数组元素数量
                // 对于数组，我们计算逗号+1来得到元素数
                let elementsCount = 0;
                let bracketDepth = 0;
                let inString = false;
                let escape = false;
                
                // 遍历每行
                for (let j = i + 1; j < endLine; j++) {
                  const currentLine = lineContents[j];
                  if (!currentLine) continue;
                  
                  // 如果是顶层的元素行（不是开始或结束括号）
                  if (bracketDepth === 0 && 
                      !currentLine.startsWith('[') && !currentLine.startsWith(']') &&
                      !currentLine.startsWith('{') && !currentLine.startsWith('}')) {
                    elementsCount++;
                  }
                  
                  // 如果是新的对象或数组开始且在顶层
                  if (bracketDepth === 0 && 
                      (currentLine === '{' || currentLine === '[' || 
                       currentLine.startsWith('{') || currentLine.startsWith('['))) {
                    elementsCount++;
                  }
                  
                  // 跟踪括号深度
                  for (let k = 0; k < currentLine.length; k++) {
                    const char = currentLine[k];
                    
                    if (escape) {
                      escape = false;
                      continue;
                    }
                    
                    if (char === '\\') {
                      escape = true;
                      continue;
                    }
                    
                    if (char === '"' && !escape) {
                      inString = !inString;
                      continue;
                    }
                    
                    if (!inString) {
                      if (char === '{' || char === '[') {
                        bracketDepth++;
                      } else if (char === '}' || char === ']') {
                        bracketDepth--;
                      }
                    }
                  }
                }
                
                itemCount = elementsCount;
              }
            }
          } catch (err) {
            console.warn('计算元素数量时出错:', err);
            itemCount = Math.max(0, endLine - i - 1); // 回退方案：简单地计算行数减2作为元素数
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
            
            // 括号 {} []
            if (trimmedLine === '{' || trimmedLine === '}' || 
                trimmedLine === '[' || trimmedLine === ']' ||
                trimmedLine === '{,' || trimmedLine === '},' ||
                trimmedLine === '[,' || trimmedLine === '],') {
              return <span><span style={{ color: '#f8f8f2' }}>{indentation}</span><span style={{ color: '#f8f8f2' }}>{trimmedLine}</span></span>;
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
      "description": "海螺AI是一个智能助手，可以回答各种问题。"
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
    <div className="min-h-screen py-8 px-4 bg-gray-50 dark:bg-gray-900">
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
                className="w-full h-[500px] p-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div className="h-[500px] overflow-auto p-2 bg-[#272822] border border-gray-300 dark:border-gray-700 rounded-md">
                  {outputJson ? (
                    <div className="syntax-highlighter">
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
