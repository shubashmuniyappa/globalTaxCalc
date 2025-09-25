#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Test individual services without external dependencies
const services = [
  { name: 'API Gateway', path: './api-gateway', port: 3000 },
  { name: 'Auth Service', path: './auth-service', port: 3001 },
  { name: 'Ad Service', path: './ad-service', port: 3006 },
  { name: 'Analytics Service', path: './analytics-service', port: 3004 }, // Changed port to avoid conflict
  { name: 'Notification Service', path: './notification-service', port: 3007 }
];

function createTestEnv(servicePath) {
  const envPath = path.join(servicePath, '.env');
  const envExamplePath = path.join(servicePath, '.env.example');

  if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envExamplePath, 'utf8');

    // Disable database connections for testing
    envContent = envContent
      .replace(/^MONGODB_URI=.*/gm, 'MONGODB_URI=disabled')
      .replace(/^DATABASE_URL=.*/gm, 'DATABASE_URL=disabled')
      .replace(/^REDIS_URL=.*/gm, 'REDIS_URL=disabled')
      .replace(/^NODE_ENV=.*/gm, 'NODE_ENV=test')
      .replace(/^LOG_LEVEL=.*/gm, 'LOG_LEVEL=error');

    fs.writeFileSync(envPath, envContent);
    return true;
  }
  return false;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

async function testService(service) {
  console.log(`\n🔍 Testing ${service.name}...`);

  const result = {
    name: service.name,
    envCreated: false,
    canStart: false,
    portListening: false,
    errors: []
  };

  // Create test environment
  result.envCreated = createTestEnv(service.path);
  if (result.envCreated) {
    console.log(`  ✅ Created test environment for ${service.name}`);
  }

  // Check if main files exist
  const serverPath = path.join(service.path, 'server.js');
  const appPath = path.join(service.path, 'app.js');

  if (!fs.existsSync(serverPath) && !fs.existsSync(appPath)) {
    result.errors.push('No server.js or app.js found');
    console.log(`  ❌ ${service.name}: No main server file found`);
    return result;
  }

  const mainFile = fs.existsSync(serverPath) ? 'server.js' : 'app.js';

  // Try to start the service
  return new Promise((resolve) => {
    const serviceProcess = spawn('node', [mainFile], {
      cwd: service.path,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', PORT: service.port }
    });

    let started = false;
    let output = '';

    const timeout = setTimeout(() => {
      if (!started) {
        result.errors.push('Startup timeout (10s)');
        serviceProcess.kill();
        resolve(result);
      }
    }, 10000);

    serviceProcess.stdout.on('data', (data) => {
      output += data.toString();

      // Look for startup indicators
      if (output.includes('listening') ||
          output.includes('started') ||
          output.includes('server') ||
          output.includes(service.port.toString())) {

        if (!started) {
          started = true;
          result.canStart = true;
          console.log(`  ✅ ${service.name} started successfully`);

          // Test port after short delay
          setTimeout(async () => {
            result.portListening = await checkPort(service.port);
            if (result.portListening) {
              console.log(`  ✅ ${service.name} is listening on port ${service.port}`);
            } else {
              console.log(`  ⚠️ ${service.name} not responding on port ${service.port}`);
            }

            clearTimeout(timeout);
            serviceProcess.kill();
            resolve(result);
          }, 2000);
        }
      }
    });

    serviceProcess.stderr.on('data', (data) => {
      const error = data.toString();
      result.errors.push(error.substring(0, 200)); // Truncate long errors

      // Check for database errors (expected in test mode)
      if (error.includes('ECONNREFUSED') ||
          error.includes('database') ||
          error.includes('redis') ||
          error.includes('mongodb')) {
        console.log(`  ⚠️ ${service.name}: Database connection error (expected in test mode)`);
      }
    });

    serviceProcess.on('error', (error) => {
      if (!started) {
        result.errors.push(error.message);
        clearTimeout(timeout);
        resolve(result);
      }
    });

    serviceProcess.on('exit', (code) => {
      if (!started) {
        result.errors.push(`Process exited with code ${code}`);
        clearTimeout(timeout);
        resolve(result);
      }
    });
  });
}

async function runTests() {
  console.log('🔍 GlobalTaxCalc Microservices Simple Test');
  console.log('=' .repeat(50));

  const results = [];

  // Test each service
  for (const service of services) {
    const result = await testService(service);
    results.push(result);

    // Wait between tests to avoid port conflicts
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=' .repeat(50));

  const successful = results.filter(r => r.canStart);
  const listening = results.filter(r => r.portListening);

  console.log(`Total Services Tested: ${results.length}`);
  console.log(`Services That Started: ${successful.length}`);
  console.log(`Services Listening on Port: ${listening.length}`);

  console.log('\n✅ SUCCESSFUL SERVICES:');
  successful.forEach(r => {
    console.log(`  - ${r.name}: ${r.portListening ? 'Listening' : 'Started but not responding'}`);
  });

  console.log('\n❌ FAILED SERVICES:');
  results.filter(r => !r.canStart).forEach(r => {
    console.log(`  - ${r.name}: ${r.errors[0] || 'Unknown error'}`);
  });

  console.log('\n💡 ISSUES FOUND:');
  let issueCount = 0;

  if (successful.length === 0) {
    console.log('  - No services could start - check dependencies and configurations');
    issueCount++;
  }

  if (successful.length > 0 && listening.length === 0) {
    console.log('  - Services start but don\'t respond to HTTP requests');
    issueCount++;
  }

  const dbErrors = results.some(r =>
    r.errors.some(e => e.includes('database') || e.includes('redis') || e.includes('mongodb'))
  );

  if (dbErrors) {
    console.log('  - Database connectivity issues (start MongoDB, Redis, PostgreSQL)');
    issueCount++;
  }

  if (issueCount === 0) {
    console.log('  - No major issues found! Services are working in test mode');
  }

  console.log('\n🔧 NEXT STEPS:');
  if (successful.length > 0) {
    console.log('  1. Start database services for full functionality');
    console.log('  2. Test service-to-service communication');
    console.log('  3. Configure production environment');
  } else {
    console.log('  1. Install missing dependencies (npm install in each service)');
    console.log('  2. Check Node.js version compatibility');
    console.log('  3. Review service configurations');
  }

  // Cleanup test env files
  console.log('\n🧹 Cleaning up...');
  for (const service of services) {
    const envPath = path.join(service.path, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('NODE_ENV=test')) {
        fs.unlinkSync(envPath);
        console.log(`  ✅ Cleaned test .env for ${service.name}`);
      }
    }
  }

  return results;
}

// Run the tests
runTests().catch(console.error);