#!/bin/bash

# Docker-based Cross-Platform Executable Builder for Bun
# Ensures consistent builds across different host platforms

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/executables"
DOCKER_IMAGE="oven/bun:1.1.29"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
    
    print_status "Docker is available"
}

# Clean output directory
clean_output() {
    print_status "Cleaning output directory..."
    rm -rf "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
}

# Build executable in Docker container
build_executable() {
    local target="$1"
    local output_name="$2"
    local bun_target="$3"
    
    print_status "Building $target executable..."
    
    # Create temporary Dockerfile for this build
    local dockerfile_content="
FROM $DOCKER_IMAGE

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bunfig.toml* ./
COPY src/ ./src/
COPY tsconfig.json ./

# Build the executable
RUN bun install --frozen-lockfile
RUN bun build src/index.ts --compile --target=$bun_target --outfile=$output_name --minify

# Create output directory
RUN mkdir -p /output
RUN cp $output_name /output/
"

    # Write temporary Dockerfile
    local temp_dockerfile="$PROJECT_DIR/.dockerfile.tmp"
    echo "$dockerfile_content" > "$temp_dockerfile"
    
    # Build Docker image and extract executable
    local image_tag="cproxy-builder-$target"
    
    if docker build -f "$temp_dockerfile" -t "$image_tag" "$PROJECT_DIR"; then
        # Create temporary container and copy executable
        local container_id=$(docker create "$image_tag")
        docker cp "$container_id:/output/$output_name" "$OUTPUT_DIR/"
        docker rm "$container_id" > /dev/null
        docker rmi "$image_tag" > /dev/null
        
        print_success "Built $target: $OUTPUT_DIR/$output_name"
        
        # Show file size
        if [[ -f "$OUTPUT_DIR/$output_name" ]]; then
            local size=$(du -h "$OUTPUT_DIR/$output_name" | cut -f1)
            print_status "Size: $size"
        fi
    else
        print_error "Failed to build $target executable"
        return 1
    fi
    
    # Clean up temporary Dockerfile
    rm -f "$temp_dockerfile"
}

# Build all platform executables
build_all() {
    local minify_flag=""
    if [[ "$1" == "--minify" ]]; then
        minify_flag="--minify"
    fi
    
    print_status "Starting cross-platform executable builds..."
    print_status "Using Docker image: $DOCKER_IMAGE"
    
    # Build targets
    local targets=(
        "linux:cproxy-linux:bun-linux-x64"
        "macos:cproxy-macos:bun-darwin-x64"
        "macos-arm64:cproxy-macos-arm64:bun-darwin-arm64"
        "windows:cproxy-windows.exe:bun-windows-x64"
    )
    
    local successful=0
    local total=${#targets[@]}
    
    for target_info in "${targets[@]}"; do
        IFS=':' read -r target output_name bun_target <<< "$target_info"
        
        if build_executable "$target" "$output_name" "$bun_target"; then
            ((successful++))
        fi
        
        echo # Add spacing between builds
    done
    
    # Summary
    echo "=================================="
    print_status "Build Summary"
    echo "=================================="
    print_success "Successfully built: $successful/$total executables"
    
    if [[ $successful -eq $total ]]; then
        print_success "All executables built successfully!"
        
        # List all executables with sizes
        print_status "Executable files:"
        ls -lh "$OUTPUT_DIR"
    else
        print_warning "Some builds failed. Check output above for details."
        exit 1
    fi
}

# Show help information
show_help() {
    echo "Docker-based Cross-Platform Executable Builder for Bun"
    echo ""
    echo "Usage:"
    echo "  $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --minify    Enable minification for smaller executables"
    echo "  --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Build all platform executables"
    echo "  $0 --minify         # Build with minification enabled"
    echo ""
    echo "Requirements:"
    echo "  - Docker must be installed and running"
    echo "  - Internet connection for pulling base image"
    echo ""
    echo "Output:"
    echo "  Executables will be created in: $OUTPUT_DIR"
}

# Main function
main() {
    if [[ "$1" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    print_status "🐳 Docker-based Bun Executable Builder"
    print_status "Project: $(basename "$PROJECT_DIR")"
    print_status "Output: $OUTPUT_DIR"
    echo ""
    
    check_docker
    clean_output
    build_all "$@"
    
    print_success "🎉 Docker build process completed!"
}

# Run main function with all arguments
main "$@"