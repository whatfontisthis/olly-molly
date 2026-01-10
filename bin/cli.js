#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

const APP_NAME = 'olly-molly';
const REPO = 'ruucm/olly-molly';
const APP_DIR = path.join(os.homedir(), '.olly-molly');
const TARBALL_URL = `https://github.com/${REPO}/archive/refs/heads/main.tar.gz`;

console.log('\n🐙 Olly Molly - Your AI Development Team\n');

function downloadAndExtract(url, destDir) {
    return new Promise((resolve, reject) => {
        const tempFile = path.join(os.tmpdir(), 'olly-molly.tar.gz');
        const file = fs.createWriteStream(tempFile);
        
        console.log('📥 Downloading...');
        
        const download = (downloadUrl) => {
            https.get(downloadUrl, (response) => {
                // Handle redirects
                if (response.statusCode === 302 || response.statusCode === 301) {
                    download(response.headers.location);
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed: ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    
                    console.log('📦 Extracting...');
                    
                    // Create dest directory
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    
                    // Extract tarball
                    try {
                        execSync(`tar -xzf "${tempFile}" -C "${destDir}" --strip-components=1`, {
                            stdio: 'pipe'
                        });
                        fs.unlinkSync(tempFile);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            }).on('error', reject);
        };
        
        download(url);
    });
}

async function main() {
    const args = process.argv.slice(2);
    
    // Update flag
    if (args.includes('--update') || args.includes('-u')) {
        console.log('🔄 Updating Olly Molly...\n');
        if (fs.existsSync(APP_DIR)) {
            fs.rmSync(APP_DIR, { recursive: true, force: true });
        }
    }
    
    // Download if not exists
    if (!fs.existsSync(APP_DIR)) {
        console.log('📦 First run - downloading Olly Molly...\n');
        try {
            await downloadAndExtract(TARBALL_URL, APP_DIR);
            console.log('✅ Downloaded!\n');
        } catch (error) {
            console.error('❌ Download failed:', error.message);
            console.error('\n   Make sure the repository is public at:');
            console.error(`   https://github.com/${REPO}\n`);
            process.exit(1);
        }
    }
    
    // Install dependencies if needed
    const nodeModulesPath = path.join(APP_DIR, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('📦 Installing dependencies (first time only)...\n');
        try {
            execSync('npm install --production', { 
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
    
    console.log('\n🚀 Starting on http://localhost:1234\n');
    console.log('   Press Ctrl+C to stop');
    console.log('   Run "npx olly-molly -u" to update\n');
    
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
}

main().catch(console.error);
