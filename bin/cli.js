#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

const REPO = 'ruucm/olly-molly';
const APP_DIR = path.join(os.homedir(), '.olly-molly');
const DB_DIR = path.join(APP_DIR, 'db');
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

// Backup and restore user's database
function backupDB() {
    const backupDir = path.join(os.tmpdir(), 'olly-molly-db-backup');
    if (fs.existsSync(DB_DIR)) {
        fs.cpSync(DB_DIR, backupDir, { recursive: true });
        return backupDir;
    }
    return null;
}

function restoreDB(backupDir) {
    if (backupDir && fs.existsSync(backupDir)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        // Only restore sqlite files, not schema files
        const files = fs.readdirSync(backupDir);
        for (const file of files) {
            if (file.endsWith('.sqlite') || file.endsWith('.sqlite-shm') || file.endsWith('.sqlite-wal')) {
                fs.copyFileSync(path.join(backupDir, file), path.join(DB_DIR, file));
            }
        }
        fs.rmSync(backupDir, { recursive: true, force: true });
    }
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

    // Update if version changed (preserve DB!)
    if (localVersion && remoteVersion && localVersion !== remoteVersion) {
        console.log(`🔄 Updating ${localVersion} → ${remoteVersion}\n`);
        
        // Backup DB before update
        const dbBackup = backupDB();
        
        // Remove app (but DB is backed up)
        fs.rmSync(APP_DIR, { recursive: true, force: true });
        
        // Download new version
        console.log('📥 Downloading...');
        await download(TARBALL_URL, APP_DIR);
        console.log('✅ Done\n');
        
        // Restore DB
        restoreDB(dbBackup);
        
        needsInstall = true;
        needsBuild = true;
    }

    // First time download
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
