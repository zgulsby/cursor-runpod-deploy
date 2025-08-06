import { readFileSync, statSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import JSZip from 'jszip';
import fetch from 'node-fetch';

interface DeployArgs {
  endpointId: string;
  workdirOrFile: string;
  entrypoint?: string;
  env?: Record<string, string>;
  sync?: boolean;
}

interface RunpodResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: any;
  error?: string;
}

// Payload size limits (in bytes)
const ASYNC_LIMIT = 10 * 1024 * 1024; // 10MB
const SYNC_LIMIT = 20 * 1024 * 1024;  // 20MB

// Rate limiting
const RATE_LIMIT_RETRY_DELAY = 1000; // Start with 1 second
const MAX_RETRIES = 5;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function zipDirectory(dirPath: string): Promise<Buffer> {
  const zip = new JSZip();
  
  function addFilesToZip(currentPath: string, relativePath: string = '') {
    const items = readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = join(currentPath, item);
      const itemRelativePath = relativePath ? join(relativePath, item) : item;
      
      // Skip common files that shouldn't be deployed
      if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__') {
        continue;
      }
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        addFilesToZip(fullPath, itemRelativePath);
      } else {
        const content = readFileSync(fullPath);
        zip.file(itemRelativePath, content);
      }
    }
  }
  
  addFilesToZip(dirPath);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function validatePayloadSize(payload: any, isSync: boolean): void {
  const payloadStr = JSON.stringify(payload);
  const size = Buffer.byteLength(payloadStr, 'utf8');
  const limit = isSync ? SYNC_LIMIT : ASYNC_LIMIT;
  
  if (size > limit) {
    throw new Error(
      `Payload size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds ${isSync ? 'sync' : 'async'} limit (${limit / 1024 / 1024}MB)`
    );
  }
}

async function makeRunpodRequest(
  endpointId: string, 
  payload: any, 
  isSync: boolean, 
  retryCount = 0
): Promise<RunpodResponse> {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    throw new Error('RUNPOD_API_KEY environment variable is required');
  }

  const endpoint = isSync ? 'runsync' : 'run';
  const url = `https://api.runpod.ai/v2/${endpointId}/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: payload }),
    });

    // Handle rate limiting
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Rate limit exceeded, max retries reached');
      }
      
      const delay = RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount);
      console.error(`Rate limited, retrying in ${delay}ms...`);
      await sleep(delay);
      return makeRunpodRequest(endpointId, payload, isSync, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    
    if (isSync) {
      return {
        id: result.id || 'sync-job',
        status: result.status || 'COMPLETED',
        output: result.output,
        error: result.error
      };
    } else {
      return {
        id: result.id,
        status: 'IN_QUEUE',
        output: null
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error(`Request timeout to Runpod endpoint ${endpointId}`);
    }
    throw error;
  }
}

async function pollJobStatus(endpointId: string, jobId: string): Promise<RunpodResponse> {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    throw new Error('RUNPOD_API_KEY environment variable is required');
  }

  const url = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;
  
  while (true) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json() as any;
      
      if (result.status === 'COMPLETED' || result.status === 'FAILED') {
        return {
          id: jobId,
          status: result.status,
          output: result.output,
          error: result.error
        };
      }
      
      // Wait 2 seconds before polling again
      await sleep(2000);
    } catch (error) {
      throw new Error(`Failed to poll job status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function deployToRunpod(args: DeployArgs): Promise<any> {
  const { endpointId, workdirOrFile, entrypoint, env = {}, sync = true } = args;
  
  let payload: any;
  
  try {
    const stat = statSync(workdirOrFile);
    
    if (stat.isDirectory()) {
      // Zip the directory
      console.error(`Zipping directory: ${workdirOrFile}`);
      const zipBuffer = await zipDirectory(workdirOrFile);
      
      payload = {
        artifact: zipBuffer.toString('base64'),
        entrypoint,
        env,
        workdir: basename(workdirOrFile)
      };
    } else {
      // Single file
      console.error(`Reading file: ${workdirOrFile}`);
      const fileContent = readFileSync(workdirOrFile, 'utf8');
      
      payload = {
        file: fileContent,
        filename: basename(workdirOrFile),
        entrypoint,
        env
      };
    }
  } catch (error) {
    throw new Error(`Failed to read ${workdirOrFile}: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Validate payload size
  validatePayloadSize(payload, sync);
  
  console.error(`Deploying to endpoint ${endpointId} (${sync ? 'sync' : 'async'})...`);
  
  const startTime = Date.now();
  const result = await makeRunpodRequest(endpointId, payload, sync);
  
  if (sync) {
    const duration = Date.now() - startTime;
    return {
      endpointId,
      jobId: result.id,
      status: result.status,
      duration: `${duration}ms`,
      output: result.output,
      error: result.error,
      sync: true
    };
  } else {
    // For async, optionally poll for completion
    console.error(`Job queued with ID: ${result.id}`);
    console.error('Polling for completion...');
    
    const finalResult = await pollJobStatus(endpointId, result.id);
    const duration = Date.now() - startTime;
    
    return {
      endpointId,
      jobId: finalResult.id,
      status: finalResult.status,
      duration: `${duration}ms`,
      output: finalResult.output,
      error: finalResult.error,
      sync: false
    };
  }
}