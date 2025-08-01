/**
 * Bun Build Configuration for Executable Compilation
 * Optimized for standalone executables with dependency bundling
 */

export default {
  // Entry points for different build targets
  entrypoints: ["src/index.ts"],
  
  // Output configuration
  outdir: "dist",
  
  // Target configurations for executables
  targets: {
    // Development build (fast compilation)
    dev: {
      target: "node",
      format: "esm",
      splitting: true,
      sourcemap: true,
      minify: false
    },
    
    // Production build (optimized)
    prod: {
      target: "node", 
      format: "esm",
      splitting: false,
      sourcemap: false,
      minify: true,
      treeshaking: true
    },
    
    // Executable builds
    executable: {
      compile: true,
      minify: true,
      treeshaking: true,
      sourcemap: false,
      // Bundle all dependencies except native modules
      external: []
    }
  },
  
  // Optimization settings for executables
  executable: {
    // Compression settings
    compression: {
      algorithm: "gzip",
      level: 9
    },
    
    // Runtime optimizations
    runtime: {
      // Enable all Bun optimizations
      jsc: {
        minify: {
          compress: {
            arguments: true,
            booleans: true,
            collapse_vars: true,
            comparisons: true,
            computed_props: true,
            conditionals: true,
            dead_code: true,
            drop_console: false, // Keep console for proxy logs
            drop_debugger: true,
            evaluate: true,
            hoist_funs: true,
            hoist_props: true,
            hoist_vars: false,
            if_return: true,
            inline: true,
            join_vars: true,
            loops: true,
            negate_iife: true,
            properties: true,
            reduce_funcs: true,
            reduce_vars: true,
            sequences: true,
            side_effects: true,
            switches: true,
            typeofs: true,
            unused: true
          },
          mangle: {
            // Keep function names for debugging proxy issues
            keep_fnames: true,
            keep_classnames: true
          }
        }
      }
    },
    
    // Platform-specific optimizations
    platforms: {
      linux: {
        cflags: ["-O3", "-flto"],
        linkflags: ["-s", "-static-libgcc"]
      },
      darwin: {
        cflags: ["-O3", "-flto"],
        linkflags: ["-dead_strip"]
      },
      windows: {
        cflags: ["/O2", "/GL"],
        linkflags: ["/LTCG", "/OPT:REF", "/OPT:ICF"]
      }
    }
  },
  
  // Define globals for the executable environment
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.BUNDLE_TYPE": '"executable"'
  },
  
  // Loader configuration for different file types
  loader: {
    ".ts": "ts",
    ".js": "js",
    ".json": "json"
  },
  
  // Plugin configuration
  plugins: [
    // Custom plugin for executable optimizations
    {
      name: "executable-optimizer",
      setup(build) {
        // Log build information
        build.onStart(() => {
          console.log("🚀 Starting executable build with Bun optimizations...");
        });
        
        // Optimize imports for bundling
        build.onResolve({ filter: /.*/ }, (args) => {
          // Bundle Node.js built-ins when compiling to executable
          if (args.kind === "import-statement" && !args.path.startsWith(".")) {
            return {
              path: args.path,
              external: false // Include in bundle for executables
            };
          }
        });
        
        build.onEnd((result) => {
          if (result.errors.length === 0) {
            console.log("✅ Executable build completed successfully!");
          } else {
            console.error("❌ Build failed with errors:", result.errors);
          }
        });
      }
    }
  ],
  
  // Bundle analysis options
  analyze: {
    // Generate bundle analysis when NODE_ENV=development
    enabled: process.env.NODE_ENV === "development",
    open: false,
    filename: "bundle-analysis.html"
  }
};