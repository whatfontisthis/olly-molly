import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { conversationService, conversationMessageService, activityService, ticketService } from './db';

export type AgentProvider = 'claude' | 'opencode';

const CLAUDE_CMD = 'claude';
const OPENCODE_CMD = 'opencode';

interface RunningJob {
    id: string;
    conversationId: string;
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
        conversationId: job.conversationId,
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
                conversationId: job.conversationId,
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

// Agent Work Log file name
const WORK_LOG_FILE = 'AGENT_WORK_LOG.md';

interface WorkLogEntry {
    agentName: string;
    agentAvatar: string;
    ticketTitle: string;
    success: boolean;
    commitHash?: string;
    output: string;
}

/**
 * Append a work log entry to the project's AGENT_WORK_LOG.md file
 * New entries are added at the top so the most recent work is first
 */
function appendToWorkLog(projectPath: string, entry: WorkLogEntry): void {
    try {
        const logPath = path.join(projectPath, WORK_LOG_FILE);
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').split('.')[0];

        // Extract summary from output (last few meaningful lines)
        const summaryLines = extractSummary(entry.output);

        // Check for screenshots in .agent-screenshots folder
        const screenshotSection = getScreenshotSection(projectPath);

        // Build the new entry
        const newEntry = `
## ${timestamp} - ${entry.agentName} ${entry.agentAvatar}

**티켓:** ${entry.ticketTitle}
**상태:** ${entry.success ? '✅ 성공' : '❌ 실패'}
${entry.commitHash ? `**커밋:** ${entry.commitHash}` : ''}

### 작업 요약
${summaryLines}
${screenshotSection}
---
`;

        // Check if file exists
        if (fs.existsSync(logPath)) {
            // Read existing content
            const existingContent = fs.readFileSync(logPath, 'utf-8');
            // Find the position after the header (after first ---)
            const headerEndPos = existingContent.indexOf('---');
            if (headerEndPos !== -1) {
                const header = existingContent.substring(0, headerEndPos + 3);
                const rest = existingContent.substring(headerEndPos + 3);
                fs.writeFileSync(logPath, header + newEntry + rest, 'utf-8');
            } else {
                // No separator found, append to end
                fs.writeFileSync(logPath, existingContent + newEntry, 'utf-8');
            }
        } else {
            // Create new file with header
            const header = `# Agent Work Log

이 파일은 AI 에이전트들의 작업 기록입니다. 새로운 에이전트는 작업 전 이 파일을 참고하세요.

---
`;
            fs.writeFileSync(logPath, header + newEntry, 'utf-8');
        }

        console.log(`[agent-jobs] Work log updated: ${logPath}`);
    } catch (error) {
        console.error(`[agent-jobs] Failed to update work log:`, error);
    }
}

// Screenshot folder name
const SCREENSHOT_FOLDER = '.agent-screenshots';

/**
 * Get screenshot section for the work log
 * Looks for recent screenshots in .agent-screenshots folder
 */
function getScreenshotSection(projectPath: string): string {
    try {
        const screenshotDir = path.join(projectPath, SCREENSHOT_FOLDER);

        if (!fs.existsSync(screenshotDir)) {
            return '';
        }

        const files = fs.readdirSync(screenshotDir);
        const imageFiles = files.filter(f =>
            /\.(png|jpg|jpeg|gif|webp)$/i.test(f)
        );

        if (imageFiles.length === 0) {
            return '';
        }

        // Get files modified in the last 10 minutes (likely from current work)
        const recentFiles = imageFiles.filter(f => {
            const filePath = path.join(screenshotDir, f);
            const stats = fs.statSync(filePath);
            const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
            return stats.mtimeMs > tenMinutesAgo;
        });

        const filesToInclude = recentFiles.length > 0 ? recentFiles : imageFiles.slice(-3);

        if (filesToInclude.length === 0) {
            return '';
        }

        const screenshotLinks = filesToInclude.map(f =>
            `![${f}](${SCREENSHOT_FOLDER}/${f})`
        ).join('\n');

        return `\n### 스크린샷\n${screenshotLinks}\n`;
    } catch (error) {
        console.error(`[agent-jobs] Failed to get screenshots:`, error);
        return '';
    }
}

/**
 * Extract a meaningful summary from agent output
 */
function extractSummary(output: string): string {
    // Remove ANSI escape codes
    const cleanOutput = output.replace(/\x1B\[[0-9;]*[mK]/g, '');

    // Lines to filter out (git noise, system messages, etc.)
    const noisePatterns = [
        /^changes not staged/i,
        /^use "git/i,
        /^\(use "git/i,
        /^modified:\s+/i,
        /^deleted:\s+/i,
        /^new file:\s+/i,
        /^on branch/i,
        /^your branch/i,
        /^nothing to commit/i,
        /^untracked files/i,
        /^changes to be committed/i,
        /^\s*$/,
        /^#/,
        /^\[.*\]$/,
        /^🚀/,
        /^✅/,
        /^❌/,
        /^Starting/i,
        /^Running/i,
        /^Executing/i,
    ];

    const lines = cleanOutput.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        return !noisePatterns.some(pattern => pattern.test(trimmed));
    });

    // Priority 1: Look for explicit summary section or commit message
    const summaryPatterns = [
        /^#+\s*summary/i,
        /^summary:/i,
        /completed.*:/i,
        /작업.*완료/i,
        /구현.*:/i,
        /변경.*:/i,
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (summaryPatterns.some(pattern => pattern.test(line))) {
            // Found a summary section, grab next few lines
            const summaryLines = [line];
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                if (lines[j].trim()) {
                    summaryLines.push(lines[j].trim());
                }
            }
            return summaryLines.map(l => `- ${l}`).join('\n');
        }
    }

