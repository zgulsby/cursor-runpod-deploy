#!/usr/bin/env node

import { deployToRunpod } from './tools/runpod-mcp/dist/deploy.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    endpointId: null,
    workdirOrFile: null,
    entrypoint: null,
    env: {},
    sync: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--endpoint':
      case '-e':
        config.endpointId = args[++i];
        break;
      case '--file':
      case '--dir':
      case '-f':
        config.workdirOrFile = args[++i];
        break;
      case '--entrypoint':
      case '-p':
        config.entrypoint = args[++i];
        break;
      case '--env':
        const envPair = args[++i].split('=');
        config.env[envPair[0]] = envPair[1];
        break;
      case '--async':
      case '-a':
        config.sync = false;
        break;
      case '--sync':
      case '-s':
        config.sync = true;
        break;
      case '--help':
      case '-h':
        config.help = true;
        break;
      default:
        if (!config.endpointId) {
          config.endpointId = arg;
        } else if (!config.workdirOrFile) {
          config.workdirOrFile = arg;
        }
    }
  }

  return config;
}

function showHelp() {
  console.log(`
🚀 Runpod Deploy CLI

Usage:
  node deploy.js <endpointId> <file-or-dir> [options]
  
Arguments:
  endpointId      Your Runpod endpoint ID
  file-or-dir     Path to file or directory to deploy

Options:
  -e, --endpoint  Runpod endpoint ID (alternative to positional arg)
  -f, --file      File or directory path (alternative to positional arg)
  -p, --entrypoint Entrypoint specification (e.g., "handler.py:handler")
  --env KEY=VALUE Environment variable (can be used multiple times)
  -s, --sync      Run synchronously (default)
  -a, --async     Run asynchronously
  -h, --help      Show this help

Examples:
  # Deploy a single file
  node deploy.js wv0jjdofkvflf5 ./test-hello.py -p "test-hello.py"
  
  # Deploy a directory with environment variables
  node deploy.js wv0jjdofkvflf5 ./my-project --env NODE_ENV=production --env DEBUG=true
  
  # Async deployment
  node deploy.js wv0jjdofkvflf5 ./large-project --async

Environment:
  RUNPOD_API_KEY  Your Runpod API key (required)
`);
}

async function main() {
  const config = parseArgs();

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  // Validate required arguments
  if (!config.endpointId) {
    console.error('❌ Error: Endpoint ID is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (!config.workdirOrFile) {
    console.error('❌ Error: File or directory path is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (!process.env.RUNPOD_API_KEY) {
    console.error('❌ Error: RUNPOD_API_KEY environment variable is required');
    console.error('Export your API key: export RUNPOD_API_KEY="your-key-here"');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting Runpod deployment...');
    console.log(`📍 Endpoint: ${config.endpointId}`);
    console.log(`📁 Target: ${config.workdirOrFile}`);
    console.log(`🔄 Mode: ${config.sync ? 'Sync' : 'Async'}`);
    
    if (config.entrypoint) {
      console.log(`🎯 Entrypoint: ${config.entrypoint}`);
    }
    
    if (Object.keys(config.env).length > 0) {
      console.log(`🌍 Environment:`, config.env);
    }
    
    console.log('');

    const startTime = Date.now();
    const result = await deployToRunpod({
      endpointId: config.endpointId,
      workdirOrFile: config.workdirOrFile,
      entrypoint: config.entrypoint,
      env: config.env,
      sync: config.sync
    });

    const duration = Date.now() - startTime;
    
    console.log('✅ Deployment completed!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Job ID: ${result.jobId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Duration: ${result.duration}`);
    console.log(`   Mode: ${result.sync ? 'Synchronous' : 'Asynchronous'}`);
    
    if (result.output) {
      console.log('');
      console.log('📤 Output:');
      console.log(JSON.stringify(result.output, null, 2));
    }
    
    if (result.error) {
      console.log('');
      console.log('⚠️  Error:');
      console.log(result.error);
    }

  } catch (error) {
    console.error('❌ Deployment failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});