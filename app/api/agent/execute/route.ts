import { NextRequest, NextResponse } from 'next/server';
import { ticketService, memberService, projectService, activityService, conversationService } from '@/lib/db';
import { startBackgroundJob, AgentProvider } from '@/lib/agent-jobs';
import { v4 as uuidv4 } from 'uuid';

interface AgentExecuteRequest {
    ticket_id: string;
    feedback?: string;
    provider?: AgentProvider;
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
}, feedback?: string): string {
    // Check if role is QA to add specific port instructions
    const isQA = agent.role === 'QA';
    const qaInstruction = isQA
        ? `\nIMPORTANT:
1. PORT CONFIGURATION: When running tests or starting servers for the TARGET PROJECT, you MUST use port 3001 (or any port other than 1234) to avoid conflict with this dashboard app. Use "PORT=3001 npm run dev" or equivalent.
2. TOOL USAGE: You MUST use the **Playwright MCP** (https://github.com/microsoft/playwright-mcp) tools for automated testing. verify the available tools and use them for browser automation and testing. Do NOT rely solely on manual terminal commands.`
        : '';

    // Check if role is FE_DEV to add screenshot instructions
    const isFrontend = agent.role === 'FE_DEV';
    const screenshotInstruction = isFrontend
        ? `\n\nSCREENSHOT REQUIREMENT:
After completing your UI changes, you MUST take screenshots to document your work:
1. Start the dev server with PORT=3001 (e.g., "PORT=3001 npm run dev")
2. Use browser automation tools (Playwright MCP or similar) to capture screenshots
3. Save screenshots to the ".agent-screenshots/" folder in the project root
4. Name files descriptively (e.g., "login-page-updated.png", "dashboard-new-layout.png")
5. Include multiple screenshots if you changed multiple pages/components
This is MANDATORY for all frontend changes so other agents can reference your visual changes.`
        : '';

    const feedbackSection = feedback
        ? `\n\nIMPORTANT FEEDBACK FROM USER:\n${feedback}\n\nPlease address this feedback specifically in your implementation.`
        : '';

    return `You are acting as ${agent.name} (${agent.role}) for the project "${project.name}".

${agent.system_prompt}

---

TASK TO COMPLETE:
Title: ${ticket.title}
${ticket.description ? `Description: ${ticket.description}` : ''}
${feedbackSection}

---

INSTRUCTIONS:
1. Analyze the task requirements carefully
2. Make the necessary code changes to complete this task
3. Focus only on what's needed for this specific task
4. Write clean, well-documented code
5. After completing, provide a brief summary of changes made
6. If you make changes, commit them with a meaningful message
7. CRITICAL: You are working on the external project "${project.name}". When starting its server, ALWAYS use port 3001 (e.g. "PORT=3001 npm run dev"). NEVER use port 1234.${qaInstruction}${screenshotInstruction}

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
        const prompt = buildAgentPrompt(ticket, agent, project, body.feedback);

        // Use provided provider or default to 'claude'
        const provider: AgentProvider = body.provider || 'claude';

        // Generate job ID
        const jobId = uuidv4();

        // Update ticket status to IN_PROGRESS
        ticketService.update(body.ticket_id, { status: 'IN_PROGRESS' }, agent.id);

        // Create conversation for this execution
        const conversation = conversationService.create({
            ticket_id: body.ticket_id,
            agent_id: agent.id,
            provider,
            prompt,
            feedback: body.feedback,
        });

        // Log activity
        activityService.log({
            ticket_id: body.ticket_id,
            member_id: agent.id,
            action: 'AGENT_WORK_STARTED',
            details: `${agent.name} started working on this task using ${provider === 'opencode' ? 'OpenCode' : 'Claude Code'}`,
        });

        // Start background job (non-blocking)
        startBackgroundJob({
            jobId,
            conversationId: conversation.id,
            ticketId: body.ticket_id,
            agentId: agent.id,
            agentName: agent.name,
            projectPath: project.path,
            prompt,
            provider,
        });

        // Return immediately with job info
        return NextResponse.json({
            success: true,
            job_id: jobId,
            conversation_id: conversation.id,
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
