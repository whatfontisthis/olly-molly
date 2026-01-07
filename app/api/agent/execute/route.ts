import { NextRequest, NextResponse } from 'next/server';
import { ticketService, memberService, projectService, activityService, agentWorkLogService } from '@/lib/db';
import { startBackgroundJob } from '@/lib/agent-jobs';
import { v4 as uuidv4 } from 'uuid';

interface AgentExecuteRequest {
    ticket_id: string;
}

function buildAgentPrompt(ticket: {
    title: string;
    description?: string | null;
}, agent: {
    name: string;
    role: string;
    system_prompt: string;
}, project: {
    name: string;
    path: string;
}): string {
    return `You are acting as ${agent.name} (${agent.role}) for the project "${project.name}".

${agent.system_prompt}

---

TASK TO COMPLETE:
Title: ${ticket.title}
${ticket.description ? `Description: ${ticket.description}` : ''}

---

INSTRUCTIONS:
1. Analyze the task requirements carefully
2. Make the necessary code changes to complete this task
3. Focus only on what's needed for this specific task
4. Write clean, well-documented code
5. After completing, provide a brief summary of changes made
6. If you make changes, commit them with a meaningful message

Please complete this task now.`;
}

export async function POST(request: NextRequest) {
    try {
        const body: AgentExecuteRequest = await request.json();

        if (!body.ticket_id) {
            return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
        }

        // Get ticket
        const ticket = ticketService.getById(body.ticket_id);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Get assignee (agent)
        if (!ticket.assignee_id) {
            return NextResponse.json({ error: 'Ticket has no assignee' }, { status: 400 });
        }

        const agent = memberService.getById(ticket.assignee_id);
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Get active project
        const project = projectService.getActive();
        if (!project) {
            return NextResponse.json({ error: 'No active project selected. Please select a project first.' }, { status: 400 });
        }

        // Build prompt
        const prompt = buildAgentPrompt(ticket, agent, project);

        // Generate job ID
        const jobId = uuidv4();

        // Update ticket status to IN_PROGRESS
        ticketService.update(body.ticket_id, { status: 'IN_PROGRESS' }, agent.id);

        // Log the work start
        const workLog = agentWorkLogService.create({
            ticket_id: body.ticket_id,
            agent_id: agent.id,
            project_id: project.id,
            command: `claude --print --dangerously-skip-permissions`,
            prompt,
        });

        // Log activity
        activityService.log({
            ticket_id: body.ticket_id,
            member_id: agent.id,
            action: 'AGENT_WORK_STARTED',
            details: `${agent.name} started working on this task using Claude Code`,
        });

        // Start background job (non-blocking)
        startBackgroundJob({
            jobId,
            workLogId: workLog.id,
            ticketId: body.ticket_id,
            agentId: agent.id,
            agentName: agent.name,
            projectPath: project.path,
            prompt,
        });

        // Return immediately with job info
        return NextResponse.json({
            success: true,
            job_id: jobId,
            work_log_id: workLog.id,
            message: `${agent.name} started working on the task. The job is running in the background.`,
            agent: {
                id: agent.id,
                name: agent.name,
                role: agent.role,
                avatar: agent.avatar,
            },
            project: {
                id: project.id,
                name: project.name,
                path: project.path,
            },
            ticket_status: 'IN_PROGRESS',
        });
    } catch (error) {
        console.error('Error executing agent:', error);
        return NextResponse.json({
            error: 'Failed to execute agent',
            details: String(error)
        }, { status: 500 });
    }
}
