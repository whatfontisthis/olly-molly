import { NextResponse } from 'next/server';
import { memberService } from '@/lib/db';

export async function GET() {
    try {
        const members = memberService.getAll();
        return NextResponse.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }
}
