#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const packageDir = path.dirname(__dirname);

console.log('\n🐙 Olly Molly - Your AI Development Team\n');

// Check if .next build exists
const nextPath = path.join(packageDir, '.next');
if (!fs.existsSync(nextPath)) {
    console.error('❌ Build not found. Please report this issue.');
    console.error('   The package should include a pre-built version.');
    process.exit(1);
}

// Ensure db directory exists for SQLite
const dbDir = path.join(packageDir, 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log('🚀 Starting on http://localhost:1234\n');
console.log('   Press Ctrl+C to stop\n');

// Start the production server
const server = spawn('npx', ['next', 'start', '--port', '1234'], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        NODE_ENV: 'production'
    }
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
    console.log('\n👋 Shutting down...');
    server.kill('SIGINT');
});

process.on('SIGTERM', () => {
    server.kill('SIGTERM');
});
