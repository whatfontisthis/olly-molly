#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_NAME = 'olly-molly';
const REPO_URL = 'https://github.com/ruucm/olly-molly.git';
const APP_DIR = path.join(os.homedir(), '.olly-molly');

console.log('\n🐙 Olly Molly - Your AI Development Team\n');

// Check if app is installed locally
if (!fs.existsSync(APP_DIR)) {
    console.log('📦 First run - downloading Olly Molly...\n');
    try {
        execSync(`git clone --depth 1 ${REPO_URL} "${APP_DIR}"`, { 
            stdio: 'inherit' 
        });
    } catch (error) {
        console.error('❌ Failed to download. Make sure git is installed.');
        process.exit(1);
    }
}

// Check for updates (pull latest)
const args = process.argv.slice(2);
if (args.includes('--update') || args.includes('-u')) {
    console.log('🔄 Updating Olly Molly...\n');
    try {
        execSync('git pull origin main', { 
            cwd: APP_DIR, 
            stdio: 'inherit' 
        });
        // Clear build cache after update
        const nextDir = path.join(APP_DIR, '.next');
        if (fs.existsSync(nextDir)) {
            fs.rmSync(nextDir, { recursive: true, force: true });
        }
        console.log('✅ Updated! Rebuilding...\n');
    } catch (error) {
        console.error('⚠️  Update failed, continuing with current version');
    }
}

// Install dependencies if needed
const nodeModulesPath = path.join(APP_DIR, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Installing dependencies...\n');
    try {
        execSync('npm install', { 
            cwd: APP_DIR, 
            stdio: 'inherit' 
        });
    } catch (error) {
        console.error('❌ Failed to install dependencies');
        process.exit(1);
    }
}

// Build if needed
const nextPath = path.join(APP_DIR, '.next');
if (!fs.existsSync(nextPath)) {
    console.log('🔨 Building app (first time only)...\n');
    try {
        execSync('npm run build', { 
            cwd: APP_DIR, 
            stdio: 'inherit' 
        });
    } catch (error) {
        console.error('❌ Failed to build');
        process.exit(1);
    }
}

console.log('🚀 Starting on http://localhost:1234\n');
console.log('   Press Ctrl+C to stop');
console.log('   Run "npx olly-molly --update" to get latest version\n');

// Start the server
const server = spawn('npm', ['run', 'start', '--', '--port', '1234'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    shell: true
});

server.on('error', (error) => {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
});

server.on('close', (code) => {
    process.exit(code || 0);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Bye!');
    server.kill('SIGINT');
});

process.on('SIGTERM', () => {
    server.kill('SIGTERM');
});
