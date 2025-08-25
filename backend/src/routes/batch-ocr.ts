/**
 * 批量OCR处理API路由
 * 支持多张手写图片的批量处理和Markdown文档生成
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// 启用CORS
app.use('*', cors());

// 批量OCR处理接口
app.post('/batch-process', async (c) => {
  try {
    const body = await c.req.json();
    console.log('[Batch OCR] Processing request with', body.images?.length || 0, 'images');
    
    const { images, options = {} } = body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return c.json({
        success: false,
        error: 'No images provided for processing'
      }, 400);
    }
    
    const results = [];
    const errors = [];
    
    // 处理每张图片
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      console.log(`[Batch OCR] Processing image ${i + 1}/${images.length}`);
      
      try {
        // 调用现有的OCR识别功能
        const ocrResult = await processImageOCR(imageData, options);
        
        if (ocrResult.success && ocrResult.data) {
          results.push({
            index: i,
            filename: imageData.filename || `image_${i + 1}`,
            text: ocrResult.data.text,
            confidence: ocrResult.data.confidence || 0,
            imageUrl: ocrResult.data.imageUrl
          });
          console.log(`[Batch OCR] Image ${i + 1} processed successfully`);
        } else {
          errors.push({
            index: i,
            filename: imageData.filename || `image_${i + 1}`,
            error: ocrResult.error
          });
          console.log(`[Batch OCR] Image ${i + 1} failed:`, ocrResult.error);
        }
      } catch (error) {
        console.error(`[Batch OCR] Error processing image ${i + 1}:`, error);
        errors.push({
          index: i,
          filename: imageData.filename || `image_${i + 1}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // 生成合并的Markdown文档
    const markdownContent = generateMarkdownDocument(results, options);
    
    return c.json({
      success: true,
      data: {
        processedCount: results.length,
        errorCount: errors.length,
        results,
        errors,
        markdownContent,
        summary: {
          totalImages: images.length,
          successfulOCR: results.length,
          failedOCR: errors.length,
          averageConfidence: results.length > 0 
            ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
            : 0
        }
      }
    });
    
  } catch (error) {
    console.error('[Batch OCR] Processing error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during batch processing'
    }, 500);
  }
});

/**
 * 处理单张图片的OCR识别
 * @param imageData 图片数据对象
 * @param options OCR选项
 * @returns OCR处理结果
 */
async function processImageOCR(imageData: any, options: any) {
  try {
    const { base64Image, filename } = imageData;
    
    if (!base64Image) {
      throw new Error('No base64 image data provided');
    }
    
    // 上传图片到Cloudflare Images
    let imageUrl: string | null = null;
    try {
      const uploadResult = await uploadToCloudflareImages(base64Image, filename) as any;
      if (uploadResult.success && uploadResult.result?.variants?.[0]) {
        imageUrl = uploadResult.result.variants[0];
        console.log('[OCR] Image uploaded to Cloudflare:', imageUrl);
      }
    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
      console.warn('[OCR] Cloudflare upload failed, using base64 fallback:', errorMessage);
    }
    
    // 使用图片URL或base64进行OCR识别
    const ocrImageSource = imageUrl || `data:image/jpeg;base64,${base64Image}`;
    
    // 调用OpenAI Vision API进行OCR识别
    const ocrResult = await performOCRRecognition(ocrImageSource, options);
    
    return {
      success: true,
      data: {
        text: ocrResult.text,
        confidence: ocrResult.confidence || 0.9,
        imageUrl: imageUrl
      }
    };
    
  } catch (error) {
    console.error('[OCR] Processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error'
    };
  }
}

/**
 * 上传图片到Cloudflare Images
 * @param base64Image base64编码的图片
 * @param filename 文件名
 * @returns 上传结果
 */
async function uploadToCloudflareImages(base64Image: string, filename: string) {
  const accountId = (globalThis as any).process?.env?.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = (globalThis as any).process?.env?.CLOUDFLARE_API_TOKEN;
  
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured');
  }
  
  // 将base64转换为Uint8Array
  const binaryString = atob(base64Image);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const formData = new FormData();
  formData.append('file', new Blob([bytes]), filename || 'handwriting.jpg');
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      body: formData,
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare upload failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/**
 * 执行OCR识别
 * @param imageSource 图片源（URL或base64 data URL）
 * @param options OCR选项
 * @returns OCR识别结果
 */
async function performOCRRecognition(imageSource: string, options: any) {
  const openaiApiKey = (globalThis as any).process?.env?.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const { language = 'zh-CN', enhance = true } = options;
  
  const prompt = `请准确识别以下手写内容并严格遵循以下要求：
1. 仅输出识别出的文字内容
2. 使用Markdown格式规范排版：
   - 标题使用#符号
   - 段落间空一行
   - 列表项使用*或-符号
   - 注意数学公式用$...$或$$...$$格式
3. 不添加任何解释性文字或额外信息，仅作语法、拼写修正，排版优化`;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageSource,
                detail: enhance ? 'high' : 'low'
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json() as any;
    throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
  }
  
  const result = await response.json() as any;
  const recognizedText = result.choices[0]?.message?.content || '';
  
  return {
    text: recognizedText.trim(),
    confidence: 0.9 // OpenAI不提供置信度，使用默认值
  };
}

/**
 * 生成合并的Markdown文档
 * @param results OCR识别结果数组
 * @param options 生成选项
 * @returns Markdown文档内容
 */
function generateMarkdownDocument(results: any[], options: any = {}) {
  const { title = '手写文档识别结果', includeImages = true, includeMetadata = true } = options;
  
  let markdown = `# ${title}\n\n`;
  
  if (includeMetadata) {
    const now = new Date();
    markdown += `> **生成时间**: ${now.toLocaleString('zh-CN')}\n`;
    markdown += `> **处理图片数量**: ${results.length}\n`;
    markdown += `> **平均识别置信度**: ${(results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1)}%\n\n`;
    markdown += '---\n\n';
  }
  
  results.forEach((result, index) => {
    markdown += `## 第 ${index + 1} 页 - ${result.filename}\n\n`;
    
    if (includeImages && result.imageUrl) {
      markdown += `![${result.filename}](${result.imageUrl})\n\n`;
    }
    
    if (result.text) {
      markdown += `${result.text}\n\n`;
    } else {
      markdown += '*此页面未识别到文字内容*\n\n';
    }
    
    if (includeMetadata) {
      markdown += `<details>\n<summary>识别信息</summary>\n\n`;
      markdown += `- **文件名**: ${result.filename}\n`;
      markdown += `- **识别置信度**: ${(result.confidence * 100).toFixed(1)}%\n`;
      if (result.imageUrl) {
        markdown += `- **图片链接**: ${result.imageUrl}\n`;
      }
      markdown += `\n</details>\n\n`;
    }
    
    markdown += '---\n\n';
  });
  
  // 添加页脚
  markdown += `\n\n*本文档由智能上传中心自动生成*`;
  
  return markdown;
}

// 导出路由
export default app;