#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

const PACKAGE_NAME = 'olly-molly';
const REPO = 'ruucm/olly-molly';
const APP_DIR = path.join(os.homedir(), '.olly-molly');
const DB_DIR = path.join(APP_DIR, 'db');
const TARBALL_URL = `https://github.com/${REPO}/archive/refs/heads/main.tar.gz`;

console.log('\n🐙 Olly Molly\n');

// Get latest version from npm registry
function getNpmVersion() {
    return new Promise((resolve) => {
        https.get(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data).version);
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
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
        return JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')).version;
    } catch { return null; }
}

const CUSTOM_PROFILES_DIR = path.join(APP_DIR, 'custom-profiles');

function backupUserData() {
    const backupDir = path.join(os.tmpdir(), 'olly-molly-backup');
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Backup database
    if (fs.existsSync(DB_DIR)) {
        const dbBackupDir = path.join(backupDir, 'db');
        fs.cpSync(DB_DIR, dbBackupDir, { recursive: true });
    }
    
    // Backup custom profile images
    if (fs.existsSync(CUSTOM_PROFILES_DIR)) {
        const profilesBackupDir = path.join(backupDir, 'custom-profiles');
        fs.cpSync(CUSTOM_PROFILES_DIR, profilesBackupDir, { recursive: true });
    }
    
    return backupDir;
}

function restoreUserData(backupDir) {
    if (!backupDir || !fs.existsSync(backupDir)) return;
    
    // Restore database
    const dbBackupDir = path.join(backupDir, 'db');
    if (fs.existsSync(dbBackupDir)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        for (const file of fs.readdirSync(dbBackupDir)) {
            if (file.includes('.sqlite')) {
                fs.copyFileSync(path.join(dbBackupDir, file), path.join(DB_DIR, file));
            }
        }
    }
    
    // Restore custom profile images
    const profilesBackupDir = path.join(backupDir, 'custom-profiles');
    if (fs.existsSync(profilesBackupDir)) {
        fs.mkdirSync(CUSTOM_PROFILES_DIR, { recursive: true });
        for (const file of fs.readdirSync(profilesBackupDir)) {
            fs.copyFileSync(path.join(profilesBackupDir, file), path.join(CUSTOM_PROFILES_DIR, file));
        }
    }
    
    // Clean up backup
    fs.rmSync(backupDir, { recursive: true, force: true });
}

async function main() {
    let needsInstall = false;
    let needsBuild = false;

    const localVersion = getLocalVersion();
    const npmVersion = await getNpmVersion();

    // Update if npm version is newer
    if (localVersion && npmVersion && localVersion !== npmVersion) {
        console.log(`🔄 Updating ${localVersion} → ${npmVersion}\n`);
        const userDataBackup = backupUserData();
        fs.rmSync(APP_DIR, { recursive: true, force: true });
        console.log('📥 Downloading...');
        await download(TARBALL_URL, APP_DIR);
        console.log('✅ Downloaded\n');
        restoreUserData(userDataBackup);
        needsInstall = true;
        needsBuild = true;
    }

    // First time
    if (!fs.existsSync(APP_DIR)) {
        console.log('📥 Downloading...');
        await download(TARBALL_URL, APP_DIR);
        console.log('✅ Downloaded\n');
        needsInstall = true;
        needsBuild = true;
    }

    // Install
    if (needsInstall || !fs.existsSync(path.join(APP_DIR, 'node_modules'))) {
        console.log('📦 Installing...\n');
        execSync('npm install --omit=dev', { cwd: APP_DIR, stdio: 'inherit' });
    }

    // Build
    if (needsBuild || !fs.existsSync(path.join(APP_DIR, '.next'))) {
        console.log('\n🔨 Building...\n');
        execSync('npm run build', { cwd: APP_DIR, stdio: 'inherit' });
    }

    console.log('\n🚀 http://localhost:1234\n');

    // Auto-open browser after a short delay
    setTimeout(() => {
        const url = 'http://localhost:1234';
        const cmd = process.platform === 'darwin' ? 'open' 
                  : process.platform === 'win32' ? 'start' 
                  : 'xdg-open';
        try {
            execSync(`${cmd} ${url}`, { stdio: 'ignore' });
        } catch {}
    }, 2000);

    const server = spawn('npx', ['next', 'start', '--port', '1234'], {
        cwd: APP_DIR, stdio: 'inherit'
    });

    server.on('close', (code) => process.exit(code || 0));
    process.on('SIGINT', () => server.kill('SIGINT'));
    process.on('SIGTERM', () => server.kill('SIGTERM'));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
