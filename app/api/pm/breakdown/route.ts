import { NextRequest, NextResponse } from 'next/server';
import { ticketService, memberService } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * PM Agent - AI-powered feature breakdown
 * 
 * Uses OpenAI to analyze feature requests and create appropriate tasks
 * with intelligent assignment to team members.
 */

interface TaskFromAI {
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignee_role: 'FE_DEV' | 'BACKEND_DEV' | 'QA' | 'DEVOPS';
}

const SYSTEM_PROMPT = `You are a PM (Project Manager) AI agent for a software development team.

Your team consists of:
- FE_DEV (Frontend Developer): Handles UI/UX, React, Next.js, CSS, components, user interfaces
- BACKEND_DEV (Backend Developer): Handles APIs, databases, server logic, authentication, business logic
- QA (QA Engineer): Handles testing, quality assurance, bug verification, E2E tests
- DEVOPS (DevOps Engineer): Handles deployment, CI/CD, infrastructure, monitoring

When given a feature request, you must:
1. Break it down into specific, actionable tasks
2. Assign each task to the appropriate team member based on their expertise
3. Set priorities (CRITICAL > HIGH > MEDIUM > LOW)

IMPORTANT RULES:
- Create focused, single-responsibility tasks
- Backend tasks should come before frontend integration tasks
- Always include a QA task for testing
- Be specific in task descriptions
- Use Korean for titles and descriptions

Respond in JSON format:
{
  "tasks": [
    {
      "title": "Task title in Korean",
      "description": "Detailed task description in Korean",
      "priority": "HIGH",
      "assignee_role": "BACKEND_DEV"
    }
  ],
  "summary": "Brief summary of the breakdown in Korean"
}`;

async function breakdownWithAI(request: string): Promise<{ tasks: TaskFromAI[]; summary: string }> {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Feature Request: ${request}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
        throw new Error('No response from AI');
    }

    return JSON.parse(content);
}

function getAssigneeByRole(role: string): string | null {
    const member = memberService.getByRole(role);
    return member?.id || null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.request) {
            return NextResponse.json(
                { error: 'Feature request is required' },
                { status: 400 }
            );
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        const pmMember = memberService.getByRole('PM');

        // Use AI to break down the request
        const aiResponse = await breakdownWithAI(body.request);

        const createdTickets = [];

        for (const task of aiResponse.tasks) {
            const assigneeId = getAssigneeByRole(task.assignee_role);

            const ticket = ticketService.create({
                title: task.title,
                description: task.description,
                priority: task.priority,
                assignee_id: assigneeId || undefined,
                project_id: body.project_id,
                created_by: pmMember?.id,
            });

            const assignee = assigneeId ? memberService.getById(assigneeId) : null;
            createdTickets.push({
                ...ticket,
                assignee,
                assigned_role: task.assignee_role,
            });
        }

        return NextResponse.json({
            success: true,
            original_request: body.request,
            created_by: pmMember,
            tickets_created: createdTickets.length,
            tickets: createdTickets,
            ai_summary: aiResponse.summary,
            message: `PM이 AI를 사용해 "${body.request}" 요청을 분석하여 ${createdTickets.length}개의 태스크를 생성했습니다.`,
        }, { status: 201 });
    } catch (error) {
        console.error('Error in PM breakdown:', error);
        return NextResponse.json(
            { error: 'Failed to process feature request', details: String(error) },
            { status: 500 }
        );
    }
}
