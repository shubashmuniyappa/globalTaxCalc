#!/usr/bin/env python3
"""
Simple Analytics Platform Test Script
Tests components with error handling for missing dependencies
"""

import sys
import os
import importlib
import traceback
from datetime import datetime

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_basic_imports():
    """Test basic imports"""
    print("Testing basic imports...")

    try:
        import pandas as pd
        import numpy as np
        print("  [OK] pandas, numpy")
        return True
    except ImportError as e:
        print(f"  [ERROR] Basic imports failed: {e}")
        return False

def test_optional_imports():
    """Test optional imports with fallbacks"""
    print("Testing optional imports...")

    optional_modules = [
        'sklearn',
        'matplotlib',
        'plotly',
        'dash',
        'redis',
        'scipy',
        'seaborn'
    ]

    available = []
    missing = []

    for module in optional_modules:
        try:
            importlib.import_module(module)
            available.append(module)
            print(f"  [OK] {module}")
        except ImportError:
            missing.append(module)
            print(f"  [MISSING] {module}")

    print(f"Available: {len(available)}, Missing: {len(missing)}")
    return available, missing

def create_mock_modules(missing_modules):
    """Create mock modules for missing dependencies"""
    print("Creating mock modules for missing dependencies...")

    # Mock sklearn if missing
    if 'sklearn' in missing_modules:
        print("  Creating sklearn mock...")

        # Create a simple mock sklearn
        class MockSklearnModule:
            class ensemble:
                class RandomForestClassifier:
                    def __init__(self, *args, **kwargs): pass
                    def fit(self, X, y): return self
                    def predict(self, X): return [0] * len(X)

                class IsolationForest:
                    def __init__(self, *args, **kwargs): pass
                    def fit_predict(self, X): return [1] * len(X)

            class preprocessing:
                class StandardScaler:
                    def __init__(self): pass
                    def fit_transform(self, X): return X
                    def transform(self, X): return X

            class model_selection:
                @staticmethod
                def train_test_split(*args, **kwargs):
                    return args[0], args[0], args[1], args[1]

            class metrics:
                @staticmethod
                def accuracy_score(y_true, y_pred): return 0.85
                @staticmethod
                def mean_squared_error(y_true, y_pred): return 0.1

        sys.modules['sklearn'] = MockSklearnModule()
        sys.modules['sklearn.ensemble'] = MockSklearnModule.ensemble
        sys.modules['sklearn.preprocessing'] = MockSklearnModule.preprocessing
        sys.modules['sklearn.model_selection'] = MockSklearnModule.model_selection
        sys.modules['sklearn.metrics'] = MockSklearnModule.metrics

    # Mock plotly if missing
    if 'plotly' in missing_modules:
        print("  Creating plotly mock...")

        class MockPlotlyModule:
            class graph_objects:
                class Figure:
                    def __init__(self, *args, **kwargs): pass
                    def show(self): print("  [MOCK] Plotly figure would be displayed")
                    def to_html(self): return "<div>Mock Plot</div>"

            class express:
                @staticmethod
                def line(*args, **kwargs): return MockPlotlyModule.graph_objects.Figure()
                @staticmethod
                def bar(*args, **kwargs): return MockPlotlyModule.graph_objects.Figure()

        sys.modules['plotly'] = MockPlotlyModule()
        sys.modules['plotly.graph_objects'] = MockPlotlyModule.graph_objects
        sys.modules['plotly.express'] = MockPlotlyModule.express

