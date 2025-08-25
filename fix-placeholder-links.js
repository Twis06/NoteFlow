#!/usr/bin/env node

/**
 * 修复占位符链接脚本
 * 将错误的占位符CDN链接改回本地Obsidian格式
 */

const fs = require('fs');
const path = require('path');

// 笔记目录路径
const NOTES_DIR = '/Users/lipeiyang/Documents/notes';

/**
 * 递归扫描目录中的所有Markdown文件
 * @param {string} dir - 目录路径
 * @returns {string[]} - Markdown文件路径数组
 */
function findMarkdownFiles(dir) {
    const files = [];
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...findMarkdownFiles(fullPath));
            } else if (item.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`扫描目录失败: ${dir}`, error.message);
    }
    
    return files;
}

/**
 * 修复文件中的占位符链接
 * @param {string} filePath - 文件路径
 * @returns {boolean} - 是否有修改
 */
function fixPlaceholderLinks(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // 匹配占位符链接的正则表达式
        const placeholderRegex = /!\[\]\(https:\/\/imagedelivery\.net\/placeholder\/obsidian-([^)]+)\)/g;
        
        // 替换占位符链接为Obsidian格式
        const newContent = content.replace(placeholderRegex, (match, imageName) => {
            modified = true;
            console.log(`  修复: ${match} -> ![[${imageName}]]`);
            return `![[${imageName}]]`;
        });
        
        if (modified) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`✅ 修复完成: ${path.basename(filePath)}`);
        }
        
        return modified;
    } catch (error) {
        console.error(`修复文件失败: ${filePath}`, error.message);
        return false;
    }
}

/**
 * 主函数
 */
function main() {
    console.log('🔧 开始修复占位符链接...');
    console.log(`📁 扫描目录: ${NOTES_DIR}`);
    
    // 检查目录是否存在
    if (!fs.existsSync(NOTES_DIR)) {
        console.error(`❌ 目录不存在: ${NOTES_DIR}`);
        process.exit(1);
    }
    
    // 查找所有Markdown文件
    const markdownFiles = findMarkdownFiles(NOTES_DIR);
    console.log(`📄 找到 ${markdownFiles.length} 个Markdown文件`);
    
    let totalFixed = 0;
    let filesModified = 0;
    
    // 处理每个文件
    for (const filePath of markdownFiles) {
        console.log(`\n🔍 检查文件: ${path.basename(filePath)}`);
        
        if (fixPlaceholderLinks(filePath)) {
            filesModified++;
        }
    }
    
    console.log(`\n📊 修复完成:`);
    console.log(`   - 处理文件: ${markdownFiles.length} 个`);
    console.log(`   - 修改文件: ${filesModified} 个`);
    
    if (filesModified > 0) {
        console.log('\n🚀 现在可以重新运行批量替换功能了!');
        console.log('   使用命令: curl -X POST http://localhost:8788/api/batch-replace -H "Content-Type: application/json" -d \'{"targetDirectory": "/Users/lipeiyang/Documents/notes", "dryRun": true}\'');
    } else {
        console.log('\n✨ 没有找到需要修复的占位符链接');
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { findMarkdownFiles, fixPlaceholderLinks };