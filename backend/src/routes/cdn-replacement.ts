import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// 启用CORS
app.use('*', cors());

/**
 * CDN URL替换接口
 * 将文档中的本地资源路径替换为Cloudflare CDN URL
 */
app.post('/replace', async (c) => {
  try {
    const { content, baseUrl } = await c.req.json();
    
    if (!content) {
      return c.json({
        success: false,
        error: 'Content is required'
      }, 400);
    }

    // 默认Cloudflare CDN基础URL
    const cdnBaseUrl = baseUrl || 'https://imagedelivery.net/your-account-id';
    
    // 替换本地图片路径的正则表达式
    const localImageRegex = /!\[([^\]]*)\]\((?:\.\/)?(images?\/[^\)]+)\)/g;
    const localFileRegex = /\[([^\]]*)\]\((?:\.\/)?(files?\/[^\)]+)\)/g;
    
    let replacedContent = content;
    const replacements: Array<{original: string, replaced: string}> = [];
    
    // 替换本地图片路径
    replacedContent = replacedContent.replace(localImageRegex, (match: string, alt: string, path: string) => {
      const cdnUrl = `${cdnBaseUrl}/${path}`;
      const newMarkdown = `![${alt}](${cdnUrl})`;
      replacements.push({
        original: match,
        replaced: newMarkdown
      });
      return newMarkdown;
    });
    
    // 替换本地文件路径
    replacedContent = replacedContent.replace(localFileRegex, (match: string, text: string, path: string) => {
      const cdnUrl = `${cdnBaseUrl}/${path}`;
      const newMarkdown = `[${text}](${cdnUrl})`;
      replacements.push({
        original: match,
        replaced: newMarkdown
      });
      return newMarkdown;
    });
    
    return c.json({
      success: true,
      data: {
        originalContent: content,
        replacedContent,
        replacements,
        summary: {
          totalReplacements: replacements.length,
          cdnBaseUrl
        }
      }
    });
    
  } catch (error) {
    console.error('CDN replacement error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

/**
 * 批量CDN URL替换接口
 * 处理多个文档的CDN URL替换
 */
app.post('/batch-replace', async (c) => {
  try {
    const { documents, baseUrl } = await c.req.json();
    
    if (!documents || !Array.isArray(documents)) {
      return c.json({
        success: false,
        error: 'Documents array is required'
      }, 400);
    }

    const cdnBaseUrl = baseUrl || 'https://imagedelivery.net/your-account-id';
    const processedDocuments = [];
    let totalReplacements = 0;
    
    for (const doc of documents) {
      if (!doc.content) {
        processedDocuments.push({
          ...doc,
          error: 'Content is required'
        });
        continue;
      }
      
      // 使用单个替换逻辑
      const localImageRegex = /!\[([^\]]*)\]\((?:\.\/)?(images?\/[^\)]+)\)/g;
      const localFileRegex = /\[([^\]]*)\]\((?:\.\/)?(files?\/[^\)]+)\)/g;
      
      let replacedContent = doc.content;
      const replacements: Array<{original: string, replaced: string}> = [];
      
      // 替换本地图片路径
      replacedContent = replacedContent.replace(localImageRegex, (match: string, alt: string, path: string) => {
        const cdnUrl = `${cdnBaseUrl}/${path}`;
        const newMarkdown = `![${alt}](${cdnUrl})`;
        replacements.push({
          original: match,
          replaced: newMarkdown
        });
        return newMarkdown;
      });
      
      // 替换本地文件路径
      replacedContent = replacedContent.replace(localFileRegex, (match: string, text: string, path: string) => {
        const cdnUrl = `${cdnBaseUrl}/${path}`;
        const newMarkdown = `[${text}](${cdnUrl})`;
        replacements.push({
          original: match,
          replaced: newMarkdown
        });
        return newMarkdown;
      });
      
      totalReplacements += replacements.length;
      
      processedDocuments.push({
        ...doc,
        originalContent: doc.content,
        content: replacedContent,
        replacements,
        replacementCount: replacements.length
      });
    }
    
    return c.json({
      success: true,
      data: {
        documents: processedDocuments,
        summary: {
          totalDocuments: documents.length,
          totalReplacements,
          cdnBaseUrl
        }
      }
    });
    
  } catch (error) {
    console.error('Batch CDN replacement error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

/**
 * 验证CDN URL可访问性
 * 检查替换后的CDN URL是否可以正常访问
 */
app.post('/validate-urls', async (c) => {
  try {
    const { urls } = await c.req.json();
    
    if (!urls || !Array.isArray(urls)) {
      return c.json({
        success: false,
        error: 'URLs array is required'
      }, 400);
    }

    const validationResults = [];
    
    for (const url of urls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        validationResults.push({
          url,
          accessible: response.ok,
          status: response.status,
          statusText: response.statusText
        });
      } catch (error) {
        validationResults.push({
          url,
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const accessibleCount = validationResults.filter(r => r.accessible).length;
    
    return c.json({
      success: true,
      data: {
        results: validationResults,
        summary: {
          totalUrls: urls.length,
          accessibleUrls: accessibleCount,
          inaccessibleUrls: urls.length - accessibleCount,
          successRate: `${((accessibleCount / urls.length) * 100).toFixed(1)}%`
        }
      }
    });
    
  } catch (error) {
    console.error('URL validation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

export default app;