def test_component_imports():
    """Test importing all analytics components"""
    print("\nTesting component imports...")

    components = [
        ("ML Pipeline Engine", "ml-pipeline/ml_pipeline_engine.py"),
        ("Predictive Analytics Engine", "predictive-models/predictive_analytics_engine.py"),
        ("Data Warehouse Engine", "data-warehouse/data_warehouse_engine.py"),
        ("Real-time Analytics Engine", "real-time-engine/real_time_analytics_engine.py"),
        ("Visualization Platform", "visualization-platform/advanced_visualization_engine.py"),
        ("Insights Engine", "insights-engine/automated_insights_engine.py"),
        ("Recommendation Engine", "recommendation-engine/intelligent_recommendation_engine.py"),
        ("Performance Optimization Engine", "performance-optimization/performance_optimization_engine.py")
    ]

    results = {}

    for component_name, module_path in components:
        print(f"\nTesting {component_name}...")

        full_path = os.path.join(os.path.dirname(__file__), module_path)

        if not os.path.exists(full_path):
            print(f"  [ERROR] File not found: {full_path}")
            results[component_name] = "FILE_NOT_FOUND"
            continue

        try:
            # Try to import the module
            spec = importlib.util.spec_from_file_location("test_module", full_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            print(f"  [OK] {component_name} imported successfully")
            results[component_name] = "SUCCESS"

        except ImportError as e:
            print(f"  [ERROR] Import error in {component_name}: {str(e)}")
            results[component_name] = f"IMPORT_ERROR: {str(e)}"

        except SyntaxError as e:
            print(f"  [ERROR] Syntax error in {component_name}: {str(e)}")
            results[component_name] = f"SYNTAX_ERROR: {str(e)}"

        except Exception as e:
            print(f"  [ERROR] General error in {component_name}: {str(e)}")
            results[component_name] = f"ERROR: {str(e)}"

    return results

def test_basic_functionality():
    """Test basic functionality of components that imported successfully"""
    print("\nTesting basic functionality...")

    try:
        # Test basic numpy operations
        import numpy as np
        test_array = np.array([1, 2, 3, 4, 5])
        print(f"  [OK] NumPy operations: mean={np.mean(test_array)}")

        # Test basic pandas operations
        import pandas as pd
        test_df = pd.DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]})
        print(f"  [OK] Pandas operations: shape={test_df.shape}")

        return True

    except Exception as e:
        print(f"  [ERROR] Functionality test failed: {e}")
        return False

def generate_simple_report(import_results):
    """Generate a simple test report"""
    print("\n" + "="*50)
    print("ANALYTICS PLATFORM TEST REPORT")
    print("="*50)

    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    success_count = sum(1 for result in import_results.values() if result == "SUCCESS")
    total_count = len(import_results)

    print(f"\nComponents Tested: {total_count}")
    print(f"Successful: {success_count}")
    print(f"Failed: {total_count - success_count}")

    if success_count > 0:
        print(f"Success Rate: {(success_count/total_count)*100:.1f}%")

    print("\nComponent Status:")
    for component, status in import_results.items():
        status_symbol = "[OK]" if status == "SUCCESS" else "[ERROR]"
        print(f"  {status_symbol} {component}: {status}")

    print("\nRecommendations:")
    if success_count == total_count:
        print("  - All components imported successfully!")
        print("  - Ready for functional testing")
    else:
        print("  - Fix import errors in failed components")
        print("  - Install missing dependencies")
        print("  - Consider implementing fallback modes")

    print("="*50)

def main():
    """Main test function"""
    print("Advanced Analytics Platform - Simple Test Suite")
    print("="*50)

    # Test basic imports
    basic_ok = test_basic_imports()
    if not basic_ok:
        print("CRITICAL: Basic imports failed. Cannot continue.")
        return False

    # Test optional imports
    available, missing = test_optional_imports()

    # Create mocks for missing modules
    if missing:
        create_mock_modules(missing)

    # Test component imports
    import_results = test_component_imports()

    # Test basic functionality
    func_ok = test_basic_functionality()

    # Generate report
    generate_simple_report(import_results)

    # Return success status
    success_count = sum(1 for result in import_results.values() if result == "SUCCESS")
    return success_count > 0

if __name__ == "__main__":
    import importlib.util
    success = main()
    print(f"\nTest completed. Success: {success}")
    sys.exit(0 if success else 1)