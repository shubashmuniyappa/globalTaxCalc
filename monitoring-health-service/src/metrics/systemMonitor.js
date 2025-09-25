const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const pidUsage = require('pidusage');
const si = require('systeminformation');
const { updateSystemMetrics } = require('./prometheus');
const config = require('../config');

class SystemMonitor {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.lastCpuInfo = null;
  }

  async start() {
    if (this.isRunning) {
      console.warn('System monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting system monitor...');

    this.interval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting system metrics:', error);
      }
    }, 10000);

    await this.collectMetrics();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('System monitor stopped');
  }

  async collectMetrics() {
    try {
      const [cpuMetrics, memoryMetrics, diskMetrics] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics()
      ]);

      updateSystemMetrics(cpuMetrics, memoryMetrics, diskMetrics);

      if (config.system.metricsEnabled) {
        this.checkThresholds(cpuMetrics, memoryMetrics, diskMetrics);
      }
    } catch (error) {
      console.error('Error in collectMetrics:', error);
    }
  }

  async getCpuMetrics() {
    try {
      const cpuUsage = await si.currentLoad();
      return cpuUsage.currentLoad;
    } catch (error) {
      console.warn('Could not get CPU metrics from systeminformation, falling back to pidusage');
      try {
        const stats = await pidUsage(process.pid);
        return stats.cpu;
      } catch (fallbackError) {
        console.warn('Could not get CPU metrics from pidusage, using os.loadavg');
        const loadAvg = os.loadavg();
        return (loadAvg[0] / os.cpus().length) * 100;
      }
    }
  }

  async getMemoryMetrics() {
    try {
      const memInfo = await si.mem();
      return {
        total: memInfo.total,
        used: memInfo.used,
        free: memInfo.free,
        available: memInfo.available
      };
    } catch (error) {
      console.warn('Could not get memory metrics from systeminformation, using os module');
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      return {
        total: totalMem,
        used: totalMem - freeMem,
        free: freeMem,
        available: freeMem
      };
    }
  }

  async getDiskMetrics() {
    try {
      const fsSize = await si.fsSize();
      return fsSize.map(disk => ({
        filesystem: disk.fs,
        mount: disk.mount,
        total: disk.size,
        used: disk.used,
        free: disk.available,
        usedPercent: disk.use
      }));
    } catch (error) {
      console.warn('Could not get disk metrics from systeminformation');
      try {
        const stats = await promisify(fs.stat)('.');
        return [{
          filesystem: 'unknown',
          mount: '/',
          total: 0,
          used: 0,
          free: 0,
          usedPercent: 0
        }];
      } catch (statError) {
        return [];
      }
    }
  }

  async getNetworkMetrics() {
    try {
      const networkStats = await si.networkStats();
      return networkStats.map(net => ({
        interface: net.iface,
        bytesReceived: net.rx_bytes,
        bytesSent: net.tx_bytes,
        packetsReceived: net.rx_packets,
        packetsSent: net.tx_packets,
        errorsReceived: net.rx_errors,
        errorsSent: net.tx_errors
      }));
    } catch (error) {
      console.warn('Could not get network metrics:', error);
      return [];
    }
  }

  async getProcessMetrics() {
    try {
      const stats = await pidUsage(process.pid);
      return {
        pid: process.pid,
        cpu: stats.cpu,
        memory: stats.memory,
        ppid: stats.ppid,
        ctime: stats.ctime,
        elapsed: stats.elapsed,
        timestamp: stats.timestamp
      };
    } catch (error) {
      console.warn('Could not get process metrics:', error);
      return {
        pid: process.pid,
        cpu: 0,
        memory: process.memoryUsage().rss,
        ppid: process.ppid,
        ctime: 0,
        elapsed: process.uptime() * 1000,
        timestamp: Date.now()
      };
    }
  }

  checkThresholds(cpu, memory, disk) {
    const alerts = [];

    if (cpu > config.system.cpuThreshold) {
      alerts.push({
        type: 'cpu_high',
        message: `CPU usage is ${cpu.toFixed(2)}% (threshold: ${config.system.cpuThreshold}%)`,
        severity: 'warning',
        value: cpu,
        threshold: config.system.cpuThreshold
      });
    }

    if (memory) {
      const memoryUsagePercent = (memory.used / memory.total) * 100;
      if (memoryUsagePercent > config.system.memoryThreshold) {
        alerts.push({
          type: 'memory_high',
          message: `Memory usage is ${memoryUsagePercent.toFixed(2)}% (threshold: ${config.system.memoryThreshold}%)`,
          severity: 'warning',
          value: memoryUsagePercent,
          threshold: config.system.memoryThreshold
        });
      }
    }

    if (disk && Array.isArray(disk)) {
      disk.forEach(d => {
        if (d.usedPercent > config.system.diskThreshold) {
          alerts.push({
            type: 'disk_high',
            message: `Disk usage on ${d.mount} is ${d.usedPercent.toFixed(2)}% (threshold: ${config.system.diskThreshold}%)`,
            severity: 'warning',
            value: d.usedPercent,
            threshold: config.system.diskThreshold,
            filesystem: d.filesystem,
            mount: d.mount
          });
        }
      });
    }

    if (alerts.length > 0) {
      this.emit('thresholdExceeded', alerts);
    }
  }

  emit(event, data) {
    console.warn(`System threshold alert [${event}]:`, data);
  }

  async getSystemSummary() {
    try {
      const [cpu, memory, disk, network, process] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics(),
        this.getNetworkMetrics(),
        this.getProcessMetrics()
      ]);

      return {
        timestamp: new Date().toISOString(),
        cpu,
        memory,
        disk,
        network,
        process,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      };
    } catch (error) {
      console.error('Error getting system summary:', error);
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = SystemMonitor;