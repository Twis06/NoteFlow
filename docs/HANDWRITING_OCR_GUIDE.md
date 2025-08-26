# 手写OCR功能使用指南

## 概述

本系统提供了强大的手写文字识别(OCR)功能，支持从图片中提取手写文字并转换为可编辑的文本。系统集成了多个OCR服务提供商，确保高准确率的文字识别。

## 功能特性

- **多语言支持**：支持中文、英文等多种语言的手写文字识别
- **多服务商支持**：集成百度OCR、腾讯OCR等多个服务提供商
- **多格式支持**：支持JPG、PNG、GIF、WEBP等常见图片格式
- **高性能处理**：优化的图片处理和文字识别流程
- **安全可靠**：完善的错误处理和数据验证机制

## API端点

### 手写OCR识别

**端点**: `POST /api/ocr/handwritten`

**请求格式**:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "provider": "baidu",
  "options": {
    "language": "zh-CN",
    "enhance": true
  }
}
```

**参数说明**:
- `image` (必需): Base64编码的图片数据，包含完整的data URI格式
- `provider` (可选): OCR服务提供商，支持 `baidu`、`tencent`，默认为 `baidu`
- `options` (可选): 识别选项
  - `language`: 识别语言，默认为 `zh-CN`
  - `enhance`: 是否启用图片增强，默认为 `true`

**响应格式**:
```json
{
  "success": true,
  "data": {
    "text": "识别出的文字内容",
    "confidence": 0.95,
    "provider": "baidu",
    "processTime": 1234,
    "words": [
      {
        "text": "单词1",
        "confidence": 0.98,
        "location": {
          "left": 100,
          "top": 50,
          "width": 80,
          "height": 30
        }
      }
    ]
  }
}
```

## 前端集成示例

### 1. HTML结构

```html
<!DOCTYPE html>
<html>
<head>
    <title>手写OCR识别</title>
    <style>
        .upload-area {
            border: 2px dashed #ccc;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: border-color 0.3s;
        }
        .upload-area:hover {
            border-color: #007bff;
        }
        .preview-image {
            max-width: 100%;
            max-height: 300px;
            margin: 20px 0;
        }
        .result-text {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            white-space: pre-wrap;
        }
        .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>手写文字识别</h1>
        
        <!-- 文件上传区域 -->
        <div class="upload-area" onclick="document.getElementById('fileInput').click()">
            <p>点击或拖拽图片到此处</p>
            <p>支持 JPG、PNG、GIF、WEBP 格式</p>
        </div>
        <input type="file" id="fileInput" accept="image/*" style="display: none;">
        
        <!-- 图片预览 -->
        <div id="preview"></div>
        
        <!-- 加载状态 -->
        <div class="loading" id="loading">
            <p>正在识别中，请稍候...</p>
        </div>
        
        <!-- 识别结果 -->
        <div id="result"></div>
    </div>

    <script src="handwriting-ocr.js"></script>
</body>
</html>
```

### 2. JavaScript实现

```javascript
// handwriting-ocr.js

class HandwritingOCR {
    constructor(apiBaseUrl = '') {
        this.apiBaseUrl = apiBaseUrl;
        this.init();
    }

    /**
     * 初始化事件监听器
     */
    init() {
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.querySelector('.upload-area');

        // 文件选择事件
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // 拖拽上传支持
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#007bff';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ccc';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ccc';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFileSelect(file);
            }
        });
    }

    /**
     * 处理文件选择
     * @param {File} file - 选择的图片文件
     */
    async handleFileSelect(file) {
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        // 验证文件大小 (限制为5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('图片文件不能超过5MB');
            return;
        }

        try {
            // 显示图片预览
            await this.showPreview(file);
            
            // 转换为Base64
            const base64Image = await this.fileToBase64(file);
            
            // 执行OCR识别
            await this.performOCR(base64Image);
        } catch (error) {
            console.error('处理文件时出错:', error);
            this.showError('处理文件时出错，请重试');
        }
    }

    /**
     * 显示图片预览
     * @param {File} file - 图片文件
     */
    showPreview(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('preview');
                preview.innerHTML = `
                    <img src="${e.target.result}" class="preview-image" alt="预览图片">
                `;
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 将文件转换为Base64格式
     * @param {File} file - 图片文件
     * @returns {Promise<string>} Base64编码的图片数据
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 执行OCR识别
     * @param {string} base64Image - Base64编码的图片数据
     */
    async performOCR(base64Image) {
        const loading = document.getElementById('loading');
        const result = document.getElementById('result');
        
        try {
            // 显示加载状态
            loading.style.display = 'block';
            result.innerHTML = '';

            // 调用OCR API
            const response = await fetch(`${this.apiBaseUrl}/api/ocr/handwritten`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    provider: 'baidu', // 可选: baidu, tencent
                    options: {
                        language: 'zh-CN',
                        enhance: true
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showResult(data.data);
            } else {
                throw new Error(data.message || '识别失败');
            }
        } catch (error) {
            console.error('OCR识别出错:', error);
            this.showError(`识别失败: ${error.message}`);
        } finally {
            loading.style.display = 'none';
        }
    }

    /**
     * 显示识别结果
     * @param {Object} data - OCR识别结果数据
     */
    showResult(data) {
        const result = document.getElementById('result');
        
        result.innerHTML = `
            <h3>识别结果</h3>
            <div class="result-text">${data.text || '未识别到文字'}</div>
            <div class="result-info">
                <p><strong>置信度:</strong> ${(data.confidence * 100).toFixed(1)}%</p>
                <p><strong>服务提供商:</strong> ${data.provider}</p>
                <p><strong>处理时间:</strong> ${data.processTime}ms</p>
                <p><strong>识别词数:</strong> ${data.words ? data.words.length : 0}</p>
            </div>
            <button onclick="this.copyToClipboard('${data.text.replace(/'/g, "\\'")}')">复制文本</button>
        `;
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误消息
     */
    showError(message) {
        const result = document.getElementById('result');
        result.innerHTML = `
            <div style="color: red; padding: 15px; border: 1px solid red; border-radius: 4px; background: #ffe6e6;">
                <strong>错误:</strong> ${message}
            </div>
        `;
    }

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('文本已复制到剪贴板');
        } catch (error) {
            console.error('复制失败:', error);
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('文本已复制到剪贴板');
        }
    }
}

