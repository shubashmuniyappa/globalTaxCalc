/**
 * GlobalTaxCalc Testing Dashboard JavaScript
 * Handles data loading, visualization, and real-time updates
 */

class TestingDashboard {
    constructor() {
        this.charts = {};
        this.refreshInterval = 30000; // 30 seconds
        this.apiEndpoint = '/api/testing-dashboard';
        this.lastUpdate = null;

        this.init();
    }

    async init() {
        console.log('Initializing Testing Dashboard...');

        // Load initial data
        await this.loadDashboardData();

        // Initialize charts
        this.initializeCharts();

        // Set up auto-refresh
        this.setupAutoRefresh();

        // Set up event listeners
        this.setupEventListeners();

        console.log('Dashboard initialized successfully');
    }

    async loadDashboardData() {
        try {
            this.showLoading(true);

            // In a real implementation, this would fetch from an API
            // For demo purposes, we'll use mock data
            const data = await this.fetchMockData();

            this.updateStatistics(data.statistics);
            this.updateTestSuites(data.testSuites);
            this.updateQualityGates(data.qualityGates);
            this.updateSecurityData(data.security);
            this.updatePerformanceData(data.performance);
            this.updateReports(data.reports);

            this.lastUpdate = new Date();
            this.showLoading(false);

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data. Please try again.');
            this.showLoading(false);
        }
    }

    async fetchMockData() {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock data that would typically come from the backend
        return {
            statistics: {
                overallHealth: 98,
                testCoverage: 87,
                performanceScore: 94,
                securityIssues: 2,
                codeQuality: 8.7,
                technicalDebt: 12
            },
            testSuites: [
                {
                    name: 'Unit Tests',
                    status: 'passed',
                    passed: 245,
                    failed: 0,
                    total: 245,
                    duration: 45,
                    coverage: 89,
                    lastRun: new Date(Date.now() - 3600000)
                },
                {
                    name: 'Integration Tests',
                    status: 'passed',
                    passed: 78,
                    failed: 0,
                    total: 78,
                    duration: 180,
                    coverage: 82,
                    lastRun: new Date(Date.now() - 1800000)
                },
                {
                    name: 'E2E Tests',
                    status: 'warning',
                    passed: 34,
                    failed: 1,
                    total: 35,
                    duration: 420,
                    coverage: 75,
                    lastRun: new Date(Date.now() - 900000)
                },
                {
                    name: 'Performance Tests',
                    status: 'passed',
                    passed: 12,
                    failed: 0,
                    total: 12,
                    duration: 300,
                    coverage: 85,
                    lastRun: new Date(Date.now() - 7200000)
                },
                {
                    name: 'Security Tests',
                    status: 'failed',
                    passed: 8,
                    failed: 2,
                    total: 10,
                    duration: 600,
                    coverage: 70,
                    lastRun: new Date(Date.now() - 1800000)
                }
            ],
            qualityGates: [
                {
                    name: 'Code Coverage',
                    status: 'passed',
                    value: '87%',
                    threshold: '80%',
                    lastUpdated: new Date()
                },
                {
                    name: 'Test Results',
                    status: 'warning',
                    value: '1 failed',
                    threshold: '0 failed',
                    lastUpdated: new Date()
                },
                {
                    name: 'Performance',
                    status: 'passed',
                    value: '1.2s',
                    threshold: '< 2s',
                    lastUpdated: new Date()
                },
                {
                    name: 'Security',
                    status: 'failed',
                    value: '2 issues',
                    threshold: '0 issues',
                    lastUpdated: new Date()
                },
                {
                    name: 'Code Quality',
                    status: 'passed',
                    value: '8.7/10',
                    threshold: '> 8.0',
                    lastUpdated: new Date()
                }
            ],
            security: {
                totalVulnerabilities: 2,
                criticalIssues: 0,
                highIssues: 1,
                mediumIssues: 1,
                lowIssues: 0,
                lastScan: new Date(Date.now() - 3600000),
                vulnerabilities: [
                    {
                        severity: 'high',
                        title: 'Cross-Site Scripting (XSS)',
                        description: 'Potential XSS vulnerability in user input handling',
                        file: 'src/components/UserInput.jsx',
                        line: 45
                    },
                    {
                        severity: 'medium',
                        title: 'Missing CSRF Protection',
                        description: 'API endpoint lacks CSRF protection',
                        file: 'src/api/routes/user.js',
                        line: 23
                    }
                ]
            },
            performance: {
                averageResponseTime: 1200,
                p95ResponseTime: 2100,
                throughput: 150,
                errorRate: 0.02,
                lighthouseScore: 94,
                metrics: [
                    { name: 'First Contentful Paint', value: '1.2s', status: 'good' },
                    { name: 'Largest Contentful Paint', value: '2.1s', status: 'good' },
                    { name: 'Cumulative Layout Shift', value: '0.05', status: 'good' },
                    { name: 'Total Blocking Time', value: '150ms', status: 'good' }
                ]
            },
            reports: [
                {
                    name: 'Test Automation Report',
                    type: 'html',
                    size: '2.3 MB',
                    generated: new Date(Date.now() - 3600000),
                    url: '/reports/test-automation-report.html'
                },
                {
                    name: 'Security Scan Report',
                    type: 'pdf',
                    size: '1.8 MB',
                    generated: new Date(Date.now() - 7200000),
                    url: '/reports/security-report.pdf'
                },
                {
                    name: 'Performance Report',
                    type: 'html',
                    size: '1.2 MB',
                    generated: new Date(Date.now() - 1800000),
                    url: '/reports/performance-report.html'
                },
                {
                    name: 'Code Quality Report',
                    type: 'html',
                    size: '3.1 MB',
                    generated: new Date(Date.now() - 3600000),
                    url: '/reports/code-quality-report.html'
                }
            ]
        };
    }

