/**
 * 双通道图片处理系统前端应用
 * 主要功能：文件上传、OCR处理、状态监控、结果展示
 */

class ImageProcessingApp {
    constructor() {
        this.apiBase = window.location.origin;
        this.uploadQueue = [];
        this.processingFiles = new Map();
        this.statusUpdateInterval = null;
        
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.bindEvents();
        this.initializeStatus();
        this.startStatusUpdates();
        this.loadHistory();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 文件上传相关
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // 状态刷新
        document.getElementById('refreshStatus').addEventListener('click', this.refreshStatus.bind(this));
        
        // 历史记录
        document.getElementById('loadMoreHistory').addEventListener('click', this.loadMoreHistory.bind(this));
        
        // 模态框
        document.getElementById('modalClose').addEventListener('click', this.closeModal.bind(this));
        document.getElementById('modalCancel').addEventListener('click', this.closeModal.bind(this));
        document.getElementById('modalConfirm').addEventListener('click', this.confirmSave.bind(this));
        
        // 点击模态框外部关闭
        document.getElementById('previewModal').addEventListener('click', (e) => {
            if (e.target.id === 'previewModal') {
                this.closeModal();
            }
        });
    }

    /**
     * 处理拖拽悬停
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    /**
     * 处理拖拽离开
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    /**
     * 处理文件拖拽放置
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadArea').classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    /**
     * 处理选中的文件
     */
    processFiles(files) {
        // 过滤图片文件
        const imageFiles = files.filter(file => {
            return file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024; // 10MB限制
        });
        
        if (imageFiles.length === 0) {
            this.showNotification('请选择有效的图片文件（JPG、PNG、WebP，最大10MB）', 'warning');
            return;
        }
        
        if (imageFiles.length !== files.length) {
            this.showNotification(`已过滤 ${files.length - imageFiles.length} 个无效文件`, 'warning');
        }
        
        this.uploadQueue = imageFiles;
        this.showProcessingSection();
        this.startProcessing();
    }

    /**
     * 显示处理进度区域
     */
    showProcessingSection() {
        const section = document.getElementById('processingSection');
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
        
        // 初始化文件列表
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        this.uploadQueue.forEach((file, index) => {
            const fileItem = this.createFileItem(file, index);
            fileList.appendChild(fileItem);
        });
    }

    /**
     * 创建文件项元素
     */
    createFileItem(file, index) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = `file-${index}`;
        
        item.innerHTML = `
            <div class="file-info">
                <span class="file-icon">📷</span>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-status processing">等待处理</div>
        `;
        
        return item;
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 开始处理文件
     */
    async startProcessing() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        let completed = 0;
        const total = this.uploadQueue.length;
        
        // 获取处理选项
        const options = {
            autoCommit: document.getElementById('autoCommit').checked,
            generateMarkdown: document.getElementById('generateMarkdown').checked,
            optimizeImage: document.getElementById('optimizeImage').checked,
            language: 'zh-cn'
        };
        
        progressText.textContent = `处理中... (0/${total})`;
        
        // 并发处理文件（最多3个同时处理）
        const concurrency = Math.min(3, total);
        const chunks = this.chunkArray(this.uploadQueue, concurrency);
        
        for (const chunk of chunks) {
            const promises = chunk.map((file, index) => 
                this.processFile(file, this.uploadQueue.indexOf(file), options)
            );
            
            await Promise.allSettled(promises);
            
            completed += chunk.length;
            const progress = (completed / total) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `处理中... (${completed}/${total})`;
        }
        
        progressText.textContent = `处理完成 (${completed}/${total})`;
        this.showNotification('所有文件处理完成！', 'success');
        