// 初始化OCR功能
const ocrApp = new HandwritingOCR();

// 全局函数供HTML调用
function copyToClipboard(text) {
    ocrApp.copyToClipboard(text);
}
```

### 3. React组件示例

```jsx
import React, { useState, useCallback } from 'react';
import './HandwritingOCR.css';

const HandwritingOCR = () => {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    /**
     * 处理文件上传
     */
    const handleFileUpload = useCallback(async (file) => {
        if (!file) return;

        // 验证文件类型和大小
        if (!file.type.startsWith('image/')) {
            setError('请选择图片文件');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('图片文件不能超过5MB');
            return;
        }

        try {
            setError(null);
            setResult(null);
            
            // 显示预览
            const previewUrl = URL.createObjectURL(file);
            setPreview(previewUrl);

            // 转换为Base64
            const base64 = await fileToBase64(file);
            
            // 执行OCR
            await performOCR(base64);
        } catch (err) {
            setError(`处理失败: ${err.message}`);
        }
    }, []);

    /**
     * 文件转Base64
     */
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    /**
     * 执行OCR识别
     */
    const performOCR = async (base64Image) => {
        setLoading(true);
        
        try {
            const response = await fetch('/api/ocr/handwritten', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    provider: 'baidu',
                    options: {
                        language: 'zh-CN',
                        enhance: true
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                setResult(data.data);
            } else {
                throw new Error(data.message || '识别失败');
            }
        } catch (err) {
            setError(`识别失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    /**
     * 复制文本到剪贴板
     */
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('文本已复制到剪贴板');
        } catch (err) {
            console.error('复制失败:', err);
        }
    };

    return (
        <div className="handwriting-ocr">
            <h1>手写文字识别</h1>
            
            {/* 文件上传区域 */}
            <div 
                className="upload-area"
                onClick={() => document.getElementById('fileInput').click()}
                onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file);
                }}
                onDragOver={(e) => e.preventDefault()}
            >
                <p>点击或拖拽图片到此处</p>
                <p>支持 JPG、PNG、GIF、WEBP 格式</p>
            </div>
            
            <input
                type="file"
                id="fileInput"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0])}
            />

            {/* 图片预览 */}
            {preview && (
                <div className="preview">
                    <img src={preview} alt="预览" className="preview-image" />
                </div>
            )}

            {/* 加载状态 */}
            {loading && (
                <div className="loading">
                    <p>正在识别中，请稍候...</p>
                </div>
            )}

            {/* 错误信息 */}
            {error && (
                <div className="error">
                    <strong>错误:</strong> {error}
                </div>
            )}

            {/* 识别结果 */}
            {result && (
                <div className="result">
                    <h3>识别结果</h3>
                    <div className="result-text">{result.text || '未识别到文字'}</div>
                    <div className="result-info">
                        <p><strong>置信度:</strong> {(result.confidence * 100).toFixed(1)}%</p>
                        <p><strong>服务提供商:</strong> {result.provider}</p>
                        <p><strong>处理时间:</strong> {result.processTime}ms</p>
                        <p><strong>识别词数:</strong> {result.words ? result.words.length : 0}</p>
                    </div>
                    <button onClick={() => copyToClipboard(result.text)}>
                        复制文本
                    </button>
                </div>
            )}
        </div>
    );
};

export default HandwritingOCR;
```

## 错误处理

### 常见错误码

- `400`: 请求参数错误
- `401`: 认证失败
- `413`: 文件过大
- `415`: 不支持的文件格式
- `500`: 服务器内部错误
- `503`: OCR服务不可用

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "INVALID_IMAGE_FORMAT",
    "message": "不支持的图片格式",
    "details": "支持的格式: JPG, PNG, GIF, WEBP"
  }
}
```

## 最佳实践

### 1. 图片质量优化
- 确保图片清晰度足够
- 避免过度压缩的图片
- 建议分辨率不低于300DPI
- 文字与背景对比度要高

### 2. 性能优化
- 在前端进行图片预处理和压缩
- 使用适当的图片格式
- 实现请求缓存机制
- 添加请求超时处理

### 3. 用户体验
- 提供清晰的上传指引
- 显示处理进度
- 支持批量处理
- 提供结果编辑功能

## 技术支持

如果在使用过程中遇到问题，请参考以下资源：

1. **API文档**: `/docs/API_USAGE.md`
2. **设置指南**: `/docs/SETUP.md`
3. **故障排除**: 检查网络连接和API密钥配置
4. **性能监控**: 查看服务器日志和响应时间

---

*最后更新: 2025年1月*