/**
 * 一键式自动化流程 API
 * 整合批量OCR、CDN替换和GitHub同步功能
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// 创建自动化应用实例
const automationApp = new Hono();

// 启用CORS
automationApp.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * 一键式自动化处理接口
 * 执行完整的图片处理、CDN替换和GitHub同步流程
 */
automationApp.post('/process', async (c) => {
  try {
    const formData = await c.req.formData();
    const images = formData.getAll('images') as File[];
    const optionsStr = formData.get('options') as string;
    const repoInfoStr = formData.get('repoInfo') as string;
    const cdnConfigStr = formData.get('cdnConfig') as string;
    
    if (!images || images.length === 0) {
      return c.json({
        success: false,
        error: '请提供至少一张图片'
      }, 400);
    }

    const options = optionsStr ? JSON.parse(optionsStr) : {};
    const repoInfo = repoInfoStr ? JSON.parse(repoInfoStr) : null;
    const cdnConfig = cdnConfigStr ? JSON.parse(cdnConfigStr) : null;

    const results = {
      ocrResults: [] as any[],
      cdnReplacements: [] as any[],
      githubSync: null as any,
      summary: {
        totalImages: images.length,
        processedImages: 0,
        replacedUrls: 0,
        syncedFiles: 0,
        errors: [] as string[]
      }
    };

    // 步骤1: 批量OCR处理
    console.log('开始批量OCR处理...');
    try {
      const ocrFormData = new FormData();
      images.forEach(image => ocrFormData.append('images', image));
      ocrFormData.append('options', JSON.stringify({
        language: options.language || 'zh-cn',
        enhance: options.enhance !== false,
        generateMarkdown: true
      }));

      const ocrResponse = await fetch(`${(c.env as any)?.API_BASE_URL || ''}/api/batch-ocr/process`, {
        method: 'POST',
        body: ocrFormData
      });

      if (ocrResponse.ok) {
        const ocrResult = await ocrResponse.json() as any;
        if (ocrResult.success) {
          results.ocrResults = ocrResult.data.results;
          results.summary.processedImages = ocrResult.data.results.length;
          console.log(`OCR处理完成: ${results.summary.processedImages} 张图片`);
        } else {
          throw new Error(ocrResult.error || 'OCR处理失败');
        }
      } else {
        throw new Error(`OCR API请求失败: ${ocrResponse.status}`);
      }
    } catch (error) {
      const errorMsg = `OCR处理失败: ${error instanceof Error ? error.message : String(error)}`;
      results.summary.errors.push(errorMsg);
      console.error(errorMsg);
    }

    // 步骤2: CDN URL替换（如果有OCR结果且提供了CDN配置）
    if (results.ocrResults.length > 0 && cdnConfig) {
      console.log('开始CDN URL替换...');
      try {
        const documents = results.ocrResults.map((result: any) => ({
          content: result.markdownContent,
          filename: result.filename || `handwritten_${Date.now()}.md`
        }));

        const cdnResponse = await fetch(`${(c.env as any)?.API_BASE_URL || ''}/api/cdn-replacement/batch-replace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documents,
            baseUrl: cdnConfig.baseUrl || 'https://imagedelivery.net/your-account-id'
          })
        });

        if (cdnResponse.ok) {
          const cdnResult = await cdnResponse.json() as any;
          if (cdnResult.success) {
            results.cdnReplacements = cdnResult.data.documents;
            results.summary.replacedUrls = cdnResult.data.summary.totalReplacements;
            
            // 更新OCR结果中的Markdown内容
            cdnResult.data.documents.forEach((doc: any, index: number) => {
              if (results.ocrResults[index]) {
                (results.ocrResults[index] as any).markdownContent = doc.content;
              }
            });
            
            console.log(`CDN URL替换完成: ${results.summary.replacedUrls} 个URL`);
          } else {
            throw new Error(cdnResult.error || 'CDN URL替换失败');
          }
        } else {
          throw new Error(`CDN API请求失败: ${cdnResponse.status}`);
        }
      } catch (error) {
        const errorMsg = `CDN URL替换失败: ${error instanceof Error ? error.message : String(error)}`;
        results.summary.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // 步骤3: GitHub同步（如果有处理结果且提供了仓库信息）
    if (results.ocrResults.length > 0 && repoInfo) {
      console.log('开始GitHub同步...');
      try {
        const documents = results.ocrResults.map((result: any, index: number) => ({
          filename: `handwritten_${Date.now()}_${index + 1}.md`,
          content: result.markdownContent,
          metadata: {
            originalImage: result.imageUrl,
            confidence: result.confidence,
            processedAt: new Date().toISOString(),
            automationId: `auto_${Date.now()}`
          }
        }));

        const githubResponse = await fetch(`${(c.env as any)?.API_BASE_URL || ''}/api/github-sync/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documents,
            repoInfo: {
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              branch: repoInfo.branch || 'main'
            }
          })
        });

        if (githubResponse.ok) {
          const githubResult = await githubResponse.json() as any;
          if (githubResult.success) {
            results.githubSync = githubResult.data;
            results.summary.syncedFiles = githubResult.data.summary.syncedCount;
            console.log(`GitHub同步完成: ${results.summary.syncedFiles} 个文件`);
          } else {
            throw new Error(githubResult.error || 'GitHub同步失败');
          }
        } else {
          throw new Error(`GitHub API请求失败: ${githubResponse.status}`);
        }
      } catch (error) {
        const errorMsg = `GitHub同步失败: ${error instanceof Error ? error.message : String(error)}`;
        results.summary.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // 返回完整结果
    const hasErrors = results.summary.errors.length > 0;
    const isPartialSuccess = results.summary.processedImages > 0;
    
    return c.json({
      success: !hasErrors || isPartialSuccess,
      data: results,
      message: hasErrors 
        ? `自动化流程部分完成，存在 ${results.summary.errors.length} 个错误`
        : '自动化流程全部完成'
    }, hasErrors && !isPartialSuccess ? 500 : 200);

  } catch (error) {
    console.error('自动化流程错误:', error);
    return c.json({
      success: false,
      error: `自动化流程失败: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

/**
 * 获取自动化流程状态
 */
automationApp.get('/status', async (c) => {
  try {
    // 检查各个服务的状态
    const services = {
      ocr: { status: 'unknown', message: '' },
      cdn: { status: 'unknown', message: '' },
      github: { status: 'unknown', message: '' }
    };

    // 检查OCR服务
    try {
      const ocrResponse = await fetch(`${(c.env as any)?.API_BASE_URL || ''}/api/batch-ocr/health`);
      services.ocr.status = ocrResponse.ok ? 'healthy' : 'error';
      services.ocr.message = ocrResponse.ok ? '服务正常' : `HTTP ${ocrResponse.status}`;
    } catch (error) {
      services.ocr.status = 'error';
      services.ocr.message = '服务不可用';
    }

    // 检查CDN服务
    try {
      const cdnResponse = await fetch(`${(c.env as any)?.API_BASE_URL || ''}/api/cdn-replacement/health`);
      services.cdn.status = cdnResponse.ok ? 'healthy' : 'error';
      services.cdn.message = cdnResponse.ok ? '服务正常' : `HTTP ${cdnResponse.status}`;
    } catch (error) {
      services.cdn.status = 'error';
      services.cdn.message = '服务不可用';
    }

    // 检查GitHub服务
    try {
      const githubResponse = await fetch(`${(c.env as any)?.API_BASE_URL || ''}/api/github-sync/health`);
      services.github.status = githubResponse.ok ? 'healthy' : 'error';
      services.github.message = githubResponse.ok ? '服务正常' : `HTTP ${githubResponse.status}`;
    } catch (error) {
      services.github.status = 'error';
      services.github.message = '服务不可用';
    }

    const allHealthy = Object.values(services).every(service => service.status === 'healthy');
    
    return c.json({
      success: true,
      data: {
        overall: allHealthy ? 'healthy' : 'degraded',
        services,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('状态检查错误:', error);
    return c.json({
      success: false,
      error: `状态检查失败: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

/**
 * 获取自动化流程配置模板
 */
automationApp.get('/config-template', async (c) => {
  return c.json({
    success: true,
    data: {
      options: {
        language: 'zh-cn',
        enhance: true,
        generateMarkdown: true
      },
      repoInfo: {
        owner: 'your-username',
        repo: 'your-repo',
        branch: 'main'
      },
      cdnConfig: {
        baseUrl: 'https://imagedelivery.net/your-account-id'
      }
    }
  });
});

export { automationApp };