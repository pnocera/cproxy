#!/bin/bash

# Test Runner Script for cproxy
# Runs comprehensive test suite with reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_PERFORMANCE=false
GENERATE_COVERAGE=false
VERBOSE=false
CI_MODE=false
OUTPUT_FORMAT="spec"

# Help function
show_help() {
    echo "cproxy Test Runner"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -u, --unit-only       Run only unit tests"
    echo "  -i, --integration-only Run only integration tests"
    echo "  -p, --performance     Include performance tests"
    echo "  -c, --coverage        Generate coverage report"
    echo "  -v, --verbose         Verbose output"
    echo "  --ci                  CI mode (no watch, exit on failure)"
    echo "  --format FORMAT       Output format (spec, json, tap)"
    echo "  -h, --help           Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run unit and integration tests"
    echo "  $0 -u -c             # Run unit tests with coverage"
    echo "  $0 -p -v             # Run all tests including performance, verbose"
    echo "  $0 --ci --coverage    # CI mode with coverage"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--unit-only)
            RUN_UNIT=true
            RUN_INTEGRATION=false
            shift
            ;;
        -i|--integration-only)
            RUN_UNIT=false
            RUN_INTEGRATION=true
            shift
            ;;
        -p|--performance)
            RUN_PERFORMANCE=true
            shift
            ;;
        -c|--coverage)
            GENERATE_COVERAGE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        --format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run command with status reporting
run_command() {
    local description=$1
    local command=$2
    
    print_status $BLUE "🔄 $description..."
    
    if [ "$VERBOSE" = true ]; then
        echo "Command: $command"
    fi
    
    if eval "$command"; then
        print_status $GREEN "✅ $description completed successfully"
        return 0
    else
        print_status $RED "❌ $description failed"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status $BLUE "🔍 Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_status $RED "❌ Node.js is not installed"
        exit 1
    fi
    
    # Check if npm/yarn is available
    if ! command -v npm &> /dev/null && ! command -v yarn &> /dev/null; then
        print_status $RED "❌ Neither npm nor yarn is available"
        exit 1
    fi
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_status $RED "❌ package.json not found. Run from project root."
        exit 1
    fi
    
    # Check if test dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_status $YELLOW "⚠️ node_modules not found. Installing dependencies..."
        run_command "Installing dependencies" "npm install"
    fi
    
    print_status $GREEN "✅ Prerequisites check passed"
}

# Function to build the project
build_project() {
    if [ -f "dist/index.js" ] && [ "src/index.ts" -ot "dist/index.js" ]; then
        print_status $YELLOW "ℹ️ Build is up to date, skipping..."
        return 0
    fi
    
    run_command "Building project" "npm run build"
}

# Function to run linting
run_linting() {
    if command -v eslint &> /dev/null; then
        run_command "Running ESLint" "eslint src/ tests/ --ext .ts,.js"
    else
        print_status $YELLOW "⚠️ ESLint not available, skipping linting"
    fi
}

# Function to run type checking
run_type_checking() {
    run_command "Running TypeScript type check" "npm run typecheck"
}

