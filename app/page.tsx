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
  const [isButtonActive, setIsButtonActive] = useState(false);
  const [isCompressed, setIsCompressed] = useState(false);

  useEffect(() => {
    parseJson();
  }, [inputJson, isCompressed]);

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
      '#b4683c', '#3cb47e', '#ffe119', '#4363d8', 
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
          
          // 改进的计数逻辑，只计算一级属性或元素
          if (type === 'object') {
            // 对象内的一级键数量
            let keysCount = 0;
            let objLevel = 0; // 跟踪对象的嵌套层级
            
            for (let j = i + 1; j < endLine; j++) {
              const line = lines[j].trim();
              
              // 如果是对象的结束括号，则跳过
              if (line === '}') break;
              
              // 先计算行开始时的嵌套层级
              let startLevel = objLevel;
              
              // 更新本行结束后的嵌套层级
              for (let k = 0; k < line.length; k++) {
                const char = line[k];
                if (char === '{' || char === '[') objLevel++;
                else if (char === '}' || char === ']') objLevel--;
              }
              
              // 只计算一级属性（行开始时嵌套层级为0，并且包含键值对标记）
              if (startLevel === 0 && line.includes('"') && line.includes(':')) {
                keysCount++;
              }
            }
            itemCount = keysCount;
          } else {
            // 数组内的一级元素数量 - 改进版
            let elementsCount = 0;
            
            // 使用更简单但更可靠的方法来计数数组元素
            // 直接从JSON结构中获取对应的数组并计算长度
            try {
              // 获取当前数组路径
              const arrayPath = [];
              let depth = 0;
              
              // 获取这个数组的完整路径
              for (let j = 0; j < i; j++) {
                const line = lines[j].trim();
                
                // 如果这一行包含键名且下一行就是当前数组，则记录这个键
                if (j + 1 === i && line.includes(':')) {
                  const keyMatch = line.match(/"([^"]+)":/);
                  if (keyMatch) {
                    arrayPath.push(keyMatch[1]);
                  }
                }
              }
              
              // 在解析后的JSON中查找这个数组
              let currentObj = parsedJson;
              for (const key of arrayPath) {
                if (currentObj && typeof currentObj === 'object' && key in currentObj) {
                  currentObj = currentObj[key];
                } else {
                  // 路径不存在，使用手动计数
                  currentObj = null;
                  break;
                }
              }
              
              // 如果成功找到数组，直接获取长度
              if (Array.isArray(currentObj)) {
                elementsCount = currentObj.length;
              } else {
                // 回退到基于行的计数方法
                elementsCount = countArrayElementsFromLines(lines, i, endLine);
              }
            } catch (err) {
              // 如果有任何错误，回退到基于行的计数方法
              elementsCount = countArrayElementsFromLines(lines, i, endLine);
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
      
      // 根据压缩状态决定格式化方式
      // 如果是压缩模式，不添加缩进和换行；否则使用2个空格缩进
      const formatted = isCompressed 
        ? JSON.stringify(parsed) 
        : JSON.stringify(parsed, null, 2);
      
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

  // 全部折叠函数
  const handleCollapseAll = () => {
    if (!isValid || !outputJson) return;
    
    console.log("执行全部折叠操作");
    
    const newCollapsedLines: Record<number, boolean> = {};
    const newHiddenLines: Record<number, boolean> = {};
    
    // 标记所有可折叠范围为折叠状态
    collapsibleRanges.forEach(range => {
      newCollapsedLines[range.start] = true;
    });
    
    // 确定哪些行应该被隐藏（仅在顶层范围内的行）
    // 找出顶层范围（不包含在其他范围内的范围）
    const topLevelRanges = collapsibleRanges.filter(range => {
      // 检查这个范围是否是顶层范围（不在其他范围内）
      return !collapsibleRanges.some(otherRange => 
        otherRange.start < range.start && otherRange.end > range.end
      );
    });
    
    // 只隐藏顶层范围内的行
    topLevelRanges.forEach(range => {
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
  
  // 切换全部折叠/展开状态
  const toggleCollapseAll = () => {
    // 检查是否有折叠的节点，判断当前状态
    const hasCollapsedNodes = Object.keys(collapsedLines).length > 0;
    
    if (hasCollapsedNodes) {
      // 当前有折叠节点，执行全部展开
      handleExpandAll();
    } else {
      // 当前全部展开，执行全部折叠
      handleCollapseAll();
    }
  };
  
  // 切换自动换行
  const toggleSoftWrap = () => {
    setSoftWrap(!softWrap);
  };

  // 切换压缩/展开JSON
  const toggleCompression = () => {
    // 切换压缩状态
    const newCompressedState = !isCompressed;
    setIsCompressed(newCompressedState);
    
    // 如果当前有有效的JSON，需要重新格式化
    if (parsedJson) {
      const formatted = newCompressedState 
        ? JSON.stringify(parsedJson) 
        : JSON.stringify(parsedJson, null, 2);
      
      setOutputJson(formatted);
      
      // 重新计算可折叠范围（当切换到展开状态时）
      if (!newCompressedState) {
        findFoldableRanges(formatted);
      } else {
        // 压缩模式下清除折叠状态
        setCollapsibleRanges([]);
        setCollapsedLines({});
        setHiddenLines({});
      }
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
        
        // 找到所有直接属于该范围的子折叠项
        const childRanges = collapsibleRanges.filter(range => 
          range.start > startLine && range.end < endLine &&
          // 确保它们是直接子级，而不是孙级或更深层级
          !collapsibleRanges.some(otherRange => 
            otherRange.start > startLine && otherRange.end < endLine &&
            range.start > otherRange.start && range.end < otherRange.end
          )
        );
        
        // 对每个直接子折叠项，如果折叠标记为true，则重新隐藏其内容
        childRanges.forEach(childRange => {
          if (newState[childRange.start]) {
            for (let i = childRange.start + 1; i < childRange.end; i++) {
              newHiddenLines[i] = true;
            }
            console.log(`保持子折叠项 ${childRange.start+1}-${childRange.end+1} 的折叠状态`);
          }
        });
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
    
    // 如果是压缩模式且只有一行，直接渲染整行
    if (isCompressed && !outputJson.includes('\n')) {
      return (
        <div className="json-line">
          <div className="line-content" style={{ width: '100%', paddingLeft: 0 }}>
            <span style={{ color: '#f8f8f2' }}>{outputJson}</span>
          </div>
        </div>
      );
    }
    
    // 标准多行渲染
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
      "name": "Your AI",
      "version": "2.0",
      "capabilities": [
        "写作文",
        "答题",
        "文章分析",
        "翻译"
      ],
      "char_limit": 500,
      "description": "Your AI是一个智能助手，可以回答各种问题。YourAI是一个智能助手，可以回答各种问题YourAI是一个智能助手，可以回答各种问题YourAI是一个智能助手，可以回答各种问题"
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

  // 在代码中添加这个辅助函数，用于通过行分析计算数组元素
  function countArrayElementsFromLines(lines: string[], startLine: number, endLine: number): number {
    let elementsCount = 0;
    let arrLevel = 0;
    let insideElement = false;
    
    for (let j = startLine + 1; j < endLine; j++) {
      const line = lines[j].trim();
      if (line === '') continue;
      if (line === ']') break;
      
      // 计算当前行的嵌套层级变化
      let levelChange = 0;
      for (let k = 0; k < line.length; k++) {
        const char = line[k];
        if (char === '{' || char === '[') levelChange++;
        else if (char === '}' || char === ']') levelChange--;
      }
      
      // 处理元素开始
      if (arrLevel === 0 && !insideElement) {
        // 找到新元素的开始
        elementsCount++;
        insideElement = true;
        
        // 如果这行既开始又结束了一个元素，并且以逗号结束
        if (levelChange === 0 && line.endsWith(',')) {
          insideElement = false;
        }
        // 如果这行开始了一个复杂元素（对象或数组）
        else if (levelChange > 0) {
          arrLevel += levelChange;
        }
      }
      // 处理已经在元素内的情况
      else if (insideElement) {
        // 更新嵌套层级
        arrLevel += levelChange;
        
        // 如果回到了顶层并且行尾有逗号，表示元素结束
        if (arrLevel === 0 && line.endsWith(',')) {
          insideElement = false;
        }
        // 如果回到了顶层但没有逗号，可能是最后一个元素
        else if (arrLevel === 0) {
          // 检查是否是数组的最后一个元素
          if (j + 1 < endLine && lines[j + 1].trim() === ']') {
            insideElement = false;
          }
        }
      }
    }
    
    return elementsCount;
  }

  // JSON转义处理函数
  const handleEscapeJson = () => {
    if (!inputJson) return;
    
    try {
      // 对输入的内容进行JSON转义
      const escaped = inputJson.replace(/[\\"']/g, '\\$&')
                             .replace(/\u0000/g, '\\u0000')
                             .replace(/\u001F/g, '\\u001F')
                             .replace(/\n/g, '\\n')
                             .replace(/\r/g, '\\r')
                             .replace(/\t/g, '\\t');
      
      setInputJson(escaped);
    } catch (err) {
      console.error('JSON转义失败:', err);
    }
  };

  // JSON反转义处理函数
  const handleUnescapeJson = () => {
    if (!inputJson) return;
    
    try {
      // 对已转义的JSON进行反转义
      const unescaped = inputJson.replace(/\\"/g, '"')
                               .replace(/\\\\/g, '\\')
                               .replace(/\\n/g, '\n')
                               .replace(/\\r/g, '\r')
                               .replace(/\\t/g, '\t')
                               .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
                                 return String.fromCharCode(parseInt(code, 16));
                               });
      
      setInputJson(unescaped);
    } catch (err) {
      console.error('JSON反转义失败:', err);
    }
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
                  onClick={handleEscapeJson}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded"
                  title="将JSON文本中的特殊字符转义"
                >
                  转义
                </button>
                <button
                  onClick={handleUnescapeJson}
                  className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded"
                  title="将已转义的JSON文本恢复为原始文本"
                >
                  反转义
                </button>
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
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleCompression}
                  className={`text-xs px-3 py-1.5 rounded transition-colors duration-200 flex items-center ${
                    isCompressed 
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                  disabled={!isValid || !outputJson}
                >
                  <span>{isCompressed ? '展开' : '压缩'}</span>
                </button>
                <button
                  onClick={toggleCollapseAll}
                  className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded flex items-center transition-colors duration-200"
                  disabled={!isValid || !outputJson || isCompressed}
                >
                  <span>{Object.keys(collapsedLines).length > 0 ? '全部展开' : '全部折叠'}</span>
                </button>
                <button
                  onClick={toggleSoftWrap}
                  className={`text-xs px-3 py-1.5 rounded transition-colors duration-200 flex items-center ${
                    softWrap 
                      ? 'bg-teal-500 hover:bg-teal-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span>{softWrap ? '取消自动换行' : '自动换行'}</span>
                </button>
                <button
                  onClick={() => {
                    if (outputJson) {
                      // 点击时激活按钮状态
                      setIsButtonActive(true);
                      
                      // 复制文本
                      navigator.clipboard.writeText(outputJson)
                        .then(() => {
                          // 成功后短暂延迟恢复状态
                          setTimeout(() => setIsButtonActive(false), 200);
                        })
                        .catch(err => {
                          console.error('复制失败:', err);
                          // 失败后也恢复状态
                          setTimeout(() => setIsButtonActive(false), 200);
                        });
                    }
                  }}
                  disabled={!outputJson}
                  className={`text-xs px-3 py-1.5 rounded transition-all duration-200 flex items-center ${
                    !outputJson 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : isButtonActive
                        ? 'bg-blue-700 text-white transform scale-95' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
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
