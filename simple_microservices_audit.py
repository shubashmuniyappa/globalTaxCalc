#!/usr/bin/env python3
"""
Simple Microservices Audit for GlobalTaxCalc
Tests all services for structure, dependencies, and functionality
"""

import os
import sys
import json
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class SimpleAuditor:
    def __init__(self):
        self.root_dir = Path('.')
        self.services = {}
        self.results = []

    def discover_services(self):
        """Find all microservices"""
        logger.info("Discovering microservices...")

        for item in self.root_dir.iterdir():
            if (item.is_dir() and
                not item.name.startswith('.') and
                not item.name.startswith('C:') and
                item.name not in ['docs', 'scripts', 'shared', 'public']):

                service_info = self.analyze_service(item)
                if service_info:
                    self.services[item.name] = service_info

        logger.info(f"Found {len(self.services)} services")

    def analyze_service(self, service_dir: Path):
        """Analyze a service directory"""
        info = {
            'name': service_dir.name,
            'path': str(service_dir),
            'type': 'unknown',
            'has_package_json': False,
            'has_python': False,
            'has_dockerfile': False,
            'main_file': None,
            'status': 'unknown',
            'issues': []
        }

        try:
            # Check key files
            package_json = service_dir / 'package.json'
            dockerfile = service_dir / 'Dockerfile'

            if package_json.exists():
                info['has_package_json'] = True
                info['type'] = 'node'
                info['main_file'] = 'package.json'

            if dockerfile.exists():
                info['has_dockerfile'] = True

            # Check for Python files
            python_files = list(service_dir.glob('*.py')) + list(service_dir.glob('**/main.py'))
            if python_files:
                info['has_python'] = True
                if info['type'] == 'unknown':
                    info['type'] = 'python'
                    info['main_file'] = python_files[0].name

            # Check for server files
            server_files = ['server.js', 'app.js', 'index.js']
            for sf in server_files:
                if (service_dir / sf).exists():
                    info['main_file'] = sf
                    break

            return info if info['type'] != 'unknown' else None

        except Exception as e:
            logger.warning(f"Error analyzing {service_dir.name}: {e}")
            return None

    def test_node_service(self, service_info):
        """Test Node.js service"""
        service_path = Path(service_info['path'])
        issues = []

        try:
            # Check package.json
            package_json_path = service_path / 'package.json'
            if package_json_path.exists():
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    try:
                        package_data = json.load(f)
                        if not package_data.get('dependencies'):
                            issues.append("No dependencies defined")
                        if not package_data.get('scripts'):
                            issues.append("No npm scripts defined")
                    except json.JSONDecodeError:
                        issues.append("Invalid package.json format")
            else:
                issues.append("Missing package.json")

            # Check for main server file
            main_files = ['server.js', 'app.js', 'index.js']
            has_main = any((service_path / f).exists() for f in main_files)
            if not has_main:
                issues.append("No main server file found")

            # Check for environment config
            if not (service_path / '.env.example').exists():
                issues.append("Missing .env.example")

        except Exception as e:
            issues.append(f"Test error: {str(e)}")

        return issues

    def test_python_service(self, service_info):
        """Test Python service"""
        service_path = Path(service_info['path'])
        issues = []

        try:
            # Check for main Python file
            python_files = list(service_path.glob('*.py')) + list(service_path.glob('**/main.py'))
            if not python_files:
                issues.append("No Python files found")

            # Check for requirements
            if not (service_path / 'requirements.txt').exists():
                issues.append("Missing requirements.txt")

            # Test syntax on main files
            for py_file in python_files[:3]:  # Test first 3 files
                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        compile(f.read(), py_file.name, 'exec')
                except SyntaxError:
                    issues.append(f"Syntax error in {py_file.name}")
                except Exception:
                    pass  # Skip encoding issues

        except Exception as e:
            issues.append(f"Test error: {str(e)}")

        return issues

    def test_service(self, name, info):
        """Test individual service"""
        issues = []

        if info['type'] == 'node':
            issues = self.test_node_service(info)
        elif info['type'] == 'python':
            issues = self.test_python_service(info)

        # Determine status
        if len(issues) == 0:
            status = 'healthy'
        elif len(issues) <= 2:
            status = 'warning'
        else:
            status = 'error'

        return status, issues

    def run_audit(self):
        """Run the audit"""
        self.discover_services()

        results_summary = {
            'total_services': len(self.services),
            'healthy': 0,
            'warning': 0,
            'error': 0,
            'services': {}
        }

        print("\n" + "="*60)
        print("MICROSERVICES AUDIT REPORT")
        print("="*60)

        for name, info in self.services.items():
            status, issues = self.test_service(name, info)
            info['status'] = status
            info['issues'] = issues

            results_summary['services'][name] = {
                'type': info['type'],
                'status': status,
                'issues_count': len(issues)
            }

            results_summary[status] += 1

            # Print service status
            status_icon = {
                'healthy': '[OK]',
                'warning': '[WARN]',
                'error': '[ERROR]'
            }.get(status, '[?]')

            print(f"{status_icon} {name:<30} ({info['type']:<8}) - {status.upper()}")

            # Print issues
            if issues:
                for issue in issues[:2]:  # Show first 2 issues
                    print(f"    • {issue}")

        # Summary
        print("\n" + "-"*60)
        print("SUMMARY:")
        print(f"  Total Services: {results_summary['total_services']}")
        print(f"  Healthy: {results_summary['healthy']}")
        print(f"  Warning: {results_summary['warning']}")
        print(f"  Error: {results_summary['error']}")

        health_rate = results_summary['healthy'] / max(results_summary['total_services'], 1)
        overall_status = (
            'EXCELLENT' if health_rate >= 0.8 else
            'GOOD' if health_rate >= 0.6 else
            'FAIR' if health_rate >= 0.4 else
            'POOR'
        )

        print(f"  Health Rate: {health_rate:.1%}")
        print(f"  Overall Status: {overall_status}")

        # Save results
        with open('microservices_audit_results.json', 'w') as f:
            json.dump(results_summary, f, indent=2)

        print(f"\nDetailed results saved to: microservices_audit_results.json")
        return results_summary

def main():
    auditor = SimpleAuditor()
    return auditor.run_audit()

if __name__ == "__main__":
    main()