# Function to construct Jest command
construct_jest_command() {
    local jest_cmd="jest"
    local test_patterns=()
    
    # Add test patterns based on what to run
    if [ "$RUN_UNIT" = true ] && [ "$RUN_INTEGRATION" = true ]; then
        test_patterns+=("tests/unit" "tests/integration")
    elif [ "$RUN_UNIT" = true ]; then
        test_patterns+=("tests/unit")
    elif [ "$RUN_INTEGRATION" = true ]; then
        test_patterns+=("tests/integration")
    fi
    
    # Add performance tests if requested
    if [ "$RUN_PERFORMANCE" = true ]; then
        test_patterns+=("tests/performance")
    fi
    
    # Add test patterns to command
    if [ ${#test_patterns[@]} -gt 0 ]; then
        jest_cmd="$jest_cmd ${test_patterns[*]}"
    fi
    
    # Add coverage if requested
    if [ "$GENERATE_COVERAGE" = true ]; then
        jest_cmd="$jest_cmd --coverage"
    fi
    
    # Add CI mode options
    if [ "$CI_MODE" = true ]; then
        jest_cmd="$jest_cmd --ci --watchAll=false --maxWorkers=2"
    fi
    
    # Add verbose mode
    if [ "$VERBOSE" = true ]; then
        jest_cmd="$jest_cmd --verbose"
    fi
    
    # Add output format
    if [ "$OUTPUT_FORMAT" != "spec" ]; then
        jest_cmd="$jest_cmd --reporters=default --reporters=jest-$OUTPUT_FORMAT"
    fi
    
    echo "$jest_cmd"
}

# Function to generate test report
generate_test_report() {
    local exit_code=$1
    
    print_status $BLUE "📊 Generating test report..."
    
    # Create reports directory
    mkdir -p reports
    
    # Generate summary
    cat > reports/test-summary.txt << EOF
cproxy Test Run Summary
=======================
Date: $(date)
Exit Code: $exit_code
Unit Tests: $RUN_UNIT
Integration Tests: $RUN_INTEGRATION
Performance Tests: $RUN_PERFORMANCE
Coverage Generated: $GENERATE_COVERAGE
CI Mode: $CI_MODE

EOF
    
    # Add coverage summary if available
    if [ "$GENERATE_COVERAGE" = true ] && [ -f "coverage/coverage-summary.json" ]; then
        echo "Coverage Summary:" >> reports/test-summary.txt
        if command -v jq &> /dev/null; then
            jq -r '.total | "Lines: \(.lines.pct)%, Statements: \(.statements.pct)%, Functions: \(.functions.pct)%, Branches: \(.branches.pct)%"' coverage/coverage-summary.json >> reports/test-summary.txt
        else
            echo "Coverage data available in coverage/coverage-summary.json" >> reports/test-summary.txt
        fi
    fi
    
    # Add performance metrics if available
    if [ "$RUN_PERFORMANCE" = true ]; then
        echo "" >> reports/test-summary.txt
        echo "Performance test results logged during execution." >> reports/test-summary.txt
    fi
    
    if [ $exit_code -eq 0 ]; then
        print_status $GREEN "✅ Test report generated: reports/test-summary.txt"
    else
        print_status $YELLOW "⚠️ Test report generated with failures: reports/test-summary.txt"
    fi
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting cproxy test suite..."
    echo ""
    
    # Show configuration
    print_status $BLUE "Configuration:"
    echo "  Unit Tests: $RUN_UNIT"
    echo "  Integration Tests: $RUN_INTEGRATION"
    echo "  Performance Tests: $RUN_PERFORMANCE"
    echo "  Coverage: $GENERATE_COVERAGE"
    echo "  Verbose: $VERBOSE"
    echo "  CI Mode: $CI_MODE"
    echo "  Output Format: $OUTPUT_FORMAT"
    echo ""
    
    # Run prerequisite checks
    check_prerequisites
    echo ""
    
    # Build project
    build_project
    echo ""
    
    # Run type checking
    run_type_checking
    echo ""
    
    # Run linting (optional)
    # run_linting
    # echo ""
    
    # Construct and run Jest command
    local jest_cmd=$(construct_jest_command)
    print_status $BLUE "🧪 Running tests..."
    if [ "$VERBOSE" = true ]; then
        echo "Jest command: $jest_cmd"
    fi
    echo ""
    
    # Run tests
    local test_exit_code=0
    if ! eval "$jest_cmd"; then
        test_exit_code=1
    fi
    
    echo ""
    
    # Generate report
    generate_test_report $test_exit_code
    
    # Final status
    if [ $test_exit_code -eq 0 ]; then
        print_status $GREEN "🎉 All tests passed!"
        
        # Show coverage summary if available
        if [ "$GENERATE_COVERAGE" = true ] && [ -f "coverage/lcov-report/index.html" ]; then
            print_status $BLUE "📊 Coverage report: coverage/lcov-report/index.html"
        fi
    else
        print_status $RED "💥 Some tests failed!"
        
        if [ "$CI_MODE" = true ]; then
            exit $test_exit_code
        else
            print_status $YELLOW "💡 Tip: Run with -v for verbose output or check individual test files"
        fi
    fi
    
    return $test_exit_code
}

# Run main function
main "$@"