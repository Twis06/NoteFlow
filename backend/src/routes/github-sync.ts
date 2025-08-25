/**
 * GitHub同步API路由
 * 支持将处理后的文档自动同步到GitHub仓库
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// 启用CORS
app.use('*', cors());

// GitHub同步接口
app.post('/sync', async (c) => {
  try {
    const body = await c.req.json();
    console.log('[GitHub Sync] Starting sync process');
    
    const { repoUrl, branch = 'main', documents, commitMessage } = body;
    
    if (!repoUrl) {
      return c.json({
        success: false,
        error: 'Repository URL is required'
      }, 400);
    }
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return c.json({
        success: false,
        error: 'No documents provided for sync'
      }, 400);
    }
    
    // 解析仓库信息
    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      return c.json({
        success: false,
        error: 'Invalid GitHub repository URL'
      }, 400);
    }
    
    console.log(`[GitHub Sync] Syncing to ${repoInfo.owner}/${repoInfo.repo}`);
    
    // 执行同步操作
    const syncResult = await syncDocumentsToGitHub(repoInfo, branch, documents, commitMessage);
    
    if (syncResult.success) {
      return c.json({
        success: true,
        data: {
          syncedFiles: syncResult.syncedFiles || [],
          commitSha: syncResult.commitSha,
          commitUrl: syncResult.commitUrl,
          summary: {
            totalDocuments: documents.length,
            syncedCount: syncResult.syncedFiles?.length || 0,
            repository: `${repoInfo.owner}/${repoInfo.repo}`,
            branch: branch
          }
        }
      });
    } else {
      return c.json({
        success: false,
        error: syncResult.error
      }, 500);
    }
    
  } catch (error) {
    console.error('[GitHub Sync] Sync error:', error);
    return c.json({
      success: false,
      error: 'Internal server error during GitHub sync'
    }, 500);
  }
});

// 获取仓库文件列表接口
app.post('/files', async (c) => {
  try {
    const body = await c.req.json();
    const { repoUrl, branch = 'main', path = '' } = body;
    
    if (!repoUrl) {
      return c.json({
        success: false,
        error: 'Repository URL is required'
      }, 400);
    }
    
    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      return c.json({
        success: false,
        error: 'Invalid GitHub repository URL'
      }, 400);
    }
    
    console.log(`[GitHub Files] Getting files from ${repoInfo.owner}/${repoInfo.repo}`);
    
    const filesResult = await getRepositoryFiles(repoInfo, branch, path);
    
    if (filesResult.success) {
      return c.json({
        success: true,
        data: {
          files: filesResult.files,
          repository: `${repoInfo.owner}/${repoInfo.repo}`,
          branch: branch,
          path: path
        }
      });
    } else {
      return c.json({
        success: false,
        error: filesResult.error
      }, 500);
    }
    
  } catch (error) {
    console.error('[GitHub Files] Error:', error);
    return c.json({
      success: false,
      error: 'Internal server error while fetching files'
    }, 500);
  }
});

// 创建新仓库接口
app.post('/create-repo', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, isPrivate = false, autoInit = true } = body;
    
    if (!name) {
      return c.json({
        success: false,
        error: 'Repository name is required'
      }, 400);
    }
    
    console.log(`[GitHub Create] Creating repository: ${name}`);
    
    const createResult = await createGitHubRepository(name, description, isPrivate, autoInit);
    
    if (createResult.success) {
      return c.json({
        success: true,
        data: {
          repository: createResult.repository,
          url: createResult.url,
          cloneUrl: createResult.cloneUrl
        }
      });
    } else {
      return c.json({
        success: false,
        error: createResult.error
      }, 500);
    }
    
  } catch (error) {
    console.error('[GitHub Create] Error:', error);
    return c.json({
      success: false,
      error: 'Internal server error while creating repository'
    }, 500);
  }
});

/**
 * 解析GitHub URL获取仓库信息
 * @param url GitHub仓库URL
 * @returns 仓库信息对象
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // 支持多种GitHub URL格式
    const patterns = [
      /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
      /^([^/]+)\/([^/]+)$/  // 简化格式: owner/repo
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[GitHub Parse] URL parsing error:', error);
    return null;
  }
}

/**
 * 同步文档到GitHub仓库
 * @param repoInfo 仓库信息
 * @param branch 目标分支
 * @param documents 文档数组
 * @param commitMessage 提交信息
 * @returns 同步结果
 */
