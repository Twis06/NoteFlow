/**
 * 测试Obsidian内容处理API
 * 支持直接上传Markdown内容和Base64编码的图片数据
 */

const fs = require('fs');
const path = require('path');

// 测试用的Markdown内容，包含图片引用
const testMarkdownContent = `# 测试笔记

这是一个测试笔记，包含以下图片：

![测试图片1](./attachments/test1.jpg)

![[test2.png]]

<img src="./attachments/test3.gif" alt="测试图片3">

## 内容

这里是一些文本内容。
`;

// 模拟Base64编码的图片数据（这里使用占位符）
const testImages = {
  'test1.jpg': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...', // 实际应用中这里是完整的base64数据
  'test2.png': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'test3.gif': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
};

// API调用函数
async function testObsidianContentAPI() {
  const apiUrl = 'http://localhost:8787/api/process/obsidian-content';
  
  const requestBody = {
    files: [
      {
        path: 'test-note.md',
        content: testMarkdownContent
      }
    ],
    images: [
      {
        path: './attachments/test1.jpg',
        data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
        filename: 'test1.jpg'
      },
      {
        path: 'test2.png',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        filename: 'test2.png'
      },
      {
        path: './attachments/test3.gif',
        data: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        filename: 'test3.gif'
      }
    ],
    options: {
      enableSmartCompression: true,
      imageQuality: 0.8
    }
  };
  
  try {
    console.log('🚀 测试Obsidian内容处理API...');
    console.log('📝 文件数量:', requestBody.files.length);
    console.log('🖼️  图片数量:', requestBody.images.length);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    console.log('\n📊 API响应:');
    console.log('状态码:', response.status);
    console.log('响应内容:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 处理成功!');
      console.log('📈 上传图片数量:', result.uploadedImages);
      console.log('❌ 失败图片数量:', result.failedImages);
      
      if (result.processedContent) {
        console.log('\n📄 处理后的Markdown内容:');
        console.log(result.processedContent);
      }
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        console.log('\n🔗 上传的图片URL:');
        result.imageUrls.forEach((url, index) => {
          console.log(`${index + 1}. ${url}`);
        });
      }
    } else {
      console.log('\n❌ 处理失败:', result.error);
    }
    
  } catch (error) {
    console.error('\n💥 API调用失败:', error.message);
  }
}

// 简单测试函数
async function simpleTest() {
  const apiUrl = 'http://localhost:8787/api/process/obsidian-content';
  
  const simpleRequest = {
    files: [
      {
        path: 'simple-test.md',
        content: '# 简单测试\n\n![测试](./test.jpg)'
      }
    ],
    images: [
      {
        path: './test.jpg',
        data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
        filename: 'test.jpg'
      }
    ],
    options: {
      enableSmartCompression: true,
      imageQuality: 0.8
    }
  };
  
  try {
    console.log('\n🧪 执行简单测试...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simpleRequest)
    });
    
    const result = await response.json();
    
    console.log('简单测试结果:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('简单测试失败:', error.message);
  }
}

// 执行测试
async function runTests() {
  console.log('='.repeat(60));
  console.log('🔬 Obsidian内容处理API测试');
  console.log('='.repeat(60));
  
  // 先执行简单测试
  await simpleTest();
  
  console.log('\n' + '-'.repeat(60));
  
  // 再执行完整测试
  await testObsidianContentAPI();
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 测试完成');
  console.log('='.repeat(60));
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testObsidianContentAPI,
  simpleTest,
  runTests
};