#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Service configurations
const services = [
  { name: 'API Gateway', path: './api-gateway', port: 3000, hasNodeModules: false },
  { name: 'Auth Service', path: './auth-service', port: 3001, hasNodeModules: false },
  { name: 'Ad Service', path: './ad-service', port: 3006, hasNodeModules: false },
  { name: 'Analytics Service', path: './analytics-service', port: 3006, hasNodeModules: false },
  { name: 'Notification Service', path: './notification-service', port: 3007, hasNodeModules: false },
  { name: 'Content Service', path: './content-service', port: 3002, hasNodeModules: false },
  { name: 'File Service', path: './file-service', port: 3003, hasNodeModules: false },
  { name: 'Geolocation Service', path: './geolocation-service', port: 3004, hasNodeModules: false },
  { name: 'Monitoring Service', path: './monitoring-service', port: 3005, hasNodeModules: false },
  { name: 'Report Service', path: './report-service', port: 3008, hasNodeModules: false },
  { name: 'Search Service', path: './search-service', port: 3009, hasNodeModules: false }
];

async function checkServiceExists(servicePath) {
  try {
    const packageJsonPath = path.join(servicePath, 'package.json');
    const serverJsPath = path.join(servicePath, 'server.js');
    const appJsPath = path.join(servicePath, 'app.js');

    const hasPackageJson = fs.existsSync(packageJsonPath);
    const hasServerJs = fs.existsSync(serverJsPath);
    const hasAppJs = fs.existsSync(appJsPath);
    const hasNodeModules = fs.existsSync(path.join(servicePath, 'node_modules'));

    return {
      exists: hasPackageJson && (hasServerJs || hasAppJs),
      hasPackageJson,
      hasServerJs,
      hasAppJs,
      hasNodeModules
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

async function checkDependencies(servicePath) {
  try {
    const packageJsonPath = path.join(servicePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return { valid: false, error: 'No package.json found' };
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});

    return {
      valid: true,
      totalDeps: dependencies.length + devDependencies.length,
      dependencies: dependencies.slice(0, 5), // Show first 5 dependencies
      scripts: Object.keys(packageJson.scripts || {})
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function testServiceStartup(servicePath, serviceName) {
  try {
    // Try to load the main file without actually starting the server
    const packageJsonPath = path.join(servicePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return { canStart: false, error: 'No package.json' };
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const mainFile = packageJson.main || 'server.js';
    const mainFilePath = path.join(servicePath, mainFile);

    if (!fs.existsSync(mainFilePath)) {
      return { canStart: false, error: `Main file ${mainFile} not found` };
    }

    // Check if node_modules exists
    const nodeModulesPath = path.join(servicePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      return { canStart: false, error: 'Dependencies not installed (no node_modules)' };
    }

    return { canStart: true, mainFile };
  } catch (error) {
    return { canStart: false, error: error.message };
  }
}

async function checkEnvironmentFiles(servicePath) {
  const envPath = path.join(servicePath, '.env');
  const envExamplePath = path.join(servicePath, '.env.example');

  return {
    hasEnv: fs.existsSync(envPath),
    hasEnvExample: fs.existsSync(envExamplePath)
  };
}

async function runServiceTests() {
  console.log('🔍 GlobalTaxCalc Microservices Health Check');
  console.log('=' .repeat(60));

  const results = [];

  for (const service of services) {
    console.log(`\n📋 Testing ${service.name}...`);

    const serviceCheck = await checkServiceExists(service.path);
    const depCheck = await checkDependencies(service.path);
    const envCheck = await checkEnvironmentFiles(service.path);

    let startupCheck = { canStart: false, error: 'Service does not exist' };
    if (serviceCheck.exists) {
      startupCheck = await testServiceStartup(service.path, service.name);
    }

    const result = {
      name: service.name,
      path: service.path,
      port: service.port,
      ...serviceCheck,
      dependencies: depCheck,
      environment: envCheck,
      startup: startupCheck
    };

    results.push(result);

    // Display results
    console.log(`  ✅ Exists: ${serviceCheck.exists ? 'Yes' : 'No'}`);
    if (serviceCheck.exists) {
      console.log(`  📦 Dependencies: ${depCheck.totalDeps || 0} total`);
      console.log(`  🔧 Node Modules: ${serviceCheck.hasNodeModules ? 'Installed' : 'Missing'}`);
      console.log(`  ⚙️  Environment: ${envCheck.hasEnvExample ? '.env.example ✅' : 'No .env.example ❌'}`);
      console.log(`  🚀 Can Start: ${startupCheck.canStart ? 'Yes' : `No - ${startupCheck.error}`}`);
    }
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('=' .repeat(60));

  const existingServices = results.filter(r => r.exists);
  const servicesWithDeps = results.filter(r => r.hasNodeModules);
  const servicesCanStart = results.filter(r => r.startup.canStart);

  console.log(`Total Services Found: ${existingServices.length}/${services.length}`);
  console.log(`Services with Dependencies: ${servicesWithDeps.length}/${existingServices.length}`);
  console.log(`Services Ready to Start: ${servicesCanStart.length}/${existingServices.length}`);

  console.log('\n🚀 Services Ready to Start:');
  servicesCanStart.forEach(service => {
    console.log(`  - ${service.name} (Port: ${service.port})`);
  });

  console.log('\n❌ Services with Issues:');
  const servicesWithIssues = results.filter(r => r.exists && !r.startup.canStart);
  servicesWithIssues.forEach(service => {
    console.log(`  - ${service.name}: ${service.startup.error}`);
  });

  console.log('\n💡 Next Steps:');
  console.log('1. Install missing dependencies: npm install');
  console.log('2. Create .env files from .env.example templates');
  console.log('3. Start database services (MongoDB, Redis, PostgreSQL)');
  console.log('4. Test individual service startup');

  return results;
}

// Run the tests
runServiceTests().catch(console.error);