async function syncDocumentsToGitHub(
  repoInfo: { owner: string; repo: string },
  branch: string,
  documents: any[],
  commitMessage?: string
) {
  try {
    const githubToken = (globalThis as any).process?.env?.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }
    
    const { owner, repo } = repoInfo;
    const baseUrl = 'https://api.github.com';
    
    // 获取当前分支的最新commit SHA
    const branchResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/branches/${branch}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Upload-Center-Bot'
      }
    });
    
    if (!branchResponse.ok) {
      throw new Error(`Failed to get branch info: ${branchResponse.status}`);
    }
    
    const branchData = await branchResponse.json() as any;
    const baseSha = branchData.commit.sha;
    
    // 准备文件更新
    const filesToUpdate = [];
    
    for (const doc of documents) {
      const filename = doc.filename || 'handwriting-notes.md';
      const content = doc.content || doc.markdownContent || '';
      
      // 确保文件名以.md结尾
      const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
      
      filesToUpdate.push({
        path: `notes/${finalFilename}`,
        content: btoa(unescape(encodeURIComponent(content))), // Base64编码
        encoding: 'base64'
      });
    }
    
    // 创建提交
    const defaultCommitMessage = `Add handwriting notes (${new Date().toLocaleString('zh-CN')})`;
    const finalCommitMessage = commitMessage || defaultCommitMessage;
    
    // 使用GitHub API批量更新文件
    const syncedFiles = [];
    
    for (const file of filesToUpdate) {
      try {
        // 检查文件是否已存在
        const fileResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`, {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Upload-Center-Bot'
          }
        });
        
        let sha = undefined;
        if (fileResponse.ok) {
          const fileData = await fileResponse.json() as any;
          sha = fileData.sha;
        }
        
        // 创建或更新文件
        const updateResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${file.path}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Upload-Center-Bot'
          },
          body: JSON.stringify({
            message: finalCommitMessage,
            content: file.content,
            branch: branch,
            ...(sha && { sha })
          })
        });
        
        if (updateResponse.ok) {
          const updateData = await updateResponse.json() as any;
          syncedFiles.push({
            path: file.path,
            sha: updateData.content.sha,
            url: updateData.content.html_url
          });
          console.log(`[GitHub Sync] File synced: ${file.path}`);
        } else {
          const errorText = await updateResponse.text();
          console.error(`[GitHub Sync] Failed to sync ${file.path}:`, errorText);
        }
        
      } catch (fileError) {
        console.error(`[GitHub Sync] Error syncing file ${file.path}:`, fileError);
      }
    }
    
    if (syncedFiles.length > 0) {
      return {
        success: true,
        syncedFiles,
        commitSha: syncedFiles[0]?.sha,
        commitUrl: `https://github.com/${owner}/${repo}/commits/${branch}`
      };
    } else {
      throw new Error('No files were successfully synced');
    }
    
  } catch (error) {
    console.error('[GitHub Sync] Sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown sync error'
    };
  }
}

/**
 * 获取仓库文件列表
 * @param repoInfo 仓库信息
 * @param branch 分支名
 * @param path 路径
 * @returns 文件列表结果
 */
async function getRepositoryFiles(
  repoInfo: { owner: string; repo: string },
  branch: string,
  path: string
) {
  try {
    const githubToken = (globalThis as any).process?.env?.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }
    
    const { owner, repo } = repoInfo;
    const baseUrl = 'https://api.github.com';
    
    const url = `${baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Upload-Center-Bot'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get repository contents: ${response.status}`);
    }
    
    const contents = await response.json() as any;
    
    // 处理文件列表
    const files = Array.isArray(contents) ? contents : [contents];
    
    const processedFiles = files.map((file: any) => ({
      name: file.name,
      path: file.path,
      type: file.type, // 'file' or 'dir'
      size: file.size,
      url: file.html_url,
      downloadUrl: file.download_url
    }));
    
    return {
      success: true,
      files: processedFiles
    };
    
  } catch (error) {
    console.error('[GitHub Files] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown files error'
    };
  }
}

/**
 * 创建GitHub仓库
 * @param name 仓库名
 * @param description 描述
 * @param isPrivate 是否私有
 * @param autoInit 是否自动初始化
 * @returns 创建结果
 */
async function createGitHubRepository(
  name: string,
  description?: string,
  isPrivate: boolean = false,
  autoInit: boolean = true
) {
  try {
    const githubToken = (globalThis as any).process?.env?.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }
    
    const baseUrl = 'https://api.github.com';
    
    const response = await fetch(`${baseUrl}/user/repos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Upload-Center-Bot'
      },
      body: JSON.stringify({
        name,
        description: description || `Handwriting notes repository created by Upload Center`,
        private: isPrivate,
        auto_init: autoInit,
        gitignore_template: 'Node',
        license_template: 'mit'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json() as any;
      throw new Error(`Failed to create repository: ${errorData.message || response.status}`);
    }
    
    const repoData = await response.json() as any;
    
    return {
      success: true,
      repository: repoData.full_name,
      url: repoData.html_url,
      cloneUrl: repoData.clone_url
    };
    
  } catch (error) {
    console.error('[GitHub Create] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown creation error'
    };
  }
}

// 导出路由
export default app;