        // 刷新状态和历史
        setTimeout(() => {
            this.refreshStatus();
            this.loadHistory();
        }, 1000);
    }

    /**
     * 将数组分块
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * 处理单个文件
     */
    async processFile(file, index, options) {
        const fileItem = document.getElementById(`file-${index}`);
        const statusElement = fileItem.querySelector('.file-status');
        
        try {
            statusElement.textContent = '上传中...';
            statusElement.className = 'file-status processing';
            
            const formData = new FormData();
            formData.append('image', file);
            formData.append('options', JSON.stringify(options));
            
            const response = await fetch(`${this.apiBase}/api/handwritten/process`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            statusElement.textContent = '处理完成';
            statusElement.className = 'file-status completed';
            
            // 存储结果用于后续展示
            this.processingFiles.set(index, {
                file,
                result,
                success: true
            });
            
            // 如果是最后一个文件，显示结果
            if (this.processingFiles.size === this.uploadQueue.length) {
                this.showResults();
            }
            
        } catch (error) {
            console.error('文件处理失败:', error);
            
            statusElement.textContent = '处理失败';
            statusElement.className = 'file-status error';
            
            this.processingFiles.set(index, {
                file,
                error: error.message,
                success: false
            });
            
            this.showNotification(`文件 ${file.name} 处理失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示处理结果
     */
    showResults() {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContainer = document.getElementById('resultsContainer');
        
        resultsContainer.innerHTML = '';
        
        this.processingFiles.forEach((data, index) => {
            if (data.success) {
                const resultItem = this.createResultItem(data.file, data.result);
                resultsContainer.appendChild(resultItem);
            }
        });
        
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 创建结果项元素
     */
    createResultItem(file, result) {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        const ocrText = result.ocrText || '未识别到文本';
        const markdownContent = result.markdownContent || '';
        const githubUrl = result.githubUrl || '';
        
        item.innerHTML = `
            <div class="result-header">
                <div class="result-title">📷 ${file.name}</div>
                <div class="result-actions">
                    ${githubUrl ? `<a href="${githubUrl}" target="_blank" class="btn btn-secondary">📂 查看GitHub</a>` : ''}
                    <button class="btn btn-primary" onclick="app.previewResult('${file.name}', \`${markdownContent.replace(/`/g, '\\`')}\`)">
                        👁️ 预览
                    </button>
                </div>
            </div>
            <div class="result-content">${this.escapeHtml(ocrText)}</div>
        `;
        
        return item;
    }

    /**
     * 转义HTML字符
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 预览结果
     */
    previewResult(fileName, markdownContent) {
        const modal = document.getElementById('previewModal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h4>📄 ${fileName} - Markdown内容</h4>
            <div class="result-content" style="max-height: 400px;">${this.escapeHtml(markdownContent)}</div>
        `;
        
        modal.style.display = 'flex';
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        document.getElementById('previewModal').style.display = 'none';
    }

    /**
     * 确认保存
     */
    confirmSave() {
        this.showNotification('内容已保存到GitHub仓库', 'success');
        this.closeModal();
    }

    /**
     * 初始化状态
     */
    async initializeStatus() {
        await this.refreshStatus();
    }

    /**
     * 刷新状态
     */
    async refreshStatus() {
        try {
            // 获取系统统计信息
            const statsResponse = await fetch(`${this.apiBase}/api/handwritten/stats`);
            const stats = await statsResponse.json();
            
            // 获取同步状态
            const syncResponse = await fetch(`${this.apiBase}/api/sync/enhanced/status`);
            const syncStatus = await syncResponse.json();
            
            // 更新UI
            this.updateStatusDisplay(stats, syncStatus);
            this.updateRepoStatus(true);
            
        } catch (error) {
            console.error('状态刷新失败:', error);
            this.updateRepoStatus(false);
        }
    }

    /**
     * 更新状态显示
     */
    updateStatusDisplay(stats, syncStatus) {
        document.getElementById('lastSync').textContent = 
            syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : '从未同步';
        
        document.getElementById('processedFiles').textContent = 
            stats.totalProcessed || '0';
        
        document.getElementById('pendingQueue').textContent = 
            syncStatus.pendingFiles || '0';
        
        document.getElementById('storageUsed').textContent = 
            this.formatFileSize(stats.totalSize || 0);
    }

    /**
     * 更新仓库状态
     */
    updateRepoStatus(connected) {
        const statusIndicator = document.getElementById('repoStatus');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('.status-text');
        const systemStatus = document.getElementById('systemStatus');
        
        if (connected) {
            statusDot.style.background = '#48bb78';
            statusText.textContent = '已连接';
            statusIndicator.style.background = '#f0fff4';
            statusIndicator.style.borderColor = '#9ae6b4';
            systemStatus.textContent = '系统正常';
        } else {
            statusDot.style.background = '#f56565';
            statusText.textContent = '连接失败';
            statusIndicator.style.background = '#fed7d7';
            statusIndicator.style.borderColor = '#feb2b2';
            systemStatus.textContent = '系统异常';
        }
    }

    /**
     * 开始状态更新
     */
    startStatusUpdates() {
        // 每30秒更新一次状态
        this.statusUpdateInterval = setInterval(() => {
            this.refreshStatus();
        }, 30000);
    }

    /**
     * 加载历史记录
     */
    async loadHistory() {
        try {
            const response = await fetch(`${this.apiBase}/api/handwritten/stats`);
            const data = await response.json();
            
            this.updateHistoryDisplay(data.recentFiles || []);
            
        } catch (error) {
            console.error('历史记录加载失败:', error);
        }
    }

    /**
     * 加载更多历史记录
     */
    async loadMoreHistory() {
        // 这里可以实现分页加载
        this.showNotification('暂无更多历史记录', 'info');
    }

    /**
     * 更新历史记录显示
     */
    updateHistoryDisplay(files) {
        const historyContainer = document.getElementById('historyContainer');
        
        if (files.length === 0) {
            historyContainer.innerHTML = `
                <div class="history-placeholder">
                    <p>暂无操作记录</p>
                    <small>上传文件后将显示处理历史</small>
                </div>
            `;
            return;
        }
        
        historyContainer.innerHTML = '';
        
        files.forEach(file => {
            const historyItem = this.createHistoryItem(file);
            historyContainer.appendChild(historyItem);
        });
    }

    /**
     * 创建历史记录项
     */
    createHistoryItem(file) {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const time = new Date(file.timestamp).toLocaleString();
        const action = file.action || 'OCR处理';
        const details = file.fileName || '未知文件';
        
        item.innerHTML = `
            <div class="history-info">
                <div class="history-time">${time}</div>
                <div class="history-action">${action}</div>
                <div class="history-details">${details}</div>
            </div>
            <div class="history-status">
                ${file.success ? '✅' : '❌'}
            </div>
        `;
        
        return item;
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>${message}</div>
        `;
        
        container.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * 清理资源
     */
    destroy() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
    }
}

// 全局应用实例
let app;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app = new ImageProcessingApp();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});