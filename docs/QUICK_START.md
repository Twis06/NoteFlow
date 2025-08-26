# Quick Start Guide

Get up and running with the Handwriting OCR Archive System in minutes.

## Prerequisites

- Node.js 18 or higher
- Python 3.7+ (for static file serving)
- Git (for repository management)
- A text editor or IDE

## Required API Keys

Before starting, you'll need:

1. **SiliconFlow API Key**: Sign up at [SiliconFlow Platform](https://siliconflow.cn/)
2. **GitHub Personal Access Token**: Create one with `repo` permissions
3. **Cloudflare API Token** (Optional): For advanced image management

## Installation Steps

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/handwriting-ocr-archive.git
cd handwriting-ocr-archive

# Install backend dependencies
cd backend
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp ../.env.example ../.env

# Edit the .env file with your API keys
# Required:
SILICONFLOW_API_KEY=your_siliconflow_api_key
GITHUB_TOKEN=your_github_personal_access_token

# Optional:
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
```

### 3. Start the System

**Option A: Using the startup script (Recommended)**
```bash
# From project root
./start-all.sh
```

**Option B: Manual startup**
```bash
# Terminal 1: Start backend server
cd backend
node real-server.cjs

# Terminal 2: Start frontend server (new terminal)
cd ..
python3 -m http.server 8080
```

## Access the Application

Once both servers are running:

- **Main OCR Interface**: http://localhost:8080/handwriting-archive.html
- **Admin Dashboard**: http://localhost:8080/admin-dashboard.html

## First Steps

1. **Test the System**: Visit the OCR interface and upload a sample handwritten image
2. **Configure GitHub**: Use the admin dashboard to set up your repository settings
3. **Process Images**: Upload handwritten notes and review the OCR results
4. **Save to GitHub**: Commit processed notes to your repository

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process using port 8788
lsof -ti:8788 | xargs kill -9

# Kill process using port 8080
lsof -ti:8080 | xargs kill -9
```

**API Key Issues**
- Verify your API keys are correctly set in `.env`
- Check that your GitHub token has `repo` permissions
- Ensure SiliconFlow API key is active

**Server Won't Start**
- Check Node.js version: `node --version` (should be 18+)
- Verify all dependencies are installed: `npm install`
- Check the console for error messages

## Next Steps

- Read the [User Guide](USER_GUIDE.md) for detailed usage instructions
- Check [API Usage](API_USAGE.md) for integration options
- Review [Configuration Guide](../CONFIGURATION_GUIDE.md) for advanced settings

## Need Help?

- Check the [documentation](./)
- Report issues on [GitHub Issues](https://github.com/yourusername/handwriting-ocr-archive/issues)
- Join discussions on [GitHub Discussions](https://github.com/yourusername/handwriting-ocr-archive/discussions)

## 5分钟快速上手

### 1. 基础HTML页面

创建一个简单的HTML文件，复制以下代码即可开始使用：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>手写OCR识别</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .upload-box { border: 2px dashed #007bff; border-radius: 8px; padding: 40px; text-align: center; cursor: pointer; margin: 20px 0; }
        .upload-box:hover { background-color: #f8f9fa; }
        .preview img { max-width: 100%; max-height: 300px; margin: 20px 0; }
        .result { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .loading { text-align: center; color: #007bff; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <h1>手写文字识别</h1>
    
    <div class="upload-box" onclick="document.getElementById('file').click()">
        点击选择图片或拖拽到此处
        <br><small>支持 JPG、PNG、GIF、WEBP 格式</small>
    </div>
    
    <input type="file" id="file" accept="image/*" style="display:none">
    
    <div id="preview" class="preview"></div>
    <div id="loading" class="loading" style="display:none">正在识别中...</div>
    <div id="result" class="result" style="display:none"></div>

    <script>
        // 文件选择处理
        document.getElementById('file').onchange = function(e) {
            handleFile(e.target.files[0]);
        };
        
        // 拖拽上传
        const uploadBox = document.querySelector('.upload-box');
        uploadBox.ondragover = e => { e.preventDefault(); uploadBox.style.backgroundColor = '#e3f2fd'; };
        uploadBox.ondragleave = e => { e.preventDefault(); uploadBox.style.backgroundColor = ''; };
        uploadBox.ondrop = e => {
            e.preventDefault();
            uploadBox.style.backgroundColor = '';
            handleFile(e.dataTransfer.files[0]);
        };
        
        // 处理文件
        async function handleFile(file) {
            if (!file || !file.type.startsWith('image/')) {
                alert('请选择图片文件！');
                return;
            }
            
            // 显示预览
            const reader = new FileReader();
            reader.onload = e => {
                document.getElementById('preview').innerHTML = `<img src="${e.target.result}" alt="预览">`;
            };
            reader.readAsDataURL(file);
            
            // 转换为Base64并识别
            const base64 = await fileToBase64(file);
            await recognizeText(base64);
        }
        
        // 文件转Base64
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        // OCR识别
        async function recognizeText(base64Image) {
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            
            loading.style.display = 'block';
            result.style.display = 'none';
            
            try {
                const response = await fetch('/api/ocr/handwritten', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: base64Image,
                        provider: 'baidu',
                        options: { language: 'zh-CN', enhance: true }
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    result.innerHTML = `
                        <h3>识别结果</h3>
                        <div style="background:white; padding:15px; border-radius:4px; margin:10px 0; white-space:pre-wrap;">${data.data.text || '未识别到文字'}</div>
                        <p><strong>置信度:</strong> ${(data.data.confidence * 100).toFixed(1)}% | <strong>用时:</strong> ${data.data.processTime}ms</p>
                        <button onclick="copyText('${data.data.text.replace(/'/g, "\\'")}')">复制文本</button>
                    `;
                    result.style.display = 'block';
                } else {
                    throw new Error(data.message || '识别失败');
                }
            } catch (error) {
                result.innerHTML = `<div style="color:red;">识别失败: ${error.message}</div>`;
                result.style.display = 'block';
            } finally {
                loading.style.display = 'none';
            }
        }
        
        // 复制文本
        async function copyText(text) {
            try {
                await navigator.clipboard.writeText(text);
                alert('文本已复制到剪贴板！');
            } catch (error) {
                console.error('复制失败:', error);
            }
        }
    </script>
</body>
</html>
```

### 2. 简单的JavaScript调用

如果你已经有现成的网页，只需要添加OCR功能，可以使用这个简化版本：

```javascript
/**
 * 手写OCR识别函数
 * @param {File} imageFile - 图片文件
 * @returns {Promise<string>} 识别出的文字
 */
async function recognizeHandwriting(imageFile) {
    // 转换为Base64
    const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(imageFile);
    });
    
    // 调用API
    const response = await fetch('/api/ocr/handwritten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: base64,
            provider: 'baidu', // 或 'tencent'
            options: {
                language: 'zh-CN',
                enhance: true
            }
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        return result.data.text;
    } else {
        throw new Error(result.message || '识别失败');
    }
}

// 使用示例
document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            const text = await recognizeHandwriting(file);
            console.log('识别结果:', text);
            document.getElementById('output').textContent = text;
        } catch (error) {
            console.error('识别失败:', error);
            alert('识别失败: ' + error.message);
        }
    }
});
```

### 3. 一行代码集成

最简单的使用方式，适合快速测试：

```html
<!-- 在HTML中添加 -->
<input type="file" id="ocrInput" accept="image/*">
<div id="ocrResult"></div>

<script>
document.getElementById('ocrInput').onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function() {
        try {
            const response = await fetch('/api/ocr/handwritten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: reader.result, provider: 'baidu' })
            });
            const data = await response.json();
            document.getElementById('ocrResult').textContent = data.success ? data.data.text : '识别失败';
        } catch (error) {
            document.getElementById('ocrResult').textContent = '错误: ' + error.message;
        }
    };
    reader.readAsDataURL(file);
};
</script>
```

## 移动端优化

在移动设备上使用时，添加以下CSS和JavaScript优化：

```css
/* 移动端优化样式 */
@media (max-width: 768px) {
    body { padding: 10px; }
    .upload-box { padding: 20px; font-size: 14px; }
    .preview img { max-height: 200px; }
    button { width: 100%; margin: 10px 0; }
}
```

```javascript
// 移动端相机调用
function openCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // 使用后置摄像头
    input.onchange = e => handleFile(e.target.files[0]);
    input.click();
}
```

## 常见问题

**Q: 识别准确率不高怎么办？**
A: 确保图片清晰、文字与背景对比度高，可以尝试不同的OCR服务商。

**Q: 支持哪些图片格式？**
A: 支持 JPG、PNG、GIF、WEBP 等常见格式。

**Q: 文件大小有限制吗？**
A: 建议不超过5MB，过大的文件会影响处理速度。

**Q: 可以识别英文吗？**
A: 可以，将 `language` 参数设置为 `en` 即可。

**Q: 如何提高识别速度？**
A: 可以在前端压缩图片，或者选择响应更快的OCR服务商。

## 下一步

- 查看完整文档: [HANDWRITING_OCR_GUIDE.md](./HANDWRITING_OCR_GUIDE.md)
- 了解API详情: [API_USAGE.md](./API_USAGE.md)
- 环境配置: [SETUP.md](./SETUP.md)

---

*现在你已经可以开始使用手写OCR功能了！*