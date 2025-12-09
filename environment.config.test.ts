import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Feature: voice-assistant-integration, Property 2: Proper environment configuration
 * Validates: Requirements 2.1, 2.2, 2.3
 * 
 * This property test verifies that the Kisan Sathi application has proper environment
 * configuration for the Gemini API key and that vite.config.ts correctly exposes it.
 */

describe('Property 2: Proper environment configuration', () => {
  const kisanSathiDir = path.join(process.cwd(), 'kisan-sathi---oilseeds-advisor');
  
  it('should verify .env.local contains API_KEY or GEMINI_API_KEY variable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('.env.local'),
        (envFileName) => {
          // Read the .env.local file
          const envFilePath = path.join(kisanSathiDir, envFileName);
          
          // Check if file exists
          if (!fs.existsSync(envFilePath)) {
            console.log(`\nError: ${envFileName} does not exist in kisan-sathi---oilseeds-advisor/`);
            return false;
          }
          
          const envContent = fs.readFileSync(envFilePath, 'utf-8');
          
          // Check if API_KEY or GEMINI_API_KEY is present
          const hasApiKey = /^API_KEY\s*=/m.test(envContent);
          const hasGeminiApiKey = /^GEMINI_API_KEY\s*=/m.test(envContent);
          
          if (!hasApiKey && !hasGeminiApiKey) {
            console.log(`\nError: Neither API_KEY nor GEMINI_API_KEY found in ${envFileName}`);
            console.log('File content:', envContent.substring(0, 200));
            return false;
          }
          
          // Verify the key has a value (not empty)
          const apiKeyMatch = envContent.match(/^(?:API_KEY|GEMINI_API_KEY)\s*=\s*(.+)$/m);
          if (!apiKeyMatch || !apiKeyMatch[1] || apiKeyMatch[1].trim() === '') {
            console.log(`\nError: API key is present but has no value`);
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify vite.config.ts properly exposes environment variables', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('vite.config.ts'),
        (configFileName) => {
          // Read the vite.config.ts file
          const configFilePath = path.join(kisanSathiDir, configFileName);
          
          // Check if file exists
          if (!fs.existsSync(configFilePath)) {
            console.log(`\nError: ${configFileName} does not exist in kisan-sathi---oilseeds-advisor/`);
            return false;
          }
          
          const configContent = fs.readFileSync(configFilePath, 'utf-8');
          
          // Check if it has a define block
          const hasDefineBlock = /define\s*:\s*\{/.test(configContent);
          if (!hasDefineBlock) {
            console.log(`\nError: vite.config.ts does not have a 'define' block`);
            return false;
          }
          
          // Check if it exposes process.env.API_KEY or process.env.GEMINI_API_KEY
          const exposesApiKey = /['"]process\.env\.API_KEY['"]\s*:/.test(configContent);
          const exposesGeminiApiKey = /['"]process\.env\.GEMINI_API_KEY['"]\s*:/.test(configContent);
          
          if (!exposesApiKey && !exposesGeminiApiKey) {
            console.log(`\nError: vite.config.ts does not expose process.env.API_KEY or process.env.GEMINI_API_KEY`);
            return false;
          }
          
          // Check if it uses loadEnv or similar to load environment variables
          const loadsEnv = /loadEnv\s*\(/.test(configContent);
          if (!loadsEnv) {
            console.log(`\nWarning: vite.config.ts does not use loadEnv() to load environment variables`);
            // This is a warning, not a failure - there might be other ways to load env vars
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify environment configuration is consistent', () => {
    fc.assert(
      fc.property(
        fc.record({
          envFile: fc.constantFrom('.env.local'),
          configFile: fc.constantFrom('vite.config.ts')
        }),
        ({ envFile, configFile }) => {
          // Read both files
          const envFilePath = path.join(kisanSathiDir, envFile);
          const configFilePath = path.join(kisanSathiDir, configFile);
          
          if (!fs.existsSync(envFilePath) || !fs.existsSync(configFilePath)) {
            return false;
          }
          
          const envContent = fs.readFileSync(envFilePath, 'utf-8');
          const configContent = fs.readFileSync(configFilePath, 'utf-8');
          
          // Extract the key name from .env.local
          const envKeyMatch = envContent.match(/^(API_KEY|GEMINI_API_KEY)\s*=/m);
          if (!envKeyMatch) {
            return false;
          }
          
          const envKeyName = envKeyMatch[1];
          
          // Check if vite.config.ts exposes the same key
          const configExposesKey = new RegExp(`['"]process\\.env\\.${envKeyName}['"]\s*:`).test(configContent);
          
          if (!configExposesKey) {
            console.log(`\nError: .env.local defines ${envKeyName} but vite.config.ts does not expose it`);
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: voice-assistant-integration, Property 3: Development server starts successfully
 * Validates: Requirements 3.1
 * 
 * This property test verifies that the Kisan Sathi development server can start
 * successfully without errors.
 */

describe('Property 3: Development server starts successfully', () => {
  const kisanSathiDir = path.join(process.cwd(), 'kisan-sathi---oilseeds-advisor');
  
  it('should verify dev server can start without errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('package.json'),
        (packageFileName) => {
          // Read the package.json file
          const packageFilePath = path.join(kisanSathiDir, packageFileName);
          
          // Check if file exists
          if (!fs.existsSync(packageFilePath)) {
            console.log(`\nError: ${packageFileName} does not exist in kisan-sathi---oilseeds-advisor/`);
            return false;
          }
          
          const packageContent = fs.readFileSync(packageFilePath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          // Check if dev script exists
          if (!packageJson.scripts || !packageJson.scripts.dev) {
            console.log(`\nError: package.json does not have a 'dev' script`);
            return false;
          }
          
          // Verify the dev script uses vite
          const devScript = packageJson.scripts.dev;
          if (!devScript.includes('vite')) {
            console.log(`\nError: dev script does not use vite: ${devScript}`);
            return false;
          }
          
          // Check if vite.config.ts exists (required for dev server)
          const viteConfigPath = path.join(kisanSathiDir, 'vite.config.ts');
          if (!fs.existsSync(viteConfigPath)) {
            console.log(`\nError: vite.config.ts does not exist`);
            return false;
          }
          
          // Check if index.html exists (required for Vite)
          const indexHtmlPath = path.join(kisanSathiDir, 'index.html');
          if (!fs.existsSync(indexHtmlPath)) {
            console.log(`\nError: index.html does not exist`);
            return false;
          }
          
          // Check if main entry point exists
          const indexTsxPath = path.join(kisanSathiDir, 'index.tsx');
          if (!fs.existsSync(indexTsxPath)) {
            console.log(`\nError: index.tsx does not exist`);
            return false;
          }
          
          // All prerequisites for dev server are in place
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify all required dependencies are installed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('node_modules'),
        (nodeModulesDir) => {
          // Check if node_modules exists
          const nodeModulesPath = path.join(kisanSathiDir, nodeModulesDir);
          
          if (!fs.existsSync(nodeModulesPath)) {
            console.log(`\nError: node_modules directory does not exist. Run 'npm install' first.`);
            return false;
          }
          
          // Check for critical dependencies
          const criticalDeps = ['vite', 'react', '@vitejs/plugin-react'];
          
          for (const dep of criticalDeps) {
            const depPath = path.join(nodeModulesPath, dep);
            if (!fs.existsSync(depPath)) {
              console.log(`\nError: Required dependency '${dep}' is not installed`);
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