    updateStatistics(stats) {
        document.getElementById('overall-health').textContent = `${stats.overallHealth}%`;
        document.getElementById('test-coverage').textContent = `${stats.testCoverage}%`;
        document.getElementById('performance-score').textContent = stats.performanceScore;
        document.getElementById('security-issues').textContent = stats.securityIssues;
        document.getElementById('code-quality').textContent = stats.codeQuality;
        document.getElementById('tech-debt').textContent = `${stats.technicalDebt}h`;
    }

    updateTestSuites(testSuites) {
        const container = document.getElementById('test-suites-grid');
        container.innerHTML = '';

        testSuites.forEach(suite => {
            const suiteCard = this.createTestSuiteCard(suite);
            container.appendChild(suiteCard);
        });
    }

    createTestSuiteCard(suite) {
        const passRate = suite.total > 0 ? (suite.passed / suite.total) * 100 : 0;

        const card = document.createElement('div');
        card.className = 'test-suite-card';

        card.innerHTML = `
            <div class="suite-header">
                <span class="suite-name">${suite.name}</span>
                <span class="suite-status status-${suite.status}">${suite.status.toUpperCase()}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${passRate}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 0.5rem 0;">
                <span>Passed: ${suite.passed}</span>
                <span>Failed: ${suite.failed}</span>
                <span>Total: ${suite.total}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #666;">
                <span>Duration: ${this.formatDuration(suite.duration)}</span>
                <span>Coverage: ${suite.coverage}%</span>
            </div>
            <div style="font-size: 0.8rem; color: #999; margin-top: 0.5rem;">
                Last run: ${this.formatRelativeTime(suite.lastRun)}
            </div>
        `;

        return card;
    }

