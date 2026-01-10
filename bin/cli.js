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
const VERSION_URL = `https://raw.githubusercontent.com/${REPO}/main/package.json`;

console.log('\n🐙 Olly Molly - Your AI Development Team\n');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const get = (downloadUrl) => {
            https.get(downloadUrl, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    get(res.headers.location);
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        reject(new Error('Invalid JSON'));
                    }
                });
            }).on('error', reject);
        };
        get(url);
    });
}

function downloadAndExtract(url, destDir) {
    return new Promise((resolve, reject) => {
        const tempFile = path.join(os.tmpdir(), 'olly-molly.tar.gz');
        const file = fs.createWriteStream(tempFile);
        
        console.log('📥 Downloading...');
        
        const download = (downloadUrl) => {
            https.get(downloadUrl, (response) => {
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
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    try {
                        execSync(`tar -xzf "${tempFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' });
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

async function getLocalVersion() {
    const pkgPath = path.join(APP_DIR, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return pkg.version;
    } catch {
        return null;
    }
}

async function main() {
    try {
        // Check remote version
        let remoteVersion = null;
        try {
            const remotePkg = await fetchJSON(VERSION_URL);
            remoteVersion = remotePkg.version;
        } catch {
            // Offline or error - continue with local
        }

        const localVersion = await getLocalVersion();
        
        // Auto-update if versions differ
        if (localVersion && remoteVersion && localVersion !== remoteVersion) {
            console.log(`🔄 New version available: ${localVersion} → ${remoteVersion}\n`);
            console.log('   Updating...\n');
            fs.rmSync(APP_DIR, { recursive: true, force: true });
        }

        // Download if not exists
        if (!fs.existsSync(APP_DIR)) {
            console.log('📦 Downloading Olly Molly...\n');
            await downloadAndExtract(TARBALL_URL, APP_DIR);
            console.log('✅ Downloaded!\n');
        }

        // Install dependencies if needed
        const nodeModulesPath = path.join(APP_DIR, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            console.log('📦 Installing dependencies...\n');
            execSync('npm install --omit=dev', { cwd: APP_DIR, stdio: 'inherit' });
        }

        // Build if needed
        const nextPath = path.join(APP_DIR, '.next');
        if (!fs.existsSync(nextPath)) {
            console.log('🔨 Building (first time only)...\n');
            execSync('npm run build', { cwd: APP_DIR, stdio: 'inherit' });
        }

        console.log('\n🚀 http://localhost:1234\n');

        // Start server
        const server = spawn('npx', ['next', 'start', '--port', '1234'], {
            cwd: APP_DIR,
            stdio: 'inherit'
        });

        server.on('close', (code) => process.exit(code || 0));
        process.on('SIGINT', () => { server.kill('SIGINT'); });
        process.on('SIGTERM', () => { server.kill('SIGTERM'); });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
