import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { projectService } from '@/lib/db';

const ROOT_RELATIVE_PATH = '.';

function normalizeRelativePath(relativePath?: string | null): string {
    if (!relativePath) return ROOT_RELATIVE_PATH;
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized || ROOT_RELATIVE_PATH;
}

function getServerKey(projectId: string, relativePath?: string | null): string {
    return `${projectId}:${normalizeRelativePath(relativePath)}`;
}

function resolveProjectPath(projectRoot: string, relativePath?: string | null): string {
    const root = path.resolve(projectRoot);
    const normalized = normalizeRelativePath(relativePath);
    const resolved = path.resolve(root, normalized);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error('Invalid path');
    }
    return resolved;
}

// Track running dev servers: projectId+path -> process info
const runningDevServers = new Map<string, {
    process: ChildProcess;
    port: number;
    output: string;
    projectId: string;
    relativePath: string;
}>();

/**
 * Detect externally running dev server for a project
 * Uses lsof to find node processes with cwd matching the project path
 * and then checks which port they are listening on
 */
function detectExternalDevServer(targetPath: string): { running: boolean; port?: number; pid?: number } {
    try {
        const isWindows = process.platform === 'win32';

        if (isWindows) {
            // Windows detection is more complex, skip for now
            return { running: false };
        }

        // Step 1: Find node processes with cwd matching target path
        // lsof -c node -a -d cwd outputs lines like:
        // node    95847 user  cwd    DIR   1,13  544 96780203 /path/to/project
        let cwdResult: string;
        try {
            cwdResult = execSync('lsof -c node -a -d cwd 2>/dev/null', {
                encoding: 'utf-8',
                timeout: 5000,
            });
        } catch {
            return { running: false };
        }

        if (!cwdResult.trim()) return { running: false };

        const lines = cwdResult.trim().split('\n');
        const pids = new Set<number>();
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const pid = parseInt(parts[1], 10);
                if (isNaN(pid)) continue;
                const cwdMatch = line.match(/\s(\/.*)$/);
                const cwdPath = cwdMatch ? cwdMatch[1] : parts[parts.length - 1];
                if (cwdPath === targetPath) {
                    pids.add(pid);
                }
            }
        }

        if (pids.size === 0) {
            return { running: false };
        }

        // Step 2: Find which port these processes are listening on
        for (const pid of pids) {
            try {
                const listenResult = execSync(`lsof -i -P -n -a -p ${pid} 2>/dev/null | grep LISTEN`, {
                    encoding: 'utf-8',
                    timeout: 5000,
                });

                // Parse port from output like:
                // node    95847 user   13u  IPv6 ... TCP *:3001 (LISTEN)
                const portMatch = listenResult.match(/:(\d+)\s+\(LISTEN\)/);
                if (portMatch) {
                    const port = parseInt(portMatch[1], 10);
                    if (!isNaN(port)) {
                        return { running: true, port, pid };
                    }
                }
            } catch {
                // This PID is not listening on any port, try next
                continue;
            }
        }

        // Processes found but no listening port detected
        return { running: true, pid: Array.from(pids)[0] };
    } catch (error) {
        console.error('Error detecting external dev server:', error);
        return { running: false };
    }
}

