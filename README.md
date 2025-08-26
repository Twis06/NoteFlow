# Handwriting OCR Archive System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

A powerful web-based system for OCR processing of handwritten notes with automatic GitHub integration and intelligent document management.

## Features

- **Advanced OCR Processing**: Powered by GLM-4.5V for accurate handwriting recognition
- **Batch Processing**: Upload and process multiple images simultaneously
- **GitHub Integration**: Automatic saving and version control
- **Smart Formatting**: Auto-converts OCR results to structured Markdown
- **Web Interface**: Modern, responsive user interface
- **Real-time Processing**: Live preview and editing capabilities

## Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.7+ (for static file serving)
- GitHub Personal Access Token
- SiliconFlow API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/handwriting-ocr-archive.git
cd handwriting-ocr-archive

# Install dependencies
cd backend
npm install

# Configure environment
cp ../.env.example ../.env
# Edit .env with your API keys
```

### Running the System

```bash
# Option 1: Use the startup script (recommended)
./start-all.sh

# Option 2: Manual startup
# Terminal 1: Start backend server (port 8788)
cd backend
node real-server.cjs

# Terminal 2: Start frontend server (port 8080)
python3 -m http.server 8080
```

### Access the System

**Web Interfaces**:
- **Admin Dashboard**: http://localhost:8080/admin-dashboard.html
- **Handwriting OCR**: http://localhost:8080/handwriting-archive.html

## Usage Guide

### Basic Workflow
1. **Upload**: Drag and drop handwritten images or select files
2. **Process**: System automatically performs OCR using GLM-4.5V
3. **Review**: Edit and refine the generated Markdown content
4. **Save**: Automatically commit to your GitHub repository
5. **Sync**: Local repository stays synchronized

### Advanced Features
- **Batch Processing**: Handle multiple images simultaneously
- **Smart Conflict Resolution**: Automatic branch creation for version conflicts
- **Real-time Preview**: Live Markdown rendering
- **Quality Control**: Manual review and editing capabilities

## Configuration

### Environment Variables
Create a `.env` file in the project root:

```env
# Required API Keys
SILICONFLOW_API_KEY=your_siliconflow_api_key
GITHUB_TOKEN=your_github_personal_access_token

# Optional Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
```

### API Key Setup
1. **SiliconFlow API**: Get your key from [SiliconFlow Platform](https://siliconflow.cn/)
2. **GitHub Token**: Create a Personal Access Token with `repo` permissions
3. **Cloudflare** (Optional): For advanced image management

## Architecture

```
├── backend/                 # Node.js/TypeScript backend
│   ├── src/
│   │   ├── providers/       # External service integrations
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── types.ts         # Type definitions
│   └── real-server.cjs      # Main server file
├── docs/                    # Documentation
├── admin-dashboard.html     # System management interface
└── handwriting-archive.html # Main OCR interface
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [Documentation](docs/)
- [Issue Tracker](https://github.com/yourusername/handwriting-ocr-archive/issues)
- [Discussions](https://github.com/yourusername/handwriting-ocr-archive/discussions)
- Repository settings for automatic saving