    // Priority 2: Look for action verbs indicating completed work
    const actionPatterns = [
        /^(created|added|updated|fixed|implemented|removed|refactored|modified)/i,
        /^(생성|추가|수정|구현|삭제|변경|완료)/,
    ];

    const actionLines = lines.filter(line =>
        actionPatterns.some(pattern => pattern.test(line.trim()))
    );

    if (actionLines.length > 0) {
        return actionLines.slice(0, 5).map(l => `- ${l.trim()}`).join('\n');
    }

    // Priority 3: Look for file-related actions (but not git status noise)
    const fileActionLines = lines.filter(line => {
        const l = line.toLowerCase();
        return (l.includes('.tsx') || l.includes('.ts') || l.includes('.css') || l.includes('.json'))
            && !l.includes('modified:')
            && !l.includes('use "git');
    });

    if (fileActionLines.length > 0) {
        return fileActionLines.slice(0, 5).map(l => `- ${l.trim()}`).join('\n');
    }

    // Priority 4: Get last meaningful lines as fallback
    const lastMeaningfulLines = lines
        .filter(l => l.trim().length > 10) // Only lines with substantial content
        .slice(-5);

    if (lastMeaningfulLines.length > 0) {
        return lastMeaningfulLines.map(l => `- ${l.trim()}`).join('\n');
    }

    return '- 작업 완료됨';
}

interface StartJobParams {
    jobId: string;
    conversationId: string;
    ticketId: string;
    agentId: string;
    agentName: string;
    projectPath: string;
    prompt: string;
    provider: AgentProvider;
}

export function startBackgroundJob(params: StartJobParams): void {
    const { jobId, conversationId, ticketId, agentId, agentName, projectPath, prompt, provider } = params;

    // Configure command and args based on provider
    let execPath: string;
    let args: string[];
    let startMessage: string;

    if (provider === 'opencode') {
        execPath = OPENCODE_CMD;
        // Use stdin for prompt to avoid shell escaping issues
        args = ['run', '-'];
        startMessage = `🚀 Starting OpenCode in ${projectPath}...\n\n`;
    } else {
        execPath = CLAUDE_CMD;
        // Use stdin for prompt to avoid shell escaping issues
        args = ['--print', '--dangerously-skip-permissions'];
        startMessage = `🚀 Starting Claude Code in ${projectPath}...\n\n`;
    }

    // On Windows, shell: true is needed to find commands in PATH
    const isWindows = process.platform === 'win32';

    const agentProcess = spawn(execPath, args, {
        cwd: projectPath,
        env: { ...process.env, PORT: '3001' },
        shell: isWindows,
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write prompt to stdin
    agentProcess.stdin?.write(prompt);
    agentProcess.stdin?.end();

    const job: RunningJob = {
        id: jobId,
        conversationId,
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

    // Log start message to conversation
    conversationMessageService.create(conversationId, startMessage, 'system');

    // Capture stdout
    agentProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        job.output += text;
        // Save to conversation messages
        conversationMessageService.create(conversationId, text, 'log');
    });

    // Capture stderr
    agentProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        const errorText = `[stderr] ${text}\n`;
        job.output += errorText;
        // Save errors to conversation messages
        conversationMessageService.create(conversationId, text, 'error');
    });

    agentProcess.on('close', (code: number | null) => {
        const success = code === 0;
        job.status = success ? 'completed' : 'failed';

        // Extract commit hash from output
        const commitMatch = job.output.match(/commit\s+([a-f0-9]{7,40})/i);
        const commitHash = commitMatch ? commitMatch[1] : undefined;

        // Update conversation status
        conversationService.complete(conversationId, {
            status: success ? 'completed' : 'failed',
            git_commit_hash: commitHash,
        });

        // Add completion message
        const completionMessage = success
            ? `✅ Task completed successfully${commitHash ? ` (commit: ${commitHash})` : ''}`
            : '❌ Task failed';
        conversationMessageService.create(conversationId, completionMessage, success ? 'success' : 'error');

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

        // Get ticket info for work log
        const ticket = ticketService.getById(ticketId);
        const member = ticket?.assignee;

        // Append to work log file in project directory
        appendToWorkLog(job.projectPath, {
            agentName: job.agentName,
            agentAvatar: member?.avatar || '🤖',
            ticketTitle: ticket?.title || 'Unknown Task',
            success,
            commitHash,
            output: job.output,
        });

        // Remove from running jobs after a delay (keep for status check)
        setTimeout(() => {
            runningJobs.delete(jobId);
        }, 60000); // Keep completed job info for 1 minute
    });

    agentProcess.on('error', (error: Error) => {
        job.status = 'failed';
        job.output += `\n[error] ${error.message}`;

        // Update conversation
        conversationService.complete(conversationId, {
            status: 'failed',
        });

        // Add error message
        conversationMessageService.create(conversationId, `❌ Process error: ${error.message}`, 'error');

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

    // Update conversation
    conversationService.complete(job.conversationId, {
        status: 'cancelled',
    });

    // Add cancellation message
    conversationMessageService.create(job.conversationId, '⏹ Job was cancelled by user', 'system');

    activityService.log({
        ticket_id: job.ticketId,
        member_id: job.agentId,
        action: 'AGENT_WORK_CANCELLED',
        details: `${job.agentName}'s work was cancelled`,
    });

    runningJobs.delete(jobId);
    return true;
}
