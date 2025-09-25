/**
 * Snyk Dependency Security Scanning
 * Automated vulnerability scanning for dependencies and containers
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class DependencyScanner {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.reportDir = path.join(__dirname, '../reports/dependency-scan');
    this.configFile = options.configFile || '.snyk';
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async runComprehensiveScan() {
    console.log('Starting comprehensive dependency security scan...');

    const results = {
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      scans: {
        dependencies: await this.scanDependencies(),
        containers: await this.scanContainers(),
        infrastructure: await this.scanInfrastructure(),
        licenses: await this.scanLicenses()
      },
      summary: null,
      recommendations: []
    };

    results.summary = this.generateSummary(results.scans);
    results.recommendations = this.generateRecommendations(results.scans);

    await this.generateReports(results);

    return results;
  }

  async scanDependencies() {
    console.log('Scanning dependencies for vulnerabilities...');

    const scanResults = {
      frontend: await this.scanProjectDependencies(path.join(this.projectRoot, '../frontend')),
      backend: await this.scanProjectDependencies(path.join(this.projectRoot, '../backend')),
      apiGateway: await this.scanProjectDependencies(path.join(this.projectRoot, '../api-gateway')),
      authService: await this.scanProjectDependencies(path.join(this.projectRoot, '../auth-service')),
      testingSuite: await this.scanProjectDependencies(this.projectRoot)
    };

    return scanResults;
  }

  async scanProjectDependencies(projectPath) {
    if (!fs.existsSync(projectPath)) {
      console.warn(`Project path does not exist: ${projectPath}`);
      return { error: 'Project path not found' };
    }

    console.log(`  Scanning: ${path.basename(projectPath)}`);

    try {
      // Check if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return { error: 'No package.json found' };
      }

      // Run Snyk test
      const snykCommand = `snyk test --json --file=${packageJsonPath}`;
      const result = execSync(snykCommand, {
        cwd: projectPath,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      const snykResult = JSON.parse(result);

      // Run npm audit for additional insights
      let auditResult;
      try {
        const auditCommand = 'npm audit --json';
        const auditOutput = execSync(auditCommand, {
          cwd: projectPath,
          encoding: 'utf8'
        });
        auditResult = JSON.parse(auditOutput);
      } catch (auditError) {
        // npm audit returns non-zero exit code when vulnerabilities found
        try {
          auditResult = JSON.parse(auditError.stdout);
        } catch (parseError) {
          auditResult = { error: 'Failed to parse npm audit output' };
        }
      }

      return {
        projectName: path.basename(projectPath),
        snykResults: snykResult,
        auditResults: auditResult,
        vulnerabilities: this.parseVulnerabilities(snykResult),
        summary: this.summarizeProjectScan(snykResult, auditResult)
      };

    } catch (error) {
      console.error(`Error scanning ${projectPath}:`, error.message);
      return {
        projectName: path.basename(projectPath),
        error: error.message,
        summary: { error: true }
      };
    }
  }

  parseVulnerabilities(snykResult) {
    if (!snykResult.vulnerabilities) {
      return [];
    }

    return snykResult.vulnerabilities.map(vuln => ({
      id: vuln.id,
      title: vuln.title,
      severity: vuln.severity,
      packageName: vuln.packageName,
      version: vuln.version,
      from: vuln.from,
      upgradePath: vuln.upgradePath,
      isUpgradable: vuln.isUpgradable,
      isPatchable: vuln.isPatchable,
      description: vuln.description,
      cvssScore: vuln.cvssScore,
      publicationTime: vuln.publicationTime,
      disclosureTime: vuln.disclosureTime,
      functions: vuln.functions,
      semver: vuln.semver
    }));
  }

  summarizeProjectScan(snykResult, auditResult) {
    const summary = {
      totalVulnerabilities: 0,
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      upgradableIssues: 0,
      patchableIssues: 0,
      dependencies: {
        total: 0,
        vulnerable: 0
      }
    };

    if (snykResult.vulnerabilities) {
      summary.totalVulnerabilities = snykResult.vulnerabilities.length;

      snykResult.vulnerabilities.forEach(vuln => {
        summary.severityBreakdown[vuln.severity] = (summary.severityBreakdown[vuln.severity] || 0) + 1;

        if (vuln.isUpgradable) {
          summary.upgradableIssues++;
        }

        if (vuln.isPatchable) {
          summary.patchableIssues++;
        }
      });
    }

    if (auditResult && auditResult.metadata) {
      summary.dependencies.total = auditResult.metadata.dependencies || 0;
      summary.dependencies.vulnerable = auditResult.metadata.vulnerabilities || 0;
    }

    return summary;
  }

  async scanContainers() {
    console.log('Scanning container images for vulnerabilities...');

    const containerImages = [
      'globaltaxcalc/frontend:latest',
      'globaltaxcalc/api-gateway:latest',
      'globaltaxcalc/auth-service:latest',
      'postgres:15-alpine',
      'redis:7-alpine'
    ];

    const containerResults = {};

    for (const image of containerImages) {
      console.log(`  Scanning container: ${image}`);

      try {
        const command = `snyk container test ${image} --json`;
        const result = execSync(command, {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10
        });

        const scanResult = JSON.parse(result);
        containerResults[image] = {
          vulnerabilities: scanResult.vulnerabilities || [],
          summary: this.summarizeContainerScan(scanResult),
          baseImage: scanResult.baseImage,
          platform: scanResult.platform
        };

      } catch (error) {
        console.error(`Error scanning container ${image}:`, error.message);
        containerResults[image] = {
          error: error.message,
          summary: { error: true }
        };
      }
    }

    return containerResults;
  }

  summarizeContainerScan(scanResult) {
    const summary = {
      totalVulnerabilities: 0,
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      packageIssues: 0
    };

    if (scanResult.vulnerabilities) {
      summary.totalVulnerabilities = scanResult.vulnerabilities.length;

      scanResult.vulnerabilities.forEach(vuln => {
        summary.severityBreakdown[vuln.severity] = (summary.severityBreakdown[vuln.severity] || 0) + 1;
      });

      // Count unique packages with issues
      const uniquePackages = new Set(scanResult.vulnerabilities.map(v => v.packageName));
      summary.packageIssues = uniquePackages.size;
    }

    return summary;
  }

  async scanInfrastructure() {
    console.log('Scanning infrastructure as code for security issues...');

    const iacResults = {};

    // Scan Terraform files
    const terraformPath = path.join(this.projectRoot, '../infrastructure');
    if (fs.existsSync(terraformPath)) {
      iacResults.terraform = await this.scanTerraform(terraformPath);
    }

    // Scan Kubernetes manifests
    const k8sPath = path.join(this.projectRoot, '../deployment');
    if (fs.existsSync(k8sPath)) {
      iacResults.kubernetes = await this.scanKubernetes(k8sPath);
    }

    // Scan Docker files
    const dockerFiles = this.findDockerFiles();
    if (dockerFiles.length > 0) {
      iacResults.docker = await this.scanDockerFiles(dockerFiles);
    }

    return iacResults;
  }

  async scanTerraform(terraformPath) {
    try {
      const command = `snyk iac test ${terraformPath} --json`;
      const result = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      const scanResult = JSON.parse(result);
      return {
        issues: scanResult.infrastructureAsCodeIssues || [],
        summary: this.summarizeIaCScan(scanResult)
      };

    } catch (error) {
      console.error(`Error scanning Terraform:`, error.message);
      return { error: error.message };
    }
  }

  async scanKubernetes(k8sPath) {
    try {
      const command = `snyk iac test ${k8sPath} --json`;
      const result = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      const scanResult = JSON.parse(result);
      return {
        issues: scanResult.infrastructureAsCodeIssues || [],
        summary: this.summarizeIaCScan(scanResult)
      };

    } catch (error) {
      console.error(`Error scanning Kubernetes manifests:`, error.message);
      return { error: error.message };
    }
  }

  findDockerFiles() {
    const dockerFiles = [];
    const searchPaths = [
      this.projectRoot,
      path.join(this.projectRoot, '../frontend'),
      path.join(this.projectRoot, '../backend'),
      path.join(this.projectRoot, '../api-gateway')
    ];

    searchPaths.forEach(searchPath => {
      if (fs.existsSync(searchPath)) {
        const files = fs.readdirSync(searchPath);
        files.forEach(file => {
          if (file.startsWith('Dockerfile')) {
            dockerFiles.push(path.join(searchPath, file));
          }
        });
      }
    });

    return dockerFiles;
  }

  async scanDockerFiles(dockerFiles) {
    const results = {};

    for (const dockerFile of dockerFiles) {
      try {
        const command = `snyk iac test ${dockerFile} --json`;
        const result = execSync(command, {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10
        });

        const scanResult = JSON.parse(result);
        results[dockerFile] = {
          issues: scanResult.infrastructureAsCodeIssues || [],
          summary: this.summarizeIaCScan(scanResult)
        };

      } catch (error) {
        console.error(`Error scanning ${dockerFile}:`, error.message);
        results[dockerFile] = { error: error.message };
      }
    }

    return results;
  }

  summarizeIaCScan(scanResult) {
    const summary = {
      totalIssues: 0,
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };

    if (scanResult.infrastructureAsCodeIssues) {
      summary.totalIssues = scanResult.infrastructureAsCodeIssues.length;

      scanResult.infrastructureAsCodeIssues.forEach(issue => {
        summary.severityBreakdown[issue.severity] = (summary.severityBreakdown[issue.severity] || 0) + 1;
      });
    }

    return summary;
  }

  async scanLicenses() {
    console.log('Scanning dependency licenses...');

    const licenseResults = {};
    const projectPaths = [
      { name: 'frontend', path: path.join(this.projectRoot, '../frontend') },
      { name: 'backend', path: path.join(this.projectRoot, '../backend') },
      { name: 'apiGateway', path: path.join(this.projectRoot, '../api-gateway') },
      { name: 'authService', path: path.join(this.projectRoot, '../auth-service') }
    ];

    for (const project of projectPaths) {
      if (fs.existsSync(project.path)) {
        licenseResults[project.name] = await this.scanProjectLicenses(project.path);
      }
    }

    return licenseResults;
  }

  async scanProjectLicenses(projectPath) {
    try {
      // Use license-checker to scan licenses
      const command = 'npx license-checker --json';
      const result = execSync(command, {
        cwd: projectPath,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      const licenses = JSON.parse(result);
      return this.analyzeLicenses(licenses);

    } catch (error) {
      console.error(`Error scanning licenses in ${projectPath}:`, error.message);
      return { error: error.message };
    }
  }

  analyzeLicenses(licenses) {
    const analysis = {
      totalPackages: Object.keys(licenses).length,
      licenseBreakdown: {},
      potentialIssues: [],
      unknownLicenses: []
    };

    const problematicLicenses = ['GPL', 'LGPL', 'AGPL', 'CPAL', 'OSL'];
    const safeLicenses = ['MIT', 'Apache', 'BSD', 'ISC', 'Unlicense'];

    Object.entries(licenses).forEach(([packageName, info]) => {
      const license = info.licenses || 'Unknown';

      // Count license types
      analysis.licenseBreakdown[license] = (analysis.licenseBreakdown[license] || 0) + 1;

      // Check for problematic licenses
      if (problematicLicenses.some(problematic => license.includes(problematic))) {
        analysis.potentialIssues.push({
          package: packageName,
          license: license,
          reason: 'Potentially restrictive license'
        });
      }

      // Check for unknown licenses
      if (license === 'Unknown' || license === 'UNKNOWN') {
        analysis.unknownLicenses.push(packageName);
      }
    });

    return analysis;
  }

  generateSummary(scans) {
    const summary = {
      totalVulnerabilities: 0,
      criticalIssues: 0,
      highSeverityIssues: 0,
      upgradableIssues: 0,
      containerIssues: 0,
      infrastructureIssues: 0,
      licenseIssues: 0,
      overallRisk: 'Low'
    };

    // Aggregate dependency scan results
    Object.values(scans.dependencies).forEach(project => {
      if (project.summary && !project.summary.error) {
        summary.totalVulnerabilities += project.summary.totalVulnerabilities || 0;
        summary.criticalIssues += project.summary.severityBreakdown.critical || 0;
        summary.highSeverityIssues += project.summary.severityBreakdown.high || 0;
        summary.upgradableIssues += project.summary.upgradableIssues || 0;
      }
    });

    // Aggregate container scan results
    Object.values(scans.containers).forEach(container => {
      if (container.summary && !container.summary.error) {
        summary.containerIssues += container.summary.totalVulnerabilities || 0;
        summary.criticalIssues += container.summary.severityBreakdown.critical || 0;
        summary.highSeverityIssues += container.summary.severityBreakdown.high || 0;
      }
    });

    // Aggregate infrastructure scan results
    Object.values(scans.infrastructure).forEach(iac => {
      if (iac.summary && !iac.error) {
        summary.infrastructureIssues += iac.summary.totalIssues || 0;
        summary.criticalIssues += iac.summary.severityBreakdown.critical || 0;
        summary.highSeverityIssues += iac.summary.severityBreakdown.high || 0;
      }
    });

    // Aggregate license issues
    Object.values(scans.licenses).forEach(license => {
      if (license.potentialIssues) {
        summary.licenseIssues += license.potentialIssues.length;
      }
    });

    // Determine overall risk
    if (summary.criticalIssues > 0) {
      summary.overallRisk = 'Critical';
    } else if (summary.highSeverityIssues > 5) {
      summary.overallRisk = 'High';
    } else if (summary.totalVulnerabilities > 10) {
      summary.overallRisk = 'Medium';
    }

    return summary;
  }

  generateRecommendations(scans) {
    const recommendations = [];

    // Dependency recommendations
    Object.entries(scans.dependencies).forEach(([projectName, project]) => {
      if (project.summary && project.summary.upgradableIssues > 0) {
        recommendations.push({
          type: 'dependency',
          priority: 'high',
          project: projectName,
          action: `Upgrade ${project.summary.upgradableIssues} vulnerable dependencies`,
          command: 'npm audit fix'
        });
      }
    });

    // Container recommendations
    Object.entries(scans.containers).forEach(([imageName, container]) => {
      if (container.summary && container.summary.totalVulnerabilities > 0) {
        recommendations.push({
          type: 'container',
          priority: container.summary.severityBreakdown.critical > 0 ? 'critical' : 'medium',
          image: imageName,
          action: 'Update base image and rebuild container',
          vulnerabilities: container.summary.totalVulnerabilities
        });
      }
    });

    // License recommendations
    Object.entries(scans.licenses).forEach(([projectName, license]) => {
      if (license.potentialIssues && license.potentialIssues.length > 0) {
        recommendations.push({
          type: 'license',
          priority: 'medium',
          project: projectName,
          action: 'Review and potentially replace packages with restrictive licenses',
          packages: license.potentialIssues.map(issue => issue.package)
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async generateReports(results) {
    console.log('Generating dependency security reports...');

    // Generate JSON report
    fs.writeFileSync(
      path.join(this.reportDir, 'dependency-security-report.json'),
      JSON.stringify(results, null, 2)
    );

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(results);
    fs.writeFileSync(
      path.join(this.reportDir, 'dependency-security-report.html'),
      htmlReport
    );

    // Generate CSV summary
    const csvReport = this.generateCSVReport(results);
    fs.writeFileSync(
      path.join(this.reportDir, 'vulnerability-summary.csv'),
      csvReport
    );

    console.log(`Dependency security reports saved to: ${this.reportDir}`);
  }

  generateHTMLReport(results) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>GlobalTaxCalc Dependency Security Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .critical { color: #d32f2f; font-weight: bold; }
        .high { color: #f57c00; font-weight: bold; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #2196f3; background: #f0f8ff; }
    </style>
</head>
<body>
    <h1>GlobalTaxCalc Dependency Security Report</h1>
    <p><strong>Generated:</strong> ${results.timestamp}</p>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p><strong>Overall Risk Level:</strong> <span class="${results.summary.overallRisk.toLowerCase()}">${results.summary.overallRisk}</span></p>
        <p><strong>Total Vulnerabilities:</strong> ${results.summary.totalVulnerabilities}</p>
        <p><strong>Critical Issues:</strong> <span class="critical">${results.summary.criticalIssues}</span></p>
        <p><strong>High Severity Issues:</strong> <span class="high">${results.summary.highSeverityIssues}</span></p>
        <p><strong>Upgradable Issues:</strong> ${results.summary.upgradableIssues}</p>
        <p><strong>Container Issues:</strong> ${results.summary.containerIssues}</p>
        <p><strong>Infrastructure Issues:</strong> ${results.summary.infrastructureIssues}</p>
        <p><strong>License Issues:</strong> ${results.summary.licenseIssues}</p>
    </div>

    <h2>Priority Recommendations</h2>
    ${results.recommendations.slice(0, 10).map(rec => `
        <div class="recommendation">
            <strong>Priority:</strong> <span class="${rec.priority}">${rec.priority.toUpperCase()}</span><br>
            <strong>Type:</strong> ${rec.type}<br>
            <strong>Action:</strong> ${rec.action}
            ${rec.command ? `<br><strong>Command:</strong> <code>${rec.command}</code>` : ''}
        </div>
    `).join('')}

    <h2>Dependency Scan Results</h2>
    <table>
        <tr><th>Project</th><th>Vulnerabilities</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th></tr>
        ${Object.entries(results.scans.dependencies).map(([project, data]) => {
          if (data.summary && !data.summary.error) {
            return `
              <tr>
                <td>${project}</td>
                <td>${data.summary.totalVulnerabilities}</td>
                <td class="critical">${data.summary.severityBreakdown.critical || 0}</td>
                <td class="high">${data.summary.severityBreakdown.high || 0}</td>
                <td class="medium">${data.summary.severityBreakdown.medium || 0}</td>
                <td class="low">${data.summary.severityBreakdown.low || 0}</td>
              </tr>
            `;
          }
          return `<tr><td>${project}</td><td colspan="5">Scan Error</td></tr>`;
        }).join('')}
    </table>

    <h2>Container Scan Results</h2>
    <table>
        <tr><th>Image</th><th>Vulnerabilities</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th></tr>
        ${Object.entries(results.scans.containers).map(([image, data]) => {
          if (data.summary && !data.summary.error) {
            return `
              <tr>
                <td>${image}</td>
                <td>${data.summary.totalVulnerabilities}</td>
                <td class="critical">${data.summary.severityBreakdown.critical || 0}</td>
                <td class="high">${data.summary.severityBreakdown.high || 0}</td>
                <td class="medium">${data.summary.severityBreakdown.medium || 0}</td>
                <td class="low">${data.summary.severityBreakdown.low || 0}</td>
              </tr>
            `;
          }
          return `<tr><td>${image}</td><td colspan="5">Scan Error</td></tr>`;
        }).join('')}
    </table>

    <h2>License Analysis</h2>
    ${Object.entries(results.scans.licenses).map(([project, data]) => {
      if (data.totalPackages) {
        return `
          <h3>${project}</h3>
          <p><strong>Total Packages:</strong> ${data.totalPackages}</p>
          <p><strong>Potential Issues:</strong> ${data.potentialIssues ? data.potentialIssues.length : 0}</p>
          <p><strong>Unknown Licenses:</strong> ${data.unknownLicenses ? data.unknownLicenses.length : 0}</p>
        `;
      }
      return `<h3>${project}</h3><p>Scan Error</p>`;
    }).join('')}
</body>
</html>
    `;
  }

  generateCSVReport(results) {
    const csvRows = [
      'Type,Project/Image,Vulnerability Count,Critical,High,Medium,Low'
    ];

    // Add dependency results
    Object.entries(results.scans.dependencies).forEach(([project, data]) => {
      if (data.summary && !data.summary.error) {
        csvRows.push([
          'Dependency',
          project,
          data.summary.totalVulnerabilities,
          data.summary.severityBreakdown.critical || 0,
          data.summary.severityBreakdown.high || 0,
          data.summary.severityBreakdown.medium || 0,
          data.summary.severityBreakdown.low || 0
        ].join(','));
      }
    });

    // Add container results
    Object.entries(results.scans.containers).forEach(([image, data]) => {
      if (data.summary && !data.summary.error) {
        csvRows.push([
          'Container',
          image,
          data.summary.totalVulnerabilities,
          data.summary.severityBreakdown.critical || 0,
          data.summary.severityBreakdown.high || 0,
          data.summary.severityBreakdown.medium || 0,
          data.summary.severityBreakdown.low || 0
        ].join(','));
      }
    });

    return csvRows.join('\n');
  }
}

// CLI execution
if (require.main === module) {
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();
  const scanner = new DependencyScanner({ projectRoot });

  scanner.runComprehensiveScan()
    .then((results) => {
      console.log('\n=== Dependency Security Scan Complete ===');
      console.log(`Overall Risk Level: ${results.summary.overallRisk}`);
      console.log(`Total Vulnerabilities: ${results.summary.totalVulnerabilities}`);
      console.log(`Critical Issues: ${results.summary.criticalIssues}`);
      console.log(`High Severity Issues: ${results.summary.highSeverityIssues}`);
      console.log('Detailed reports generated in security/reports/dependency-scan directory');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Dependency security scan failed:', error);
      process.exit(1);
    });
}

module.exports = DependencyScanner;