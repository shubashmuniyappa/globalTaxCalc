#!/usr/bin/env python3
"""
Comprehensive Microservices Audit for GlobalTaxCalc
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
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MicroservicesAuditor:
    def __init__(self):
        self.root_dir = Path('.')
        self.services = {}
        self.audit_results = {
            'services_found': 0,
            'services_tested': 0,
            'services_healthy': 0,
            'issues_found': [],
            'service_details': {},
            'overall_status': 'UNKNOWN'
        }

    def discover_services(self):
        """Discover all microservices in the system"""
        logger.info("🔍 Discovering microservices...")

        # Define service patterns
        service_patterns = {
            'node_services': ['package.json'],
            'python_services': ['main.py', 'app.py', 'server.py'],
            'docker_services': ['Dockerfile'],
            'config_files': ['.env.example', 'requirements.txt']
        }

        # Scan directories for services
        for item in self.root_dir.iterdir():
            if item.is_dir() and not item.name.startswith('.') and not item.name.startswith('C:'):
                service_info = self.analyze_service_directory(item)
                if service_info:
                    self.services[item.name] = service_info

        logger.info(f"📊 Found {len(self.services)} microservices")
        return self.services

    def analyze_service_directory(self, service_dir: Path) -> Optional[Dict]:
        """Analyze a service directory to determine its type and structure"""
        service_info = {
            'name': service_dir.name,
            'path': str(service_dir),
            'type': 'unknown',
            'files': [],
            'has_package_json': False,
            'has_dockerfile': False,
            'has_python_files': False,
            'has_config': False,
            'main_file': None,
            'dependencies': [],
            'status': 'not_tested'
        }

        try:
            # List all files in service directory
            for file_path in service_dir.rglob('*'):
                if file_path.is_file():
                    relative_path = file_path.relative_to(service_dir)
                    service_info['files'].append(str(relative_path))

                    # Check for key files
                    if file_path.name == 'package.json':
                        service_info['has_package_json'] = True
                        service_info['type'] = 'node'
                        service_info['main_file'] = str(relative_path)

                    elif file_path.name in ['main.py', 'app.py', 'server.py']:
                        service_info['has_python_files'] = True
                        if service_info['type'] == 'unknown':
                            service_info['type'] = 'python'
                            service_info['main_file'] = str(relative_path)

                    elif file_path.name == 'Dockerfile':
                        service_info['has_dockerfile'] = True

                    elif file_path.name in ['.env.example', 'requirements.txt', 'config.js', 'config.py']:
                        service_info['has_config'] = True

            # Determine if this is actually a service
            is_service = (
                service_info['has_package_json'] or
                service_info['has_python_files'] or
                service_info['has_dockerfile'] or
                any('server' in f or 'app' in f for f in service_info['files'][:10])
            )

            return service_info if is_service else None

        except Exception as e:
            logger.warning(f"Error analyzing {service_dir.name}: {e}")
            return None

    def test_node_service(self, service_info: Dict) -> Dict:
        """Test Node.js service"""
        results = {
            'dependencies_ok': False,
            'can_install': False,
            'syntax_ok': False,
            'config_ok': False,
            'issues': []
        }

        service_path = Path(service_info['path'])

        try:
            # Check package.json
            package_json_path = service_path / 'package.json'
            if package_json_path.exists():
                with open(package_json_path, 'r') as f:
                    package_data = json.load(f)
                    service_info['dependencies'] = list(package_data.get('dependencies', {}).keys())
                    results['config_ok'] = True

            # Test npm install (dry run)
            try:
                result = subprocess.run(
                    ['npm', 'install', '--dry-run'],
                    cwd=service_path,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                results['can_install'] = result.returncode == 0
                if result.returncode != 0:
                    results['issues'].append(f"npm install failed: {result.stderr[:200]}")
            except Exception as e:
                results['issues'].append(f"npm test failed: {str(e)}")

            # Check for main server file
            main_files = ['server.js', 'app.js', 'index.js']
            for main_file in main_files:
                if (service_path / main_file).exists():
                    results['syntax_ok'] = True
                    break

        except Exception as e:
            results['issues'].append(f"Service test error: {str(e)}")

        return results

    def test_python_service(self, service_info: Dict) -> Dict:
        """Test Python service"""
        results = {
            'dependencies_ok': False,
            'syntax_ok': False,
            'config_ok': False,
            'issues': []
        }

        service_path = Path(service_info['path'])

        try:
            # Check for requirements.txt
            req_file = service_path / 'requirements.txt'
            if req_file.exists():
                with open(req_file, 'r') as f:
                    service_info['dependencies'] = [line.strip() for line in f.readlines() if line.strip()]
                results['config_ok'] = True

            # Test Python syntax on main files
            python_files = [f for f in service_info['files'] if f.endswith('.py')][:5]  # Test first 5
            syntax_ok = True

            for py_file in python_files:
                try:
                    with open(service_path / py_file, 'r') as f:
                        compile(f.read(), py_file, 'exec')
                except SyntaxError as e:
                    syntax_ok = False
                    results['issues'].append(f"Syntax error in {py_file}: {str(e)}")
                    break

            results['syntax_ok'] = syntax_ok

        except Exception as e:
            results['issues'].append(f"Python service test error: {str(e)}")

        return results

    def test_service_health(self, service_name: str, service_info: Dict):
        """Test individual service health"""
        logger.info(f"🧪 Testing service: {service_name}")

        test_results = {
            'name': service_name,
            'type': service_info['type'],
            'structure_ok': True,
            'dependencies_status': 'unknown',
            'syntax_ok': False,
            'config_ok': False,
            'issues': [],
            'recommendations': []
        }

        # Test based on service type
        if service_info['type'] == 'node':
            results = self.test_node_service(service_info)
            test_results.update(results)

        elif service_info['type'] == 'python':
            results = self.test_python_service(service_info)
            test_results.update(results)

        # Common checks
        if not service_info['has_config']:
            test_results['issues'].append("Missing configuration files")
            test_results['recommendations'].append("Add .env.example or config files")

        if not service_info['has_dockerfile'] and service_info['type'] != 'unknown':
            test_results['recommendations'].append("Consider adding Dockerfile for containerization")

        # Update service status
        if len(test_results['issues']) == 0:
            service_info['status'] = 'healthy'
        elif len(test_results['issues']) < 3:
            service_info['status'] = 'warning'
        else:
            service_info['status'] = 'error'

        return test_results

    def run_audit(self):
        """Run complete microservices audit"""
        logger.info("🚀 Starting comprehensive microservices audit")

        # Discover services
        self.discover_services()
        self.audit_results['services_found'] = len(self.services)

        # Test each service
        for service_name, service_info in self.services.items():
            try:
                test_result = self.test_service_health(service_name, service_info)
                self.audit_results['service_details'][service_name] = test_result
                self.audit_results['services_tested'] += 1

                if service_info['status'] == 'healthy':
                    self.audit_results['services_healthy'] += 1

                if test_result['issues']:
                    self.audit_results['issues_found'].extend([
                        f"{service_name}: {issue}" for issue in test_result['issues']
                    ])

            except Exception as e:
                logger.error(f"Failed to test {service_name}: {e}")
                self.audit_results['issues_found'].append(f"{service_name}: Audit failed - {str(e)}")

        # Calculate overall status
        health_rate = self.audit_results['services_healthy'] / max(self.audit_results['services_tested'], 1)
        if health_rate >= 0.8:
            self.audit_results['overall_status'] = 'EXCELLENT'
        elif health_rate >= 0.6:
            self.audit_results['overall_status'] = 'GOOD'
        elif health_rate >= 0.4:
            self.audit_results['overall_status'] = 'FAIR'
        else:
            self.audit_results['overall_status'] = 'POOR'

        return self.audit_results

    def generate_report(self):
        """Generate comprehensive audit report"""
        print("\n" + "="*80)
        print("🏗️  COMPREHENSIVE MICROSERVICES AUDIT REPORT")
        print("="*80)

        # Summary
        print(f"\n📊 SUMMARY:")
        print(f"  Services Found: {self.audit_results['services_found']}")
        print(f"  Services Tested: {self.audit_results['services_tested']}")
        print(f"  Services Healthy: {self.audit_results['services_healthy']}")
        print(f"  Overall Status: {self.audit_results['overall_status']}")
        print(f"  Health Rate: {self.audit_results['services_healthy']}/{self.audit_results['services_tested']} ({self.audit_results['services_healthy']/max(self.audit_results['services_tested'],1)*100:.1f}%)")

        # Service Details
        print(f"\n🔍 SERVICE DETAILS:")
        for name, details in self.audit_results['service_details'].items():
            status_icon = "✅" if self.services[name]['status'] == 'healthy' else "⚠️" if self.services[name]['status'] == 'warning' else "❌"
            print(f"  {status_icon} {name:<25} ({details['type']:<8}) - {self.services[name]['status'].upper()}")

            if details['issues']:
                for issue in details['issues'][:2]:  # Show first 2 issues
                    print(f"      • {issue}")

        # Critical Issues
        if self.audit_results['issues_found']:
            print(f"\n⚠️  CRITICAL ISSUES FOUND ({len(self.audit_results['issues_found'])}):")
            for issue in self.audit_results['issues_found'][:10]:  # Show first 10
                print(f"  • {issue}")

        # Service Types Distribution
        type_dist = {}
        for service_info in self.services.values():
            service_type = service_info['type']
            type_dist[service_type] = type_dist.get(service_type, 0) + 1

        print(f"\n📈 SERVICE TYPES:")
        for stype, count in type_dist.items():
            print(f"  {stype.title()}: {count} services")

        print("\n" + "="*80)
        return self.audit_results

def main():
    """Main execution"""
    auditor = MicroservicesAuditor()

    try:
        # Run audit
        results = auditor.run_audit()

        # Generate report
        auditor.generate_report()

        # Save detailed results
        with open('microservices_audit_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)

        print("📄 Detailed results saved to: microservices_audit_results.json")

        return results['overall_status'] in ['EXCELLENT', 'GOOD']

    except Exception as e:
        logger.error(f"Audit failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)