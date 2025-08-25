const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * 简单的HTTP服务器，提供基本的API端点
 * 用于替代Cloudflare Workers进行本地开发
 */
class SimpleAPIServer {
    constructor(port = 8787) {
        this.port = port;
        this.server = null;
    }

    /**
     * 处理CORS预检请求
     */
    handleCORS(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
    }

    /**
     * 处理API请求
     */
    handleRequest(req, res) {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const pathname = parsedUrl.pathname;
        const method = req.method;

        // 设置CORS头
        this.handleCORS(res);

        // 处理OPTIONS预检请求
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        console.log(`${method} ${pathname}`);

        // 路由处理
        if (pathname === '/api/stats') {
            this.handleStats(req, res);
        } else if (pathname === '/api/sync/status') {
            this.handleSyncStatus(req, res);
        } else if (pathname === '/api/replacement-history') {
            this.handleReplacementHistory(req, res);
        } else if (pathname === '/api/gallery/images') {
            this.handleGalleryImages(req, res);
        } else if (pathname.startsWith('/api/upload')) {
            this.handleUpload(req, res);
        } else if (pathname === '/api/github/repo-info') {
            this.handleGitHubRepoInfo(req, res);
        } else if (pathname === '/api/notes/updates') {
            this.handleNotesUpdates(req, res);
        } else if (pathname.startsWith('/api/github')) {
            this.handleGitHub(req, res);
        } else if (pathname.startsWith('/api/cdn')) {
            this.handleCDN(req, res);
        } else if (pathname === '/api/batch-replace') {
            this.handleBatchReplace(req, res);
        } else if (pathname === '/api/gallery/clean') {
            this.handleGalleryClean(req, res);
        } else if (pathname === '/api/gallery/export') {
            this.handleGalleryExport(req, res);
        } else if (pathname.startsWith('/api/batch')) {
            this.handleBatch(req, res);
        } else {
            // 404处理
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API endpoint not found' }));
        }
    }

