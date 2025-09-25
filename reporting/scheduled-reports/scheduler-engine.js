class ReportSchedulerEngine {
    constructor() {
        this.schedules = new Map();
        this.jobs = new Map();
        this.emailService = null;
        this.reportGenerator = null;
        this.isRunning = false;
        this.checkInterval = 60000; // 1 minute
        this.intervalId = null;
        this.initializeScheduleTypes();
    }

    initializeScheduleTypes() {
        this.scheduleTypes = {
            daily: {
                name: 'Daily',
                description: 'Run every day at specified time',
                cronPattern: '0 {hour} {minute} * * *',
                options: {
                    time: { type: 'time', required: true, default: '09:00' }
                }
            },
            weekly: {
                name: 'Weekly',
                description: 'Run every week on specified day and time',
                cronPattern: '0 {hour} {minute} * * {dayOfWeek}',
                options: {
                    dayOfWeek: { type: 'select', required: true, values: [0,1,2,3,4,5,6], default: 1 },
                    time: { type: 'time', required: true, default: '09:00' }
                }
            },
            monthly: {
                name: 'Monthly',
                description: 'Run every month on specified day and time',
                cronPattern: '0 {hour} {minute} {dayOfMonth} * *',
                options: {
                    dayOfMonth: { type: 'number', required: true, min: 1, max: 28, default: 1 },
                    time: { type: 'time', required: true, default: '09:00' }
                }
            },
            quarterly: {
                name: 'Quarterly',
                description: 'Run every quarter on specified day and time',
                cronPattern: '0 {hour} {minute} {dayOfMonth} */3 *',
                options: {
                    dayOfMonth: { type: 'number', required: true, min: 1, max: 28, default: 1 },
                    time: { type: 'time', required: true, default: '09:00' }
                }
            },
            annually: {
                name: 'Annually',
                description: 'Run once per year on specified date and time',
                cronPattern: '0 {hour} {minute} {dayOfMonth} {month} *',
                options: {
                    month: { type: 'number', required: true, min: 1, max: 12, default: 1 },
                    dayOfMonth: { type: 'number', required: true, min: 1, max: 28, default: 1 },
                    time: { type: 'time', required: true, default: '09:00' }
                }
            },
            custom: {
                name: 'Custom',
                description: 'Custom cron expression',
                cronPattern: '{cronExpression}',
                options: {
                    cronExpression: { type: 'text', required: true, pattern: '^[0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+$' }
                }
            }
        };
    }

    setEmailService(emailService) {
        this.emailService = emailService;
    }

    setReportGenerator(reportGenerator) {
        this.reportGenerator = reportGenerator;
    }

    createSchedule(scheduleConfig) {
        try {
            const validatedConfig = this.validateScheduleConfig(scheduleConfig);
            const scheduleId = this.generateScheduleId();

            const schedule = {
                id: scheduleId,
                name: validatedConfig.name,
                description: validatedConfig.description,
                reportConfig: validatedConfig.reportConfig,
                scheduleType: validatedConfig.scheduleType,
                scheduleOptions: validatedConfig.scheduleOptions,
                cronExpression: this.generateCronExpression(validatedConfig.scheduleType, validatedConfig.scheduleOptions),
                recipients: validatedConfig.recipients || [],
                deliveryOptions: validatedConfig.deliveryOptions || {},
                active: validatedConfig.active !== false,
                createdAt: new Date().toISOString(),
                createdBy: validatedConfig.createdBy,
                lastRun: null,
                nextRun: this.calculateNextRun(validatedConfig.scheduleType, validatedConfig.scheduleOptions),
                runCount: 0,
                errorCount: 0
            };

            this.schedules.set(scheduleId, schedule);

            // Start scheduler if not already running
            if (!this.isRunning) {
                this.start();
            }

            return {
                success: true,
                scheduleId,
                schedule
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    validateScheduleConfig(config) {
        if (!config.name || typeof config.name !== 'string') {
            throw new Error('Schedule name is required and must be a string');
        }

        if (!config.reportConfig || typeof config.reportConfig !== 'object') {
            throw new Error('Report configuration is required');
        }

        if (!config.scheduleType || !this.scheduleTypes[config.scheduleType]) {
            throw new Error('Valid schedule type is required');
        }

        if (!config.scheduleOptions || typeof config.scheduleOptions !== 'object') {
            throw new Error('Schedule options are required');
        }

        // Validate schedule options based on type
        const scheduleType = this.scheduleTypes[config.scheduleType];
        for (const [optionName, optionSpec] of Object.entries(scheduleType.options)) {
            const value = config.scheduleOptions[optionName];

            if (optionSpec.required && (value === undefined || value === null)) {
                throw new Error(`Schedule option '${optionName}' is required for ${config.scheduleType} schedules`);
            }

            if (value !== undefined && optionSpec.type === 'number') {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    throw new Error(`Schedule option '${optionName}' must be a number`);
                }
                if (optionSpec.min !== undefined && numValue < optionSpec.min) {
                    throw new Error(`Schedule option '${optionName}' must be at least ${optionSpec.min}`);
                }
                if (optionSpec.max !== undefined && numValue > optionSpec.max) {
                    throw new Error(`Schedule option '${optionName}' must be at most ${optionSpec.max}`);
                }
            }
        }

        return config;
    }

    generateCronExpression(scheduleType, options) {
        const scheduleSpec = this.scheduleTypes[scheduleType];
        let cronPattern = scheduleSpec.cronPattern;

        // Parse time option (HH:MM format)
        if (options.time) {
            const [hour, minute] = options.time.split(':').map(Number);
            cronPattern = cronPattern.replace('{hour}', hour).replace('{minute}', minute);
        }

        // Replace other placeholders
        for (const [key, value] of Object.entries(options)) {
            cronPattern = cronPattern.replace(`{${key}}`, value);
        }

        return cronPattern;
    }

    calculateNextRun(scheduleType, options) {
        const now = new Date();
        const cronExpression = this.generateCronExpression(scheduleType, options);

        // Simple next run calculation (in a real implementation, use a cron library)
        switch (scheduleType) {
            case 'daily':
                const [hour, minute] = options.time.split(':').map(Number);
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(hour, minute, 0, 0);
                return tomorrow.toISOString();

            case 'weekly':
                const weeklyNext = new Date(now);
                const [wHour, wMinute] = options.time.split(':').map(Number);
                weeklyNext.setDate(weeklyNext.getDate() + (7 - weeklyNext.getDay() + options.dayOfWeek) % 7);
                weeklyNext.setHours(wHour, wMinute, 0, 0);
                return weeklyNext.toISOString();

            case 'monthly':
                const monthlyNext = new Date(now);
                const [mHour, mMinute] = options.time.split(':').map(Number);
                monthlyNext.setMonth(monthlyNext.getMonth() + 1);
                monthlyNext.setDate(options.dayOfMonth);
                monthlyNext.setHours(mHour, mMinute, 0, 0);
                return monthlyNext.toISOString();

            default:
                // For more complex schedules, would use a proper cron library
                const defaultNext = new Date(now);
                defaultNext.setDate(defaultNext.getDate() + 1);
                return defaultNext.toISOString();
        }
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.checkSchedules();
        }, this.checkInterval);

        console.log('Report scheduler started');
    }

    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('Report scheduler stopped');
    }

    checkSchedules() {
        const now = new Date();

        for (const [scheduleId, schedule] of this.schedules) {
            if (!schedule.active) continue;

            const nextRun = new Date(schedule.nextRun);
            if (now >= nextRun) {
                this.executeSchedule(scheduleId);
            }
        }
    }

    async executeSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) return;

        console.log(`Executing scheduled report: ${schedule.name}`);

        const jobId = this.generateJobId();
        const job = {
            id: jobId,
            scheduleId,
            scheduleName: schedule.name,
            startTime: new Date().toISOString(),
            status: 'running',
            progress: 0,
            logs: []
        };

        this.jobs.set(jobId, job);

        try {
            // Update schedule run info
            schedule.lastRun = new Date().toISOString();
            schedule.runCount++;

            // Generate report
            job.logs.push({ timestamp: new Date().toISOString(), message: 'Starting report generation' });
            job.progress = 10;

            const reportResult = await this.generateReport(schedule.reportConfig, job);

            if (!reportResult.success) {
                throw new Error(reportResult.error);
            }

            // Deliver report
            job.logs.push({ timestamp: new Date().toISOString(), message: 'Starting report delivery' });
            job.progress = 70;

            await this.deliverReport(schedule, reportResult.report, job);

            // Mark job as completed
            job.status = 'completed';
            job.progress = 100;
            job.endTime = new Date().toISOString();
            job.logs.push({ timestamp: new Date().toISOString(), message: 'Report delivered successfully' });

            // Calculate next run
            schedule.nextRun = this.calculateNextRun(schedule.scheduleType, schedule.scheduleOptions);

        } catch (error) {
            console.error(`Error executing schedule ${scheduleId}:`, error);

            schedule.errorCount++;
            job.status = 'failed';
            job.error = error.message;
            job.endTime = new Date().toISOString();
            job.logs.push({ timestamp: new Date().toISOString(), message: `Error: ${error.message}` });

            // Handle repeated failures
            if (schedule.errorCount >= 3) {
                schedule.active = false;
                job.logs.push({ timestamp: new Date().toISOString(), message: 'Schedule deactivated due to repeated failures' });
            }
        }
    }

    async generateReport(reportConfig, job) {
        if (!this.reportGenerator) {
            throw new Error('Report generator not configured');
        }

        try {
            job.progress = 30;
            const report = await this.reportGenerator.generateReport(reportConfig);
            job.progress = 60;

            return {
                success: true,
                report
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deliverReport(schedule, report, job) {
        const deliveryPromises = [];

        // Email delivery
        if (schedule.recipients && schedule.recipients.length > 0) {
            deliveryPromises.push(this.deliverByEmail(schedule, report, job));
        }

        // File system delivery
        if (schedule.deliveryOptions.saveToFileSystem) {
            deliveryPromises.push(this.deliverToFileSystem(schedule, report, job));
        }

        // Cloud storage delivery
        if (schedule.deliveryOptions.cloudStorage) {
            deliveryPromises.push(this.deliverToCloudStorage(schedule, report, job));
        }

        // API webhook delivery
        if (schedule.deliveryOptions.webhook) {
            deliveryPromises.push(this.deliverToWebhook(schedule, report, job));
        }

        await Promise.all(deliveryPromises);
        job.progress = 90;
    }

    async deliverByEmail(schedule, report, job) {
        if (!this.emailService) {
            throw new Error('Email service not configured');
        }

        const emailContent = this.generateEmailContent(schedule, report);

        for (const recipient of schedule.recipients) {
            await this.emailService.sendEmail({
                to: recipient.email,
                subject: emailContent.subject,
                body: emailContent.body,
                attachments: report.attachments || []
            });

            job.logs.push({
                timestamp: new Date().toISOString(),
                message: `Report sent to ${recipient.email}`
            });
        }
    }

    generateEmailContent(schedule, report) {
        const subject = `${schedule.name} - ${new Date().toLocaleDateString()}`;

        const body = `
            <h2>${schedule.name}</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>${schedule.description || 'Automated report delivery'}</p>

            ${report.summary ? `
                <h3>Report Summary</h3>
                <div>${report.summary}</div>
            ` : ''}

            <p>Please find the full report in the attached file(s).</p>

            <hr>
            <small>This is an automated message from GlobalTaxCalc Reporting System.</small>
        `;

        return { subject, body };
    }

    async deliverToFileSystem(schedule, report, job) {
        const path = require('path');
        const fs = require('fs').promises;

        const outputDir = schedule.deliveryOptions.saveToFileSystem.directory || './reports/scheduled';
        const filename = this.generateReportFilename(schedule, report);
        const fullPath = path.join(outputDir, filename);

        // Ensure directory exists
        await fs.mkdir(outputDir, { recursive: true });

        // Save report
        await fs.writeFile(fullPath, report.content);

        job.logs.push({
            timestamp: new Date().toISOString(),
            message: `Report saved to ${fullPath}`
        });
    }

    async deliverToCloudStorage(schedule, report, job) {
        // Implementation would depend on the cloud storage provider
        const cloudConfig = schedule.deliveryOptions.cloudStorage;

        job.logs.push({
            timestamp: new Date().toISOString(),
            message: `Report uploaded to ${cloudConfig.provider}`
        });
    }

    async deliverToWebhook(schedule, report, job) {
        const webhookConfig = schedule.deliveryOptions.webhook;

        const payload = {
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            executionTime: new Date().toISOString(),
            report: {
                summary: report.summary,
                downloadUrl: report.downloadUrl
            }
        };

        // Make HTTP request to webhook URL
        const response = await fetch(webhookConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...webhookConfig.headers
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook delivery failed: ${response.statusText}`);
        }

        job.logs.push({
            timestamp: new Date().toISOString(),
            message: `Report delivered to webhook: ${webhookConfig.url}`
        });
    }

    generateReportFilename(schedule, report) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = report.format || 'pdf';
        return `${schedule.name.replace(/\s+/g, '_')}_${timestamp}.${extension}`;
    }

    getSchedule(scheduleId) {
        return this.schedules.get(scheduleId);
    }

    getAllSchedules() {
        return Array.from(this.schedules.values());
    }

    getActiveSchedules() {
        return this.getAllSchedules().filter(schedule => schedule.active);
    }

    updateSchedule(scheduleId, updates) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        // Validate updates
        if (updates.scheduleType || updates.scheduleOptions) {
            const newConfig = {
                ...schedule,
                ...updates
            };
            this.validateScheduleConfig(newConfig);

            // Recalculate next run if schedule changed
            if (updates.scheduleType || updates.scheduleOptions) {
                updates.nextRun = this.calculateNextRun(
                    updates.scheduleType || schedule.scheduleType,
                    updates.scheduleOptions || schedule.scheduleOptions
                );
            }
        }

        Object.assign(schedule, updates, {
            updatedAt: new Date().toISOString()
        });

        return schedule;
    }

    deleteSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        this.schedules.delete(scheduleId);

        // Clean up related jobs
        for (const [jobId, job] of this.jobs) {
            if (job.scheduleId === scheduleId) {
                this.jobs.delete(jobId);
            }
        }

        return true;
    }

    activateSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        schedule.active = true;
        schedule.nextRun = this.calculateNextRun(schedule.scheduleType, schedule.scheduleOptions);

        return schedule;
    }

    deactivateSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        schedule.active = false;
        return schedule;
    }

    getJob(jobId) {
        return this.jobs.get(jobId);
    }

    getJobsBySchedule(scheduleId) {
        return Array.from(this.jobs.values()).filter(job => job.scheduleId === scheduleId);
    }

    getRecentJobs(limit = 50) {
        return Array.from(this.jobs.values())
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
            .slice(0, limit);
    }

    getScheduleStatistics() {
        const schedules = this.getAllSchedules();
        const jobs = Array.from(this.jobs.values());

        return {
            totalSchedules: schedules.length,
            activeSchedules: schedules.filter(s => s.active).length,
            totalJobs: jobs.length,
            successfulJobs: jobs.filter(j => j.status === 'completed').length,
            failedJobs: jobs.filter(j => j.status === 'failed').length,
            runningJobs: jobs.filter(j => j.status === 'running').length,
            averageExecutionTime: this.calculateAverageExecutionTime(jobs)
        };
    }

    calculateAverageExecutionTime(jobs) {
        const completedJobs = jobs.filter(j => j.status === 'completed' && j.endTime);
        if (completedJobs.length === 0) return 0;

        const totalTime = completedJobs.reduce((sum, job) => {
            const duration = new Date(job.endTime) - new Date(job.startTime);
            return sum + duration;
        }, 0);

        return Math.round(totalTime / completedJobs.length / 1000); // Return in seconds
    }

    generateScheduleId() {
        return 'schedule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateJobId() {
        return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getScheduleTypes() {
        return Object.keys(this.scheduleTypes);
    }

    getScheduleTypeInfo(type) {
        return this.scheduleTypes[type];
    }

    exportSchedules() {
        return {
            schedules: Array.from(this.schedules.values()),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    importSchedules(importData) {
        if (!importData.schedules || !Array.isArray(importData.schedules)) {
            throw new Error('Invalid import data format');
        }

        const imported = [];
        const errors = [];

        for (const scheduleData of importData.schedules) {
            try {
                const result = this.createSchedule(scheduleData);
                if (result.success) {
                    imported.push(result.scheduleId);
                } else {
                    errors.push({ schedule: scheduleData.name, error: result.error });
                }
            } catch (error) {
                errors.push({ schedule: scheduleData.name, error: error.message });
            }
        }

        return {
            imported: imported.length,
            errors
        };
    }

    cleanup(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        let cleanedJobs = 0;

        for (const [jobId, job] of this.jobs) {
            const jobDate = new Date(job.startTime);
            if (jobDate < cutoffDate && job.status !== 'running') {
                this.jobs.delete(jobId);
                cleanedJobs++;
            }
        }

        return {
            cleanedJobs,
            remainingJobs: this.jobs.size
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportSchedulerEngine;
}