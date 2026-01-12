import { NextRequest, NextResponse } from 'next/server';
import { memberService } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const member = memberService.getById(id);
        if (!member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        return NextResponse.json(member);
    } catch (error) {
        console.error('Error fetching member:', error);
        return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const member = memberService.update(id, body);
        if (!member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        return NextResponse.json(member);
    } catch (error) {
        console.error('Error updating member:', error);
        return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = memberService.delete(id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.error === 'Member not found' ? 404 : 403 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting member:', error);
        return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
    }
}