    /**
     * 处理系统状态请求
     */
    handleStats(req, res) {
        const stats = {
            status: 'running',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString(),
            services: {
                api: 'healthy',
                upload: 'healthy',
                github: 'healthy',
                cdn: 'healthy'
            }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
    }

    /**
     * 处理同步状态请求
     */
    handleSyncStatus(req, res) {
        const syncStatus = {
            lastSync: new Date(Date.now() - 300000).toISOString(), // 5分钟前
            status: 'idle',
            filesProcessed: 42,
            errors: 0
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(syncStatus));
    }

    /**
     * 处理替换历史请求
     */
    handleReplacementHistory(req, res) {
        const mockHistory = [
            {
                id: 1,
                originalUrl: 'https://example.com/image1.jpg',
                newUrl: 'https://cdn.example.com/optimized/image1.webp',
                fileName: 'image1.jpg',
                fileSize: '2.3 MB',
                timestamp: new Date(Date.now() - 86400000).toISOString(), // 1天前
                status: 'success'
            },
            {
                id: 2,
                originalUrl: 'https://another.com/photo.png',
                newUrl: 'https://cdn.example.com/optimized/photo.webp',
                fileName: 'photo.png',
                fileSize: '1.8 MB',
                timestamp: new Date(Date.now() - 172800000).toISOString(), // 2天前
                status: 'success'
            },
            {
                id: 3,
                originalUrl: 'https://test.com/banner.gif',
                newUrl: 'https://cdn.example.com/optimized/banner.webp',
                fileName: 'banner.gif',
                fileSize: '4.1 MB',
                timestamp: new Date(Date.now() - 259200000).toISOString(), // 3天前
                status: 'success'
            }
        ];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockHistory));
    }

    /**
     * 处理图片库请求
     */
    handleGalleryImages(req, res) {
        console.log('🖼️ 处理Gallery Images请求');
        const mockImages = {
            images: [
                {
                    id: 1,
                    filename: 'sample-image.jpg',
                    url: '/attachments/sample-image.jpg',
                    size: 2457600, // 2.4MB
                    uploadDate: new Date(Date.now() - 86400000).toISOString(),
                    type: 'image/jpeg',
                    dimensions: { width: 1920, height: 1080 }
                },
                {
                    id: 2,
                    filename: 'another-image.png',
                    url: '/attachments/another-image.png',
                    size: 1843200, // 1.8MB
                    uploadDate: new Date(Date.now() - 172800000).toISOString(),
                    type: 'image/png',
                    dimensions: { width: 1600, height: 900 }
                },
                {
                    id: 3,
                    filename: 'test-image.png',
                    url: '/attachments/test-image.png',
                    size: 3145728, // 3MB
                    uploadDate: new Date(Date.now() - 259200000).toISOString(),
                    type: 'image/png',
                    dimensions: { width: 2560, height: 1440 }
                }
            ],
            total: 3,
            totalSize: 7446528 // 总大小
        };

        console.log('📤 发送Gallery数据:', JSON.stringify(mockImages, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockImages));
        console.log('✅ Gallery响应已发送');
    }

    /**
     * 处理上传请求
     */
    handleUpload(req, res) {
        if (req.method === 'POST') {
            // 模拟上传处理
            setTimeout(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: '文件上传成功',
                    fileId: 'mock_' + Date.now()
                }));
            }, 1000);
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }

    /**
     * 处理GitHub仓库信息请求
     */
    handleGitHubRepoInfo(req, res) {
        const mockRepoInfo = {
            name: 'my-notes-repo',
            owner: 'username',
            branch: 'main',
            lastCommit: {
                sha: 'abc123def456',
                message: '更新笔记内容',
                author: 'username',
                date: new Date(Date.now() - 3600000).toISOString() // 1小时前
            },
            status: 'up-to-date',
            url: 'https://github.com/username/my-notes-repo'
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockRepoInfo));
    }

    /**
     * 处理笔记更新情况请求
     */
    handleNotesUpdates(req, res) {
        const mockNotesInfo = {
            totalNotes: 156,
            recentUpdates: 8,
            lastUpdate: new Date(Date.now() - 1800000).toISOString(), // 30分钟前
            pendingSync: 3,
            conflicts: 0
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockNotesInfo));
    }

    /**
     * 处理GitHub相关请求
     */
    handleGitHub(req, res) {
        const mockResponse = {
            success: true,
            message: 'GitHub操作模拟成功',
            data: { commits: 5, files: 12 }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
    }

    /**
     * 处理CDN相关请求
     */
    handleCDN(req, res) {
        const mockResponse = {
            success: true,
            message: 'CDN操作模拟成功',
            replacements: 8
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
    }

    /**
     * 处理批量替换请求
     */
    handleBatchReplace(req, res) {
        if (req.method === 'POST') {
            // 模拟批量替换处理
            setTimeout(() => {
                const mockResponse = {
                    success: true,
                    message: '批量替换完成',
                    processed: 12,
                    replaced: 45,
                    errors: 0,
                    files: [
                        { name: 'note1.md', replaced: 8 },
                        { name: 'note2.md', replaced: 15 },
                        { name: 'note3.md', replaced: 22 }
                    ]
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(mockResponse));
            }, 2000);
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }

    /**
     * 处理图片库清理请求
     */
    handleGalleryClean(req, res) {
        if (req.method === 'POST') {
            setTimeout(() => {
                const mockResponse = {
                    success: true,
                    message: '清理完成',
                    cleaned: 3,
                    freedSpace: 5242880 // 5MB
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(mockResponse));
            }, 1500);
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }

    /**
     * 处理图片库导出请求
     */
    handleGalleryExport(req, res) {
        // 模拟CSV文件内容
        const csvContent = `文件名,大小,上传时间,类型\n` +
            `sample-image.jpg,2457600,${new Date(Date.now() - 86400000).toISOString()},image/jpeg\n` +
            `another-image.png,1843200,${new Date(Date.now() - 172800000).toISOString()},image/png\n` +
            `test-image.png,3145728,${new Date(Date.now() - 259200000).toISOString()},image/png`;

        res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="gallery-export.csv"'
        });
        res.end(csvContent);
    }

    /**
     * 处理批量操作请求
     */
    handleBatch(req, res) {
        const mockResponse = {
            success: true,
            message: '批量操作模拟成功',
            processed: 15,
            errors: 0
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
    }

    /**
     * 启动服务器
     */
    start() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
            console.log(`\n🚀 简单API服务器已启动`);
            console.log(`📡 监听端口: ${this.port}`);
            console.log(`🌐 API地址: http://localhost:${this.port}`);
            console.log(`📊 状态检查: http://localhost:${this.port}/api/stats`);
            console.log(`\n按 Ctrl+C 停止服务器\n`);
        });

        // 优雅关闭
        process.on('SIGINT', () => {
            console.log('\n正在关闭服务器...');
            this.server.close(() => {
                console.log('服务器已关闭');
                process.exit(0);
            });
        });
    }
}

// 启动服务器
const server = new SimpleAPIServer(8787);
server.start();