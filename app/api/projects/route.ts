import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const projects = projectService.getAll();
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.path) {
            return NextResponse.json({ error: 'Project path is required' }, { status: 400 });
        }

        // Validate that the path exists and is a directory
        const projectPath = body.path;
        if (!fs.existsSync(projectPath)) {
            return NextResponse.json({ error: 'Path does not exist' }, { status: 400 });
        }

        const stats = fs.statSync(projectPath);
        if (!stats.isDirectory()) {
            return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
        }

        // Check if it's a git repository
        const gitPath = path.join(projectPath, '.git');
        const isGitRepo = fs.existsSync(gitPath);

        // Extract project name from path if not provided
        const name = body.name || path.basename(projectPath);

        const project = projectService.create({
            name,
            path: projectPath,
            description: body.description || (isGitRepo ? 'Git repository' : 'Local project'),
        });

        return NextResponse.json({ ...project, is_git_repo: isGitRepo }, { status: 201 });
    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}
