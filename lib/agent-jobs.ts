import { spawn, ChildProcess } from 'child_process';
import { agentWorkLogService, activityService, ticketService } from './db';

export type AgentProvider = 'claude' | 'opencode';

const CLAUDE_PATH = '/opt/homebrew/bin/claude';
const OPENCODE_PATH = '/opt/homebrew/bin/opencode';

interface RunningJob {
    id: string;
    workLogId: string;
    ticketId: string;
    agentId: string;
    agentName: string;
    projectPath: string;
    provider: AgentProvider;
    startedAt: Date;
    process: ChildProcess;
    output: string;
    status: 'running' | 'completed' | 'failed';
}

// Store running jobs in memory
const runningJobs = new Map<string, RunningJob>();

export function getRunningJobs(): Omit<RunningJob, 'process'>[] {
    return Array.from(runningJobs.values()).map(job => ({
        id: job.id,
        workLogId: job.workLogId,
        ticketId: job.ticketId,
        agentId: job.agentId,
        agentName: job.agentName,
        projectPath: job.projectPath,
        provider: job.provider,
        startedAt: job.startedAt,
        output: job.output,
        status: job.status,
    }));
}

export function getJobByTicketId(ticketId: string): Omit<RunningJob, 'process'> | null {
    for (const job of runningJobs.values()) {
        if (job.ticketId === ticketId) {
            return {
                id: job.id,
                workLogId: job.workLogId,
                ticketId: job.ticketId,
                agentId: job.agentId,
                agentName: job.agentName,
                projectPath: job.projectPath,
                provider: job.provider,
                startedAt: job.startedAt,
                output: job.output,
                status: job.status,
            };
        }
    }
    return null;
}

export function getJobOutput(jobId: string): string | null {
    const job = runningJobs.get(jobId);
    return job?.output || null;
}

interface StartJobParams {
    jobId: string;
    workLogId: string;
    ticketId: string;
    agentId: string;
    agentName: string;
    projectPath: string;
    prompt: string;
    provider: AgentProvider;
}

export function startBackgroundJob(params: StartJobParams): void {
    const { jobId, workLogId, ticketId, agentId, agentName, projectPath, prompt, provider } = params;

    // Configure command and args based on provider
    let execPath: string;
    let args: string[];
    let startMessage: string;

    if (provider === 'opencode') {
        execPath = OPENCODE_PATH;
        args = ['run', prompt];
        startMessage = `🚀 Starting OpenCode in ${projectPath}...\n\n`;
    } else {
        execPath = CLAUDE_PATH;
        args = ['--print', '--dangerously-skip-permissions', prompt];
        startMessage = `🚀 Starting Claude Code in ${projectPath}...\n\n`;
    }

    const agentProcess = spawn(execPath, args, {
        cwd: projectPath,
        env: { ...process.env, PORT: '3001' },
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const job: RunningJob = {
        id: jobId,
        workLogId,
        ticketId,
        agentId,
        agentName,
        projectPath,
        provider,
        startedAt: new Date(),
        process: agentProcess,
        output: startMessage,
        status: 'running',
    };

    runningJobs.set(jobId, job);

    // Capture stdout
    agentProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        job.output += text;
    });

    // Capture stderr
    agentProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        job.output += `[stderr] ${text}\n`;
    });

    agentProcess.on('close', (code: number | null) => {
        const success = code === 0;
        job.status = success ? 'completed' : 'failed';

        // Extract commit hash from output
        const commitMatch = job.output.match(/commit\s+([a-f0-9]{7,40})/i);
        const commitHash = commitMatch ? commitMatch[1] : undefined;

        // Update work log
        agentWorkLogService.complete(workLogId, {
            status: success ? 'SUCCESS' : 'FAILED',
            output: job.output.slice(0, 50000),
            git_commit_hash: commitHash,
        });

        // Log activity
        activityService.log({
            ticket_id: ticketId,
            member_id: agentId,
            action: success ? 'AGENT_WORK_COMPLETED' : 'AGENT_WORK_FAILED',
            new_value: commitHash,
            details: success
                ? `${agentName} completed the task${commitHash ? ` (commit: ${commitHash})` : ''}`
                : `${agentName} failed to complete the task`,
        });

        // Update ticket status
        if (success) {
            ticketService.update(ticketId, { status: 'IN_REVIEW' }, agentId);
        }

        // Remove from running jobs after a delay (keep for status check)
        setTimeout(() => {
            runningJobs.delete(jobId);
        }, 60000); // Keep completed job info for 1 minute
    });

    agentProcess.on('error', (error: Error) => {
        job.status = 'failed';
        job.output += `\n[error] ${error.message}`;

        agentWorkLogService.complete(workLogId, {
            status: 'FAILED',
            output: job.output,
        });

        activityService.log({
            ticket_id: ticketId,
            member_id: agentId,
            action: 'AGENT_WORK_FAILED',
            details: `${agentName} failed: ${error.message}`,
        });

        setTimeout(() => {
            runningJobs.delete(jobId);
        }, 60000);
    });
}

export function cancelJob(jobId: string): boolean {
    const job = runningJobs.get(jobId);
    if (!job || job.status !== 'running') {
        return false;
    }

    job.process.kill('SIGTERM');
    job.status = 'failed';
    job.output += '\n[cancelled] Job was cancelled by user';

    agentWorkLogService.complete(job.workLogId, {
        status: 'CANCELLED',
        output: job.output,
    });

    activityService.log({
        ticket_id: job.ticketId,
        member_id: job.agentId,
        action: 'AGENT_WORK_CANCELLED',
        details: `${job.agentName}'s work was cancelled`,
    });

    runningJobs.delete(jobId);
    return true;
}
