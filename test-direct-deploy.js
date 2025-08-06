#!/usr/bin/env node

import { deployToRunpod } from './tools/runpod-mcp/dist/deploy.js';

async function testDeploy() {
  try {
    console.log('🚀 Testing direct deployment to Runpod...');
    
    const result = await deployToRunpod({
      endpointId: 'wv0jjdofkvflf5',
      workdirOrFile: '/Users/zachgulsby/Cursor x Runpod/test-hello.py',
      entrypoint: 'test-hello.py',
      env: { 'TEST_VAR': 'Hello from direct test!' },
      sync: true
    });
    
    console.log('✅ Deployment successful!');
    console.log('📊 Results:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
}

testDeploy();