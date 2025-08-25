# Handwriting OCR Archive System

A web-based system for OCR processing of handwritten notes with automatic GitHub integration.

## Quick Start

### 1. Start the Server

```bash
# Start backend server (port 8788)
cd backend
node real-server.cjs

# Start frontend server (port 8080)
python3 -m http.server 8080
```

### 2. Access the System

**Admin Dashboard**: http://localhost:8080/admin-dashboard.html
- Manage system configuration
- View OCR processing status
- Configure GitHub integration

**Handwriting OCR**: http://localhost:8080/handwriting-archive.html
- Upload handwritten images
- Process OCR in batches
- Save results to GitHub repository

## Features

- **Batch OCR Processing**: Upload multiple images for simultaneous OCR
- **Auto Markdown Generation**: Converts OCR results to structured markdown
- **GitHub Integration**: Automatically saves processed notes to your repository
- **Version Control**: Creates new branches when conflicts detected
- **Local Sync**: Pulls latest changes after saving to maintain consistency

## Usage

1. Upload handwritten images via the web interface
2. System processes images using GLM-4.5V OCR model
3. Review and edit OCR results
4. Save directly to your GitHub notes repository
5. System automatically syncs local repository

## Configuration

Ensure your `.env` file contains:
- `SILICONFLOW_API_KEY`: Your SiliconFlow API key
- `GITHUB_TOKEN`: GitHub personal access token
- Repository settings for automatic saving