#!/usr/bin/env bun

/**
 * Advanced Bun Executable Build Script
 * Handles cross-platform compilation with optimization and bundling
 */

import { $ } from "bun";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = process.cwd();
const ENTRY_POINT = join(PROJECT_ROOT, "src/index.ts");
const OUTPUT_DIR = join(PROJECT_ROOT, "executables");

// Build targets configuration
const BUILD_TARGETS = [
  {
    name: "linux-x64",
    target: "bun-linux-x64",
    output: "cproxy-linux",
    extension: ""
  },
  {
    name: "darwin-x64", 
    target: "bun-darwin-x64",
    output: "cproxy-macos",
    extension: ""
  },
  {
    name: "darwin-arm64",
    target: "bun-darwin-arm64", 
    output: "cproxy-macos-arm64",
    extension: ""
  },
  {
    name: "windows-x64",
    target: "bun-windows-x64",
    output: "cproxy-windows",
    extension: ".exe"
  }
];

// Build options
const BUILD_OPTIONS = {
  minify: process.argv.includes("--minify"),
  sourcemap: process.argv.includes("--sourcemap"),
  debug: process.argv.includes("--debug"),
  single: process.argv.includes("--single") ? process.argv[process.argv.indexOf("--single") + 1] : null
};

async function cleanOutput() {
  console.log("🧹 Cleaning output directory...");
  if (existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function buildExecutable(target) {
  const outputPath = join(OUTPUT_DIR, target.output + target.extension);
  
  console.log(`🔨 Building ${target.name} executable...`);
  
  try {
    const buildCommand = [
      "bun", "build", ENTRY_POINT,
      "--compile",
      `--target=${target.target}`,
      `--outfile=${outputPath}`
    ];
    
    // Add optimization flags
    if (BUILD_OPTIONS.minify) {
      buildCommand.push("--minify");
    }
    
    if (BUILD_OPTIONS.sourcemap) {
      buildCommand.push("--sourcemap");
    }
    
    // Execute build command
    await $`${buildCommand}`;
    
    console.log(`✅ Built ${target.name}: ${outputPath}`);
    
    // Show file size
    const stats = await Bun.file(outputPath).size;
    const sizeMB = (stats / (1024 * 1024)).toFixed(2);
    console.log(`   📦 Size: ${sizeMB} MB`);
    
    return { target: target.name, path: outputPath, size: sizeMB, success: true };
    
  } catch (error) {
    console.error(`❌ Failed to build ${target.name}:`, error.message);
    return { target: target.name, success: false, error: error.message };
  }
}

async function buildSingleTarget(targetName) {
  const target = BUILD_TARGETS.find(t => t.name === targetName);
  if (!target) {
    console.error(`❌ Unknown target: ${targetName}`);
    console.log("Available targets:", BUILD_TARGETS.map(t => t.name).join(", "));
    process.exit(1);
  }
  
  await cleanOutput();
  const result = await buildExecutable(target);
  
  if (result.success) {
    console.log(`\n🎉 Successfully built ${targetName} executable!`);
    console.log(`📍 Location: ${result.path}`);
  } else {
    console.error(`\n💥 Build failed for ${targetName}`);
    process.exit(1);
  }
}

async function buildAllTargets() {
  await cleanOutput();
  
  console.log(`🚀 Building executables for ${BUILD_TARGETS.length} platforms...`);
  console.log(`⚙️  Options: minify=${BUILD_OPTIONS.minify}, sourcemap=${BUILD_OPTIONS.sourcemap}\n`);
  
  const results = [];
  
  // Build all targets in parallel for speed
  const buildPromises = BUILD_TARGETS.map(target => buildExecutable(target));
  const buildResults = await Promise.all(buildPromises);
  
  results.push(...buildResults);
  
  // Summary
  console.log("\n📊 Build Summary:");
  console.log("==================");
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log("✅ Successfully built:");
    successful.forEach(r => {
      console.log(`   ${r.target}: ${r.path} (${r.size} MB)`);
    });
  }
  
  if (failed.length > 0) {
    console.log("\n❌ Failed builds:");
    failed.forEach(r => {
      console.log(`   ${r.target}: ${r.error}`);
    });
  }
  
  console.log(`\n📦 Total executables: ${successful.length}/${BUILD_TARGETS.length}`);
  
  if (failed.length > 0) {
    process.exit(1);
  }
}

async function showHelp() {
  console.log(`
🏗️  Bun Executable Builder

Usage:
  bun scripts/build-executables.js [options]

Options:
  --minify           Enable minification for smaller executables
  --sourcemap        Generate source maps for debugging
  --debug            Enable debug output
  --single <target>  Build only specific target platform
  --help             Show this help message

Available targets:
  ${BUILD_TARGETS.map(t => `${t.name.padEnd(15)} (${t.target})`).join('\n  ')}

Examples:
  bun scripts/build-executables.js                    # Build all platforms
  bun scripts/build-executables.js --minify          # Build all with minification
  bun scripts/build-executables.js --single linux-x64 # Build only Linux x64
`);
}

// Main execution
async function main() {
  if (process.argv.includes("--help")) {
    await showHelp();
    return;
  }
  
  // Verify entry point exists
  if (!existsSync(ENTRY_POINT)) {
    console.error(`❌ Entry point not found: ${ENTRY_POINT}`);
    process.exit(1);
  }
  
  console.log("🎯 Bun Executable Builder");
  console.log(`📄 Entry point: ${ENTRY_POINT}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);
  
  if (BUILD_OPTIONS.single) {
    await buildSingleTarget(BUILD_OPTIONS.single);
  } else {
    await buildAllTargets();
  }
}

// Run the script
main().catch(error => {
  console.error("💥 Build script failed:", error);
  process.exit(1);
});