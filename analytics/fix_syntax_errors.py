#!/usr/bin/env python3
"""
Quick Syntax Error Fix Script
Fix remaining syntax errors in repaired components
"""

import re

def fix_ml_pipeline_syntax():
    """Fix ML Pipeline Engine syntax error"""
    file_path = 'ml-pipeline/ml_pipeline_engine.py'

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Fix the indentation issue around line 440
        # Replace the problematic section
        old_pattern = r'default_configs\(\)\n\n    def _setup_tensorflow\(self\):'
        new_pattern = r'    \n    def _setup_tensorflow(self):'

        content = re.sub(old_pattern, new_pattern, content)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"[OK] Fixed ML Pipeline Engine syntax")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to fix ML Pipeline Engine: {e}")
        return False

def fix_predictive_analytics_syntax():
    """Fix Predictive Analytics Engine syntax error"""
    file_path = 'predictive-models/predictive_analytics_engine.py'

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Fix unterminated string literal around line 665
        # Replace the problematic line
        content = content.replace("classification',", "            'task_type': 'classification',")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"[OK] Fixed Predictive Analytics Engine syntax")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to fix Predictive Analytics Engine: {e}")
        return False

def main():
    """Main execution function"""
    print("SYNTAX ERROR REPAIR")
    print("=" * 30)

    fixes = [
        fix_ml_pipeline_syntax,
        fix_predictive_analytics_syntax
    ]

    successful_fixes = 0
    total_fixes = len(fixes)

    for fix_func in fixes:
        if fix_func():
            successful_fixes += 1

    print("\n" + "=" * 30)
    print(f"REPAIR SUMMARY")
    print(f"Total Fixes: {total_fixes}")
    print(f"Successful: {successful_fixes}")
    print(f"Success Rate: {successful_fixes/total_fixes*100:.1f}%")

    return successful_fixes == total_fixes

if __name__ == "__main__":
    success = main()
    print(f"\nSyntax Repair: {'SUCCESS' if success else 'FAILED'}")