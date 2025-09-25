#!/usr/bin/env python3
"""
Basic test script to check imports and fix issues
"""

import sys
import os

def test_basic_imports():
    """Test basic Python imports"""
    try:
        import pandas as pd
        import numpy as np
        print("Basic imports: pandas, numpy - OK")
        return True
    except ImportError as e:
        print(f"Basic import error: {e}")
        return False

def test_sklearn_imports():
    """Test scikit-learn imports"""
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        print("Scikit-learn imports - OK")
        return True
    except ImportError as e:
        print(f"Scikit-learn not available: {e}")
        return False

def test_file_structure():
    """Test file structure"""
    base_path = os.path.dirname(os.path.abspath(__file__))
    expected_dirs = [
        'ml-pipeline',
        'predictive-models',
        'data-warehouse',
        'real-time-engine',
        'visualization-platform',
        'insights-engine',
        'recommendation-engine',
        'performance-optimization'
    ]

    print(f"Base path: {base_path}")
    for dir_name in expected_dirs:
        dir_path = os.path.join(base_path, dir_name)
        if os.path.exists(dir_path):
            print(f"Directory {dir_name} - OK")
        else:
            print(f"Directory {dir_name} - MISSING")

if __name__ == "__main__":
    print("=== Analytics Platform Testing ===")

    test_basic_imports()
    test_sklearn_imports()
    test_file_structure()

    print("\n=== Test Complete ===")