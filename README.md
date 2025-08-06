# Cursor × Runpod Deploy Tool

A complete deployment solution for sending code to Runpod serverless endpoints, built as both an MCP server and a standalone CLI tool.

## ✅ What's Working

- **CLI Tool** (`deploy.js`) - Ready to use now! 🚀
- **MCP Server** - Built and functional (Cursor MCP integration pending)
- **Full Deployment Pipeline** - File/directory packaging, HTTP API calls, error handling
- **Test Worker** - Python worker for handling deployments

## 🚀 Quick Start (CLI)

### 1. Setup
Make sure your Runpod API key is exported:
```bash
export RUNPOD_API_KEY="your-runpod-api-key-here"
```

### 2. Usage Examples

**Deploy a single file:**
```bash
node deploy.js wv0jjdofkvflf5 ./test-hello.py -p test-hello.py
```

**Deploy with environment variables:**
```bash
node deploy.js wv0jjdofkvflf5 ./my-script.py --env NODE_ENV=production --env DEBUG=true
```

**Deploy a directory asynchronously:**
```bash
node deploy.js wv0jjdofkvflf5 ./my-project --async
```

**Get help:**
```bash
node deploy.js --help
```

## 📁 Project Structure

```
Cursor x Runpod/
├── deploy.js                    # CLI tool (ready to use!)
├── test-hello.py               # Sample test file
├── tools/runpod-mcp/           # MCP server
│   ├── src/                    # TypeScript source
│   ├── dist/                   # Compiled JavaScript
│   └── package.json            # Dependencies
├── test-worker.py              # Runpod worker template
└── .cursor/
    ├── mcp.json                # MCP server config
    └── rules/deploy-to-runpod.mdc # Development rules
```

## 🔧 Features

### CLI Tool Features
- ✅ **Single file or directory deployment**
- ✅ **Sync/async execution modes**
- ✅ **Environment variable support**
- ✅ **Custom entrypoint specification**
- ✅ **Automatic payload size validation**
- ✅ **Rate limiting and error handling**
- ✅ **Beautiful progress output**

### MCP Server Features
- ✅ **Full MCP compliance**
- ✅ **`runpod.deploy` tool**
- ✅ **Same functionality as CLI**
- ⏳ **Waiting for Cursor MCP integration fix**

## 🛠 Technical Details

### Payload Limits
- **Async mode**: 10MB max
- **Sync mode**: 20MB max

### Rate Limits
- **Async**: 1000 requests per 10 seconds
- **Sync**: 2000 requests per 10 seconds

### Error Handling
- Exponential backoff for rate limits
- Timeout protection
- Detailed error messages
- Graceful failure modes

## 🎯 Recent Test Results

```
✅ Deployment completed!
📊 Results:
   Job ID: sync-c3e93547-1664-440b-ae4b-5ebb6e32ac10-u1
   Status: COMPLETED
   Duration: 729ms
   Mode: Synchronous
```

## 📝 Next Steps

1. **Use the CLI tool** for immediate deployments
2. **Deploy your test worker** to Runpod endpoint
3. **Wait for Cursor MCP fix** (community issue, not our code)
4. **Extend functionality** as needed

## 🐛 Troubleshooting

### MCP Server Not Loading
This is a known Cursor issue. Use the CLI tool instead - it has identical functionality.

### API Key Issues
Make sure `RUNPOD_API_KEY` is exported in your shell before running Cursor or the CLI tool.

### Network Issues
The tool includes automatic retry logic with exponential backoff for transient network issues.

---

**Built with ❤️ for the Cursor × Runpod community**