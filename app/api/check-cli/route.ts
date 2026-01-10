import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkCommandExists(command: string): Promise<boolean> {
    try {
        await execAsync(`which ${command}`);
        return true;
    } catch {
        return false;
    }
}

export async function GET() {
    try {
        const [hasOpencode, hasClaude] = await Promise.all([
            checkCommandExists('opencode'),
            checkCommandExists('claude'),
        ]);

        return NextResponse.json({
            opencode: hasOpencode,
            claude: hasClaude,
            anyInstalled: hasOpencode || hasClaude,
        });
    } catch (error) {
        console.error('Error checking CLI:', error);
        return NextResponse.json(
            { error: 'Failed to check CLI installation' },
            { status: 500 }
        );
    }
}
