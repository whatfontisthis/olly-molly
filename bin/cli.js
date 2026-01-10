#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

const REPO = 'ruucm/olly-molly';
const APP_DIR = path.join(os.homedir(), '.olly-molly');
const TARBALL_URL = `https://github.com/${REPO}/archive/refs/heads/main.tar.gz`;
const VERSION_URL = `https://raw.githubusercontent.com/${REPO}/main/package.json`;

console.log('\n🐙 Olly Molly\n');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const get = (u) => {
            https.get(u, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) return get(res.headers.location);
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(); } });
            }).on('error', reject);
        };
        get(url);
    });
}

function download(url, destDir) {
    return new Promise((resolve, reject) => {
        const tmp = path.join(os.tmpdir(), 'olly-molly.tar.gz');
        const file = fs.createWriteStream(tmp);
        const get = (u) => {
            https.get(u, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) return get(res.headers.location);
                if (res.statusCode !== 200) return reject(new Error('Download failed'));
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    fs.mkdirSync(destDir, { recursive: true });
                    execSync(`tar -xzf "${tmp}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' });
                    fs.unlinkSync(tmp);
                    resolve();
                });
            }).on('error', reject);
        };
        get(url);
    });
}

function getLocalVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
        return pkg.version;
    } catch { return null; }
}

async function main() {
    let needsInstall = false;
    let needsBuild = false;

    // Check for updates
    const localVersion = getLocalVersion();
    let remoteVersion = null;
    
    try {
        remoteVersion = (await fetchJSON(VERSION_URL)).version;
    } catch {
        // Offline - continue with local
    }

    // Update if version changed
    if (localVersion && remoteVersion && localVersion !== remoteVersion) {
        console.log(`🔄 Updating ${localVersion} → ${remoteVersion}\n`);
        fs.rmSync(APP_DIR, { recursive: true, force: true });
        needsInstall = true;
        needsBuild = true;
    }

    // Download if needed
    if (!fs.existsSync(APP_DIR)) {
        console.log('📥 Downloading...');
        await download(TARBALL_URL, APP_DIR);
        console.log('✅ Done\n');
        needsInstall = true;
        needsBuild = true;
    }

    // Install if needed
    if (needsInstall || !fs.existsSync(path.join(APP_DIR, 'node_modules'))) {
        console.log('📦 Installing dependencies...\n');
        execSync('npm install --omit=dev', { cwd: APP_DIR, stdio: 'inherit' });
    }

    // Build if needed
    if (needsBuild || !fs.existsSync(path.join(APP_DIR, '.next'))) {
        console.log('\n🔨 Building...\n');
        execSync('npm run build', { cwd: APP_DIR, stdio: 'inherit' });
    }

    console.log('\n🚀 http://localhost:1234\n');

    const server = spawn('npx', ['next', 'start', '--port', '1234'], {
        cwd: APP_DIR, stdio: 'inherit'
    });

    server.on('close', (code) => process.exit(code || 0));
    process.on('SIGINT', () => server.kill('SIGINT'));
    process.on('SIGTERM', () => server.kill('SIGTERM'));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
