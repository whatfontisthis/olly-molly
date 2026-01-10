#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const packageDir = path.dirname(__dirname);

console.log('\n🐙 Olly Molly - Your AI Development Team\n');

// Check if node_modules exists, if not install
const nodeModulesPath = path.join(packageDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Installing dependencies...\n');
    try {
        execSync('npm install', { 
            cwd: packageDir, 
            stdio: 'inherit' 
        });
    } catch (error) {
        console.error('❌ Failed to install dependencies');
        process.exit(1);
    }
}

// Check if .next build exists, if not build
const nextPath = path.join(packageDir, '.next');
if (!fs.existsSync(nextPath)) {
    console.log('🔨 Building app...\n');
    try {
        execSync('npm run build', { 
            cwd: packageDir, 
            stdio: 'inherit' 
        });
    } catch (error) {
        console.error('❌ Failed to build app');
        process.exit(1);
    }
}

// Start the server
console.log('🚀 Starting Olly Molly on http://localhost:1234\n');

const server = spawn('npm', ['run', 'start', '--', '--port', '1234'], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: true
});

server.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
});

server.on('close', (code) => {
    process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    server.kill('SIGINT');
});

process.on('SIGTERM', () => {
    server.kill('SIGTERM');
});