// Find available port
async function findAvailablePort(startPort: number = 3000): Promise<number> {
    const net = await import('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = (server.address() as { port: number }).port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

// Create new Next.js project
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, projectId, projectName, parentPath, path: relativePath } = body;

        if (action === 'create') {
            // Create new Next.js project
            if (!projectName) {
                return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
            }

            // Use home directory + Projects folder as default
            const basePath = parentPath || path.join(os.homedir(), 'Projects');

            // Ensure base path exists
            if (!fs.existsSync(basePath)) {
                fs.mkdirSync(basePath, { recursive: true });
            }

            const projectPath = path.join(basePath, projectName);

            // Check if project already exists
            if (fs.existsSync(projectPath)) {
                return NextResponse.json({ error: 'Project already exists at this location' }, { status: 400 });
            }

            // Run npx create-next-app with default settings (non-interactive)
            return new Promise<NextResponse>((resolve) => {
                // Use -- to separate npx args from create-next-app args
                const fullCommand = `npx -y create-next-app@latest "${projectPath}" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes`;

                const npxProcess = spawn(fullCommand, [], {
                    cwd: basePath,
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                // Answer any prompts with enter (use defaults)
                npxProcess.stdin?.write('\n\n\n\n\n');
                npxProcess.stdin?.end();

                let output = '';
                let errorOutput = '';

                npxProcess.stdout?.on('data', (data) => {
                    output += data.toString();
                });

                npxProcess.stderr?.on('data', (data) => {
                    errorOutput += data.toString();
                });

                npxProcess.on('close', async (code) => {
                    if (code === 0) {
                        // Register the project
                        try {
                            const project = projectService.create({
                                name: projectName,
                                path: projectPath,
                                description: 'Next.js project',
                            });
                            resolve(NextResponse.json({
                                success: true,
                                project,
                                output,
                            }));
                        } catch (dbError) {
                            resolve(NextResponse.json({
                                success: true,
                                path: projectPath,
                                output,
                                warning: 'Project created but failed to register',
                            }));
                        }
                    } else {
                        resolve(NextResponse.json({
                            error: 'Failed to create project',
                            output: errorOutput || output,
                        }, { status: 500 }));
                    }
                });

                npxProcess.on('error', (err) => {
                    resolve(NextResponse.json({
                        error: 'Failed to start create-next-app',
                        details: err.message,
                    }, { status: 500 }));
                });
            });

        } else if (action === 'start') {
            // Start dev server
            if (!projectId) {
                return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
            }

            const normalizedPath = normalizeRelativePath(relativePath);
            const serverKey = getServerKey(projectId, normalizedPath);

            // Check if already running
            if (runningDevServers.has(serverKey)) {
                const server = runningDevServers.get(serverKey)!;
                return NextResponse.json({
                    success: true,
                    running: true,
                    port: server.port,
                    url: `http://localhost:${server.port}`,
                });
            }

            // Get project path
            const project = projectService.getById(projectId);
            if (!project) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }

            let workingDir: string;
            try {
                workingDir = resolveProjectPath(project.path, normalizedPath);
            } catch {
                return NextResponse.json({ error: 'Invalid project path' }, { status: 400 });
            }

            if (!fs.existsSync(workingDir) || !fs.statSync(workingDir).isDirectory()) {
                return NextResponse.json({ error: 'Target path is not a directory' }, { status: 400 });
            }

            const packageJsonPath = path.join(workingDir, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                return NextResponse.json({ error: 'package.json not found in target path' }, { status: 400 });
            }
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (!packageJson?.scripts?.dev) {
                    return NextResponse.json({ error: 'No dev script found in package.json' }, { status: 400 });
                }
            } catch {
                return NextResponse.json({ error: 'Failed to read package.json' }, { status: 400 });
            }

            const port = await findAvailablePort(3001);

            // Start npm run dev
            const devProcess = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
                cwd: workingDir,
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
            });

            const serverInfo = {
                process: devProcess,
                port,
                output: '',
                projectId,
                relativePath: normalizedPath,
            };

            runningDevServers.set(serverKey, serverInfo);

            devProcess.stdout?.on('data', (data) => {
                serverInfo.output += data.toString();
            });

            devProcess.stderr?.on('data', (data) => {
                serverInfo.output += data.toString();
            });

            devProcess.on('close', () => {
                runningDevServers.delete(serverKey);
            });

            devProcess.on('error', () => {
                runningDevServers.delete(serverKey);
            });

            return NextResponse.json({
                success: true,
                running: true,
                port,
                url: `http://localhost:${port}`,
            });

        } else if (action === 'stop') {
            // Stop dev server
            if (!projectId) {
                return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
            }

            const normalizedPath = normalizeRelativePath(relativePath);
            const serverKey = getServerKey(projectId, normalizedPath);
            const server = runningDevServers.get(serverKey);
            if (server) {
                try {
                    // Kill the process and its children
                    process.kill(-server.process.pid!, 'SIGTERM');
                } catch {
                    server.process.kill('SIGTERM');
                }
                runningDevServers.delete(serverKey);
                return NextResponse.json({ success: true, running: false });
            }

            // Check for externally running server and kill it
            const project = projectService.getById(projectId);
            if (project) {
                let targetPath: string;
                try {
                    targetPath = resolveProjectPath(project.path, normalizedPath);
                } catch {
                    return NextResponse.json({ error: 'Invalid project path' }, { status: 400 });
                }
                const externalServer = detectExternalDevServer(targetPath);
                if (externalServer.running && externalServer.pid) {
                    try {
                        // Kill the external process
                        process.kill(externalServer.pid, 'SIGTERM');
                        return NextResponse.json({ success: true, running: false });
                    } catch (error) {
                        console.error('Failed to kill external dev server:', error);
                        return NextResponse.json({ error: 'Failed to stop external server' }, { status: 500 });
                    }
                }
            }

            return NextResponse.json({ success: true, running: false });

        } else if (action === 'status') {
            // Check if dev server is running
            if (!projectId) {
                return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
            }

            const normalizedPath = normalizeRelativePath(relativePath);
            const serverKey = getServerKey(projectId, normalizedPath);
            const server = runningDevServers.get(serverKey);
            if (server) {
                return NextResponse.json({
                    running: true,
                    port: server.port,
                    url: `http://localhost:${server.port}`,
                    output: server.output.slice(-2000), // Last 2000 chars
                });
            }

            return NextResponse.json({ running: false });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Dev server error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const relativePath = searchParams.get('path');

    if (!projectId) {
        // Return all running servers
        const servers: { projectId: string; path: string; port: number; url: string }[] = [];
        runningDevServers.forEach((info, id) => {
            servers.push({
                projectId: info.projectId,
                path: info.relativePath === ROOT_RELATIVE_PATH ? '' : info.relativePath,
                port: info.port,
                url: `http://localhost:${info.port}`,
            });
        });
        return NextResponse.json({ servers });
    }

    const normalizedPath = normalizeRelativePath(relativePath);
    const serverKey = getServerKey(projectId, normalizedPath);
    const server = runningDevServers.get(serverKey);
    if (server) {
        return NextResponse.json({
            running: true,
            port: server.port,
            url: `http://localhost:${server.port}`,
            external: false,
        });
    }

    // Check for externally running dev server
    const project = projectService.getById(projectId);
    if (project) {
        let targetPath: string;
        try {
            targetPath = resolveProjectPath(project.path, normalizedPath);
        } catch {
            return NextResponse.json({ running: false });
        }
        const externalServer = detectExternalDevServer(targetPath);
        if (externalServer.running && externalServer.port) {
            return NextResponse.json({
                running: true,
                port: externalServer.port,
                url: `http://localhost:${externalServer.port}`,
                external: true,
                pid: externalServer.pid,
            });
        }
    }

    return NextResponse.json({ running: false });
}
