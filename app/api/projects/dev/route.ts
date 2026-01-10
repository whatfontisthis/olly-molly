import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { projectService } from '@/lib/db';

// Track running dev servers: projectId -> process info
const runningDevServers = new Map<string, {
    process: ChildProcess;
    port: number;
    output: string;
}>();

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
        const { action, projectId, projectName, parentPath } = body;

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

            // Check if already running
            if (runningDevServers.has(projectId)) {
                const server = runningDevServers.get(projectId)!;
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

            const port = await findAvailablePort(3001);

            // Start npm run dev
            const devProcess = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
                cwd: project.path,
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
            });

            const serverInfo = {
                process: devProcess,
                port,
                output: '',
            };

            runningDevServers.set(projectId, serverInfo);

            devProcess.stdout?.on('data', (data) => {
                serverInfo.output += data.toString();
            });

            devProcess.stderr?.on('data', (data) => {
                serverInfo.output += data.toString();
            });

            devProcess.on('close', () => {
                runningDevServers.delete(projectId);
            });

            devProcess.on('error', () => {
                runningDevServers.delete(projectId);
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

            const server = runningDevServers.get(projectId);
            if (server) {
                try {
                    // Kill the process and its children
                    process.kill(-server.process.pid!, 'SIGTERM');
                } catch {
                    server.process.kill('SIGTERM');
                }
                runningDevServers.delete(projectId);
            }

            return NextResponse.json({ success: true, running: false });

        } else if (action === 'status') {
            // Check if dev server is running
            if (!projectId) {
                return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
            }

            const server = runningDevServers.get(projectId);
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

    if (!projectId) {
        // Return all running servers
        const servers: { projectId: string; port: number; url: string }[] = [];
        runningDevServers.forEach((info, id) => {
            servers.push({
                projectId: id,
                port: info.port,
                url: `http://localhost:${info.port}`,
            });
        });
        return NextResponse.json({ servers });
    }

    const server = runningDevServers.get(projectId);
    if (server) {
        return NextResponse.json({
            running: true,
            port: server.port,
            url: `http://localhost:${server.port}`,
        });
    }

    return NextResponse.json({ running: false });
}
