/**
 * Automated Code Review System
 * Provides automated code analysis and review feedback
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutomatedCodeReviewer {
  constructor(options = {}) {
    this.config = {
      projectRoot: options.projectRoot || process.cwd(),
      outputDir: options.outputDir || './tests/reports/code-review',
      rules: {
        complexity: options.complexityThreshold || 10,
        fileSize: options.fileSizeLimit || 500, // lines
        functionSize: options.functionSizeLimit || 50, // lines
        duplicateThreshold: options.duplicateThreshold || 0.1, // 10%
        testCoverage: options.testCoverageThreshold || 80,
        commentRatio: options.commentRatioThreshold || 0.1 // 10%
      },
      excludePatterns: options.excludePatterns || [
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.min.js'
      ],
      fileExtensions: options.fileExtensions || ['.js', '.jsx', '.ts', '.tsx', '.vue']
    };

    this.analysis = {
      timestamp: new Date().toISOString(),
      summary: {
        filesAnalyzed: 0,
        totalIssues: 0,
        criticalIssues: 0,
        warningIssues: 0,
        infoIssues: 0
      },
      categories: {
        complexity: [],
        maintainability: [],
        performance: [],
        security: [],
        testability: [],
        documentation: []
      },
      recommendations: [],
      metrics: {
        codeQuality: 0,
        maintainabilityIndex: 0,
        technicalDebt: 0
      }
    };

    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  async runCodeReview() {
    console.log('🔍 Starting automated code review...');

    try {
      // Discover files to analyze
      const filesToAnalyze = await this.discoverFiles();
      console.log(`📂 Found ${filesToAnalyze.length} files to analyze`);

      // Run various analysis tools
      await this.runStaticAnalysis();
      await this.runComplexityAnalysis();
      await this.runSecurityAnalysis();
      await this.runDuplicationAnalysis();
      await this.analyzeTestCoverage();
      await this.analyzeDocumentation();

      // Analyze individual files
      for (const file of filesToAnalyze) {
        await this.analyzeFile(file);
      }

      // Generate overall metrics
      this.calculateMetrics();

      // Generate recommendations
      this.generateRecommendations();

      // Create reports
      await this.generateReports();

      console.log('✅ Code review completed successfully');
      this.printSummary();

      return this.analysis;

    } catch (error) {
      console.error('❌ Code review failed:', error.message);
      throw error;
    }
  }

  async discoverFiles() {
    const files = [];

    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip excluded directories
          const relativePath = path.relative(this.config.projectRoot, fullPath);
          const shouldExclude = this.config.excludePatterns.some(pattern =>
            relativePath.includes(pattern.replace('/**', ''))
          );

          if (!shouldExclude) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (this.config.fileExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      });
    };

    walkDir(this.config.projectRoot);
    return files;
  }

  async runStaticAnalysis() {
    console.log('  📊 Running static analysis...');

    try {
      // Run ESLint for JavaScript/TypeScript files
      const eslintResult = execSync('npx eslint . --format=json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      const eslintData = JSON.parse(eslintResult);
      this.processESLintResults(eslintData);

    } catch (error) {
      console.warn('  ⚠️ ESLint analysis failed:', error.message);
    }

    try {
      // Run TypeScript compiler for type checking
      execSync('npx tsc --noEmit', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });
      console.log('  ✅ TypeScript type checking passed');
    } catch (error) {
      this.addIssue('maintainability', {
        severity: 'warning',
        message: 'TypeScript compilation errors detected',
        details: error.message,
        recommendation: 'Fix TypeScript compilation errors'
      });
    }
  }

  processESLintResults(eslintData) {
    eslintData.forEach(file => {
      file.messages.forEach(message => {
        let category = 'maintainability';

        // Categorize ESLint rules
        if (message.ruleId) {
          if (message.ruleId.includes('security') ||
              message.ruleId.includes('no-eval') ||
              message.ruleId.includes('no-unsafe')) {
            category = 'security';
          } else if (message.ruleId.includes('complexity') ||
                     message.ruleId.includes('max-lines') ||
                     message.ruleId.includes('max-params')) {
            category = 'complexity';
          } else if (message.ruleId.includes('performance') ||
                     message.ruleId.includes('no-loop-func')) {
            category = 'performance';
          }
        }

        this.addIssue(category, {
          file: file.filePath,
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          message: message.message,
          ruleId: message.ruleId,
          recommendation: this.getESLintRecommendation(message.ruleId)
        });
      });
    });
  }

  getESLintRecommendation(ruleId) {
    const recommendations = {
      'complexity': 'Break down complex functions into smaller, more manageable pieces',
      'max-lines': 'Split large files into smaller modules',
      'max-params': 'Reduce function parameters or use object destructuring',
      'no-console': 'Use proper logging framework instead of console statements',
      'no-debugger': 'Remove debugger statements before committing',
      'no-unused-vars': 'Remove unused variables to keep code clean',
      'prefer-const': 'Use const for variables that are never reassigned'
    };

    for (const [key, recommendation] of Object.entries(recommendations)) {
      if (ruleId && ruleId.includes(key)) {
        return recommendation;
      }
    }

    return 'Follow ESLint rule guidelines for better code quality';
  }

  async runComplexityAnalysis() {
    console.log('  🧮 Running complexity analysis...');

    try {
      // Use complexity-report or similar tool
      const complexityResult = execSync('npx complexity-report --format=json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      const complexityData = JSON.parse(complexityResult);
      this.processComplexityResults(complexityData);

    } catch (error) {
      console.warn('  ⚠️ Complexity analysis not available');
      // Fallback to simple analysis
      this.performSimpleComplexityAnalysis();
    }
  }

  processComplexityResults(complexityData) {
    if (complexityData.functions) {
      complexityData.functions.forEach(func => {
        if (func.complexity > this.config.rules.complexity) {
          this.addIssue('complexity', {
            file: func.file,
            line: func.line,
            severity: func.complexity > this.config.rules.complexity * 2 ? 'error' : 'warning',
            message: `High cyclomatic complexity: ${func.complexity}`,
            functionName: func.name,
            complexity: func.complexity,
            recommendation: 'Refactor function to reduce complexity'
          });
        }
      });
    }
  }

  performSimpleComplexityAnalysis() {
    // Simple regex-based complexity analysis
    const files = this.discoverFiles();

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      // Count control flow statements as complexity indicators
      const complexityPatterns = [
        /\bif\s*\(/g,
        /\belse\s+if\b/g,
        /\bwhile\s*\(/g,
        /\bfor\s*\(/g,
        /\bswitch\s*\(/g,
        /\bcatch\s*\(/g,
        /\?\s*.*\s*:/g, // ternary operator
        /&&|\|\|/g      // logical operators
      ];

      let totalComplexity = 0;
      content.replace(/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g, (match, offset) => {
        const functionStart = content.substring(0, offset).split('\n').length;
        const functionContent = this.extractFunctionContent(content, offset);

        let functionComplexity = 1; // Base complexity
        complexityPatterns.forEach(pattern => {
          const matches = functionContent.match(pattern);
          if (matches) {
            functionComplexity += matches.length;
          }
        });

        totalComplexity += functionComplexity;

        if (functionComplexity > this.config.rules.complexity) {
          this.addIssue('complexity', {
            file: file,
            line: functionStart,
            severity: functionComplexity > this.config.rules.complexity * 2 ? 'error' : 'warning',
            message: `Estimated high complexity: ${functionComplexity}`,
            complexity: functionComplexity,
            recommendation: 'Consider breaking down this function'
          });
        }

        return match;
      });
    });
  }

  extractFunctionContent(content, offset) {
    // Simple extraction - find matching braces
    let braceCount = 0;
    let inFunction = false;
    let functionContent = '';

    for (let i = offset; i < content.length; i++) {
      const char = content[i];

      if (char === '{') {
        inFunction = true;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }

      if (inFunction) {
        functionContent += char;

        if (braceCount === 0) {
          break;
        }
      }
    }

    return functionContent;
  }

  async runSecurityAnalysis() {
    console.log('  🔒 Running security analysis...');

    // Simple security pattern detection
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        severity: 'error',
        message: 'Use of eval() is dangerous and should be avoided',
        recommendation: 'Replace eval() with safer alternatives'
      },
      {
        pattern: /innerHTML\s*=/g,
        severity: 'warning',
        message: 'Use of innerHTML may lead to XSS vulnerabilities',
        recommendation: 'Use textContent or sanitize HTML content'
      },
      {
        pattern: /document\.write\s*\(/g,
        severity: 'warning',
        message: 'document.write can be dangerous in certain contexts',
        recommendation: 'Use safer DOM manipulation methods'
      },
      {
        pattern: /window\.location\s*=/g,
        severity: 'warning',
        message: 'Direct window.location assignment may be unsafe',
        recommendation: 'Validate URLs before navigation'
      },
      {
        pattern: /(password|secret|key)\s*[:=]\s*['"]/gi,
        severity: 'error',
        message: 'Potential hardcoded credentials detected',
        recommendation: 'Move credentials to environment variables'
      }
    ];

    const files = await this.discoverFiles();

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      securityPatterns.forEach(({ pattern, severity, message, recommendation }) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;

          this.addIssue('security', {
            file: file,
            line: lineNumber,
            column: match.index - content.lastIndexOf('\n', match.index),
            severity: severity,
            message: message,
            code: lines[lineNumber - 1]?.trim(),
            recommendation: recommendation
          });
        }
      });
    });
  }

  async runDuplicationAnalysis() {
    console.log('  🔄 Running duplication analysis...');

    try {
      // Use jscpd for duplication detection
      const jscpdResult = execSync('npx jscpd --format=json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      const duplicationData = JSON.parse(jscpdResult);
      this.processDuplicationResults(duplicationData);

    } catch (error) {
      console.warn('  ⚠️ Duplication analysis not available');
    }
  }

  processDuplicationResults(duplicationData) {
    if (duplicationData.duplicates) {
      duplicationData.duplicates.forEach(duplicate => {
        this.addIssue('maintainability', {
          severity: 'warning',
          message: `Code duplication detected (${duplicate.lines} lines)`,
          files: duplicate.files,
          lines: duplicate.lines,
          recommendation: 'Extract duplicated code into reusable functions or modules'
        });
      });
    }
  }

  async analyzeTestCoverage() {
    console.log('  🧪 Analyzing test coverage...');

    try {
      const coveragePath = path.join(this.config.projectRoot, 'coverage/coverage-summary.json');

      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

        Object.entries(coverageData).forEach(([file, coverage]) => {
          if (file !== 'total' && coverage.lines) {
            const lineCoverage = coverage.lines.pct;

            if (lineCoverage < this.config.rules.testCoverage) {
              this.addIssue('testability', {
                file: file,
                severity: lineCoverage < this.config.rules.testCoverage / 2 ? 'error' : 'warning',
                message: `Low test coverage: ${lineCoverage}%`,
                coverage: lineCoverage,
                recommendation: 'Add more unit tests to improve coverage'
              });
            }
          }
        });
      }
    } catch (error) {
      console.warn('  ⚠️ Coverage analysis failed:', error.message);
    }
  }

  async analyzeDocumentation() {
    console.log('  📝 Analyzing documentation...');

    const files = await this.discoverFiles();

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      // Count comments
      const commentLines = lines.filter(line =>
        line.trim().startsWith('//') ||
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*')
      ).length;

      const codeLines = lines.filter(line =>
        line.trim() &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('/*') &&
        !line.trim().startsWith('*')
      ).length;

      const commentRatio = codeLines > 0 ? commentLines / codeLines : 0;

      if (commentRatio < this.config.rules.commentRatio && codeLines > 20) {
        this.addIssue('documentation', {
          file: file,
          severity: 'info',
          message: `Low comment ratio: ${(commentRatio * 100).toFixed(1)}%`,
          commentRatio: commentRatio,
          recommendation: 'Add more comments to explain complex logic'
        });
      }

      // Check for function documentation
      const functionRegex = /function\s+(\w+)|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g;
      let match;

      while ((match = functionRegex.exec(content)) !== null) {
        const functionName = match[1] || match[2];
        const lineNumber = content.substring(0, match.index).split('\n').length;

        // Check if function has JSDoc comment above it
        const lineAbove = lines[lineNumber - 2];
        const hasJSDoc = lineAbove && lineAbove.trim().includes('/**');

        if (!hasJSDoc && functionName && !functionName.startsWith('_')) {
          this.addIssue('documentation', {
            file: file,
            line: lineNumber,
            severity: 'info',
            message: `Function '${functionName}' lacks documentation`,
            functionName: functionName,
            recommendation: 'Add JSDoc comments to document function purpose and parameters'
          });
        }
      }
    });
  }

  async analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // File size analysis
    if (lines.length > this.config.rules.fileSize) {
      this.addIssue('maintainability', {
        file: filePath,
        severity: lines.length > this.config.rules.fileSize * 2 ? 'error' : 'warning',
        message: `Large file: ${lines.length} lines`,
        lineCount: lines.length,
        recommendation: 'Consider breaking this file into smaller modules'
      });
    }

    // Function size analysis
    this.analyzeFunctionSizes(filePath, content, lines);

    this.analysis.summary.filesAnalyzed++;
  }

  analyzeFunctionSizes(filePath, content, lines) {
    const functionRegex = /function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionStart = content.substring(0, match.index).split('\n').length;
      const functionContent = this.extractFunctionContent(content, match.index);
      const functionLines = functionContent.split('\n').length;

      if (functionLines > this.config.rules.functionSize) {
        this.addIssue('complexity', {
          file: filePath,
          line: functionStart,
          severity: functionLines > this.config.rules.functionSize * 2 ? 'error' : 'warning',
          message: `Large function: ${functionLines} lines`,
          functionLines: functionLines,
          recommendation: 'Break down large functions into smaller, focused functions'
        });
      }
    }
  }

  addIssue(category, issue) {
    this.analysis.categories[category].push(issue);
    this.analysis.summary.totalIssues++;

    switch (issue.severity) {
      case 'error':
        this.analysis.summary.criticalIssues++;
        break;
      case 'warning':
        this.analysis.summary.warningIssues++;
        break;
      case 'info':
        this.analysis.summary.infoIssues++;
        break;
    }
  }

  calculateMetrics() {
    console.log('  📊 Calculating quality metrics...');

    const totalIssues = this.analysis.summary.totalIssues;
    const filesAnalyzed = this.analysis.summary.filesAnalyzed;

    // Code Quality Score (0-100)
    const baseScore = 100;
    const criticalPenalty = this.analysis.summary.criticalIssues * 10;
    const warningPenalty = this.analysis.summary.warningIssues * 3;
    const infoPenalty = this.analysis.summary.infoIssues * 1;

    this.analysis.metrics.codeQuality = Math.max(0, baseScore - criticalPenalty - warningPenalty - infoPenalty);

    // Maintainability Index (0-100)
    const issuesPerFile = filesAnalyzed > 0 ? totalIssues / filesAnalyzed : 0;
    this.analysis.metrics.maintainabilityIndex = Math.max(0, 100 - (issuesPerFile * 10));

    // Technical Debt (hours)
    const criticalDebt = this.analysis.summary.criticalIssues * 4; // 4 hours per critical issue
    const warningDebt = this.analysis.summary.warningIssues * 1;   // 1 hour per warning
    const infoDebt = this.analysis.summary.infoIssues * 0.25;      // 15 minutes per info issue

    this.analysis.metrics.technicalDebt = criticalDebt + warningDebt + infoDebt;
  }

  generateRecommendations() {
    console.log('  💡 Generating recommendations...');

    const recommendations = [];

    // Critical issues first
    this.analysis.categories.security
      .filter(issue => issue.severity === 'error')
      .forEach(issue => {
        recommendations.push({
          priority: 'CRITICAL',
          category: 'Security',
          title: 'Fix critical security vulnerability',
          description: issue.message,
          file: issue.file,
          action: issue.recommendation
        });
      });

    // High complexity issues
    const complexityIssues = this.analysis.categories.complexity
      .filter(issue => issue.severity === 'error')
      .length;

    if (complexityIssues > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Complexity',
        title: 'Reduce code complexity',
        description: `${complexityIssues} functions have high complexity`,
        action: 'Refactor complex functions into smaller, more manageable pieces'
      });
    }

    // Test coverage
    const coverageIssues = this.analysis.categories.testability.length;
    if (coverageIssues > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Testing',
        title: 'Improve test coverage',
        description: `${coverageIssues} files have low test coverage`,
        action: 'Add unit tests for uncovered code paths'
      });
    }

    // Documentation
    const docIssues = this.analysis.categories.documentation.length;
    if (docIssues > 5) {
      recommendations.push({
        priority: 'LOW',
        category: 'Documentation',
        title: 'Improve code documentation',
        description: `${docIssues} functions lack proper documentation`,
        action: 'Add JSDoc comments to explain function purpose and usage'
      });
    }

    this.analysis.recommendations = recommendations.slice(0, 10); // Top 10 recommendations
  }

  async generateReports() {
    console.log('  📄 Generating reports...');

    // JSON report
    const jsonReport = path.join(this.config.outputDir, 'code-review-report.json');
    fs.writeFileSync(jsonReport, JSON.stringify(this.analysis, null, 2));

    // HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlPath = path.join(this.config.outputDir, 'code-review-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    // Markdown summary
    const markdownSummary = this.generateMarkdownSummary();
    const mdPath = path.join(this.config.outputDir, 'code-review-summary.md');
    fs.writeFileSync(mdPath, markdownSummary);

    console.log(`📁 Reports saved to ${this.config.outputDir}`);
  }

  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Automated Code Review Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .critical { color: #d32f2f; }
        .warning { color: #f57c00; }
        .info { color: #1976d2; }
        .category { margin: 20px 0; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; background: #f9f9f9; }
        .issue.critical { border-left-color: #d32f2f; }
        .issue.warning { border-left-color: #f57c00; }
        .issue.info { border-left-color: #1976d2; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Automated Code Review Report</h1>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Generated:</strong> ${this.analysis.timestamp}</p>
        <p><strong>Files Analyzed:</strong> ${this.analysis.summary.filesAnalyzed}</p>
        <p><strong>Total Issues:</strong> ${this.analysis.summary.totalIssues}</p>
        <p><strong>Critical Issues:</strong> <span class="critical">${this.analysis.summary.criticalIssues}</span></p>
        <p><strong>Warning Issues:</strong> <span class="warning">${this.analysis.summary.warningIssues}</span></p>
        <p><strong>Info Issues:</strong> <span class="info">${this.analysis.summary.infoIssues}</span></p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Code Quality Score</h3>
            <p style="font-size: 2em; color: ${this.analysis.metrics.codeQuality > 80 ? '#4caf50' : this.analysis.metrics.codeQuality > 60 ? '#ff9800' : '#f44336'}">${this.analysis.metrics.codeQuality.toFixed(1)}/100</p>
        </div>
        <div class="metric">
            <h3>Maintainability Index</h3>
            <p style="font-size: 2em; color: ${this.analysis.metrics.maintainabilityIndex > 80 ? '#4caf50' : this.analysis.metrics.maintainabilityIndex > 60 ? '#ff9800' : '#f44336'}">${this.analysis.metrics.maintainabilityIndex.toFixed(1)}/100</p>
        </div>
        <div class="metric">
            <h3>Technical Debt</h3>
            <p style="font-size: 2em; color: ${this.analysis.metrics.technicalDebt < 10 ? '#4caf50' : this.analysis.metrics.technicalDebt < 50 ? '#ff9800' : '#f44336'}">${this.analysis.metrics.technicalDebt.toFixed(1)}h</p>
        </div>
    </div>

    <h2>Recommendations</h2>
    <table>
        <tr><th>Priority</th><th>Category</th><th>Title</th><th>Action</th></tr>
        ${this.analysis.recommendations.map(rec => `
            <tr>
                <td class="${rec.priority.toLowerCase()}">${rec.priority}</td>
                <td>${rec.category}</td>
                <td>${rec.title}</td>
                <td>${rec.action}</td>
            </tr>
        `).join('')}
    </table>

    ${Object.entries(this.analysis.categories).map(([category, issues]) => `
        <div class="category">
            <h2>${category.charAt(0).toUpperCase() + category.slice(1)} Issues (${issues.length})</h2>
            ${issues.slice(0, 10).map(issue => `
                <div class="issue ${issue.severity}">
                    <h4>${issue.message}</h4>
                    ${issue.file ? `<p><strong>File:</strong> ${issue.file}${issue.line ? `:${issue.line}` : ''}</p>` : ''}
                    ${issue.recommendation ? `<p><strong>Recommendation:</strong> ${issue.recommendation}</p>` : ''}
                </div>
            `).join('')}
            ${issues.length > 10 ? `<p><em>... and ${issues.length - 10} more issues</em></p>` : ''}
        </div>
    `).join('')}
</body>
</html>
    `;
  }

  generateMarkdownSummary() {
    return `# Code Review Summary

**Generated:** ${this.analysis.timestamp}

## Overview

- **Files Analyzed:** ${this.analysis.summary.filesAnalyzed}
- **Total Issues:** ${this.analysis.summary.totalIssues}
- **Critical Issues:** ${this.analysis.summary.criticalIssues}
- **Warning Issues:** ${this.analysis.summary.warningIssues}
- **Info Issues:** ${this.analysis.summary.infoIssues}

## Quality Metrics

- **Code Quality Score:** ${this.analysis.metrics.codeQuality.toFixed(1)}/100
- **Maintainability Index:** ${this.analysis.metrics.maintainabilityIndex.toFixed(1)}/100
- **Technical Debt:** ${this.analysis.metrics.technicalDebt.toFixed(1)} hours

## Top Recommendations

${this.analysis.recommendations.slice(0, 5).map(rec =>
  `### ${rec.priority}: ${rec.title}\n- **Category:** ${rec.category}\n- **Action:** ${rec.action}\n`
).join('\n')}

## Issues by Category

${Object.entries(this.analysis.categories).map(([category, issues]) =>
  `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${issues.length} issues)\n- Critical: ${issues.filter(i => i.severity === 'error').length}\n- Warning: ${issues.filter(i => i.severity === 'warning').length}\n- Info: ${issues.filter(i => i.severity === 'info').length}`
).join('\n\n')}
`;
  }

  printSummary() {
    console.log('\n📊 Code Review Summary');
    console.log('=' .repeat(50));
    console.log(`Files Analyzed: ${this.analysis.summary.filesAnalyzed}`);
    console.log(`Total Issues: ${this.analysis.summary.totalIssues}`);
    console.log(`Critical: ${this.analysis.summary.criticalIssues}`);
    console.log(`Warnings: ${this.analysis.summary.warningIssues}`);
    console.log(`Info: ${this.analysis.summary.infoIssues}`);
    console.log('');
    console.log(`Code Quality Score: ${this.analysis.metrics.codeQuality.toFixed(1)}/100`);
    console.log(`Maintainability Index: ${this.analysis.metrics.maintainabilityIndex.toFixed(1)}/100`);
    console.log(`Technical Debt: ${this.analysis.metrics.technicalDebt.toFixed(1)} hours`);

    if (this.analysis.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      this.analysis.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority}] ${rec.title}`);
      });
    }

    console.log('=' .repeat(50));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    projectRoot: process.env.PROJECT_ROOT || process.cwd(),
    outputDir: process.env.OUTPUT_DIR || './tests/reports/code-review',
    complexityThreshold: parseInt(process.env.COMPLEXITY_THRESHOLD) || 10,
    testCoverageThreshold: parseInt(process.env.COVERAGE_THRESHOLD) || 80
  };

  const reviewer = new AutomatedCodeReviewer(config);

  reviewer.runCodeReview()
    .then((analysis) => {
      const exitCode = analysis.summary.criticalIssues > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('Code review failed:', error);
      process.exit(1);
    });
}

module.exports = AutomatedCodeReviewer;