    updateQualityGates(gates) {
        const tbody = document.querySelector('#quality-gates-table tbody');
        tbody.innerHTML = '';

        gates.forEach(gate => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${gate.name}</td>
                <td><span class="badge badge-${gate.status === 'passed' ? 'success' : gate.status === 'failed' ? 'danger' : 'warning'}">${gate.status.toUpperCase()}</span></td>
                <td>${gate.value}</td>
                <td>${gate.threshold}</td>
                <td>${this.formatRelativeTime(gate.lastUpdated)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateSecurityData(security) {
        const container = document.getElementById('security-content');

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card" style="--accent-color: #dc3545;">
                    <div class="stat-value">${security.totalVulnerabilities}</div>
                    <div class="stat-label">Total Issues</div>
                </div>
                <div class="stat-card" style="--accent-color: #6f42c1;">
                    <div class="stat-value">${security.criticalIssues}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="stat-card" style="--accent-color: #fd7e14;">
                    <div class="stat-value">${security.highIssues}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat-card" style="--accent-color: #ffc107;">
                    <div class="stat-value">${security.mediumIssues}</div>
                    <div class="stat-label">Medium</div>
                </div>
            </div>

            <h4>Recent Vulnerabilities</h4>
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Title</th>
                        <th>Location</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${security.vulnerabilities.map(vuln => `
                        <tr>
                            <td><span class="badge badge-${vuln.severity === 'high' ? 'danger' : 'warning'}">${vuln.severity.toUpperCase()}</span></td>
                            <td>${vuln.title}</td>
                            <td>${vuln.file}:${vuln.line}</td>
                            <td><button class="btn btn-sm btn-primary" onclick="viewVulnerability('${vuln.title}')">View Details</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <p style="margin-top: 1rem; color: #666; font-size: 0.9rem;">
                Last scan: ${this.formatRelativeTime(security.lastScan)}
            </p>
        `;
    }

    updatePerformanceData(performance) {
        const container = document.getElementById('performance-content');

        container.innerHTML = `
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card" style="--accent-color: #28a745;">
                    <div class="stat-value">${performance.averageResponseTime}ms</div>
                    <div class="stat-label">Avg Response Time</div>
                </div>
                <div class="stat-card" style="--accent-color: #17a2b8;">
                    <div class="stat-value">${performance.p95ResponseTime}ms</div>
                    <div class="stat-label">95th Percentile</div>
                </div>
                <div class="stat-card" style="--accent-color: #6f42c1;">
                    <div class="stat-value">${performance.throughput}</div>
                    <div class="stat-label">Requests/sec</div>
                </div>
                <div class="stat-card" style="--accent-color: #fd7e14;">
                    <div class="stat-value">${(performance.errorRate * 100).toFixed(2)}%</div>
                    <div class="stat-label">Error Rate</div>
                </div>
            </div>

            <h4>Web Vitals</h4>
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${performance.metrics.map(metric => `
                        <tr>
                            <td>${metric.name}</td>
                            <td>${metric.value}</td>
                            <td><span class="badge badge-success">${metric.status.toUpperCase()}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    updateReports(reports) {
        const container = document.getElementById('reports-content');

        container.innerHTML = `
            <div class="test-suite-grid">
                ${reports.map(report => `
                    <div class="test-suite-card">
                        <div class="suite-header">
                            <span class="suite-name">${report.name}</span>
                            <span class="suite-status status-passed">${report.type.toUpperCase()}</span>
                        </div>
                        <div style="margin: 0.5rem 0; font-size: 0.9rem; color: #666;">
                            Size: ${report.size}
                        </div>
                        <div style="font-size: 0.8rem; color: #999; margin-bottom: 1rem;">
                            Generated: ${this.formatRelativeTime(report.generated)}
                        </div>
                        <button onclick="downloadReport('${report.url}')" style="width: 100%; padding: 0.5rem; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Download Report
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    initializeCharts() {
        this.initTestTrendChart();
        this.initCoverageChart();
        this.initPerformanceChart();
        this.initIssuesChart();
    }

    initTestTrendChart() {
        const ctx = document.getElementById('test-trend-chart').getContext('2d');

        this.charts.testTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                    {
                        label: 'Passed Tests',
                        data: [340, 345, 350, 355, 360, 365, 369],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Failed Tests',
                        data: [5, 3, 2, 4, 1, 2, 1],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initCoverageChart() {
        const ctx = document.getElementById('coverage-chart').getContext('2d');

        this.charts.coverage = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Frontend', 'Backend', 'API Gateway', 'Auth Service', 'Utilities'],
                datasets: [{
                    data: [89, 92, 85, 88, 95],
                    backgroundColor: [
                        '#667eea',
                        '#764ba2',
                        '#f093fb',
                        '#f5576c',
                        '#4facfe'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    initPerformanceChart() {
        const ctx = document.getElementById('performance-chart').getContext('2d');

        this.charts.performance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Response Time', 'Throughput', 'Error Rate', 'CPU Usage', 'Memory Usage'],
                datasets: [{
                    label: 'Performance Metrics',
                    data: [85, 92, 98, 78, 82],
                    backgroundColor: [
                        '#28a745',
                        '#17a2b8',
                        '#ffc107',
                        '#fd7e14',
                        '#6f42c1'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    initIssuesChart() {
        const ctx = document.getElementById('issues-chart').getContext('2d');

        this.charts.issues = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Security', 'Performance', 'Quality', 'Coverage', 'Complexity', 'Documentation'],
                datasets: [{
                    label: 'Current',
                    data: [98, 94, 87, 87, 92, 78],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#667eea'
                }, {
                    label: 'Target',
                    data: [100, 95, 90, 90, 85, 80],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    pointBackgroundColor: '#28a745',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#28a745'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    setupAutoRefresh() {
        setInterval(() => {
            this.loadDashboardData();
        }, this.refreshInterval);
    }

    setupEventListeners() {
        // Add any additional event listeners here
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        // Insert at top of dashboard
        const dashboard = document.querySelector('.dashboard');
        dashboard.insertBefore(errorDiv, dashboard.firstChild);

        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }
}

// Global functions for UI interactions
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Activate button
    event.target.classList.add('active');
}

function refreshDashboard() {
    if (window.dashboard) {
        window.dashboard.loadDashboardData();
    }
}

function downloadReport(url) {
    window.open(url, '_blank');
}

function viewVulnerability(title) {
    alert(`Viewing details for: ${title}\n\nThis would open a detailed view of the vulnerability.`);
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TestingDashboard();
});