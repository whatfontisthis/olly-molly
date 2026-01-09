import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Database file path
const DB_PATH = path.join(process.cwd(), 'db', 'dev.sqlite');

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Load projects schema if exists
  const projectsSchemaPath = path.join(process.cwd(), 'db', 'schema-projects.sql');
  if (fs.existsSync(projectsSchemaPath)) {
    const projectsSchema = fs.readFileSync(projectsSchemaPath, 'utf-8');
    db.exec(projectsSchema);
  }

  // Load conversations schema if exists
  const conversationsSchemaPath = path.join(process.cwd(), 'db', 'schema-conversations.sql');
  if (fs.existsSync(conversationsSchemaPath)) {
    const conversationsSchema = fs.readFileSync(conversationsSchemaPath, 'utf-8');
    db.exec(conversationsSchema);
  }
}

// Initialize on first load
initializeDatabase();

// Types
export interface Member {
  id: string;
  role: 'PM' | 'FE_DEV' | 'BACKEND_DEV' | 'QA' | 'DEVOPS';
  name: string;
  avatar: string | null;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'NEED_FIX' | 'COMPLETE' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignee_id: string | null;
  project_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Member;
}

export interface ActivityLog {
  id: string;
  ticket_id: string;
  member_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  created_at: string;
  member?: Member;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AgentWorkLog {
  id: string;
  ticket_id: string;
  agent_id: string;
  project_id: string;
  command: string;
  prompt: string | null;
  output: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  git_commit_hash: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface Conversation {
  id: string;
  ticket_id: string;
  agent_id: string;
  provider: 'claude' | 'opencode';
  prompt: string | null;
  feedback: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  git_commit_hash: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  agent?: Member;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: 'log' | 'error' | 'success' | 'system';
  created_at: string;
}

// Member operations
export const memberService = {
  getAll(): Member[] {
    return db.prepare('SELECT * FROM members ORDER BY role').all() as Member[];
  },

  getById(id: string): Member | undefined {
    return db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Member | undefined;
  },

  getByRole(role: string): Member | undefined {
    return db.prepare('SELECT * FROM members WHERE role = ?').get(role) as Member | undefined;
  },

  updateSystemPrompt(id: string, systemPrompt: string): Member | undefined {
    db.prepare(`
      UPDATE members 
      SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(systemPrompt, id);
    return this.getById(id);
  },

  update(id: string, data: Partial<Pick<Member, 'name' | 'avatar' | 'system_prompt'>>): Member | undefined {
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(data.avatar);
    }
    if (data.system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(data.system_prompt);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id);
  }
};

// Ticket operations
export const ticketService = {
  getAll(status?: string, projectId?: string): Ticket[] {
    let query = `
      SELECT t.*, m.name as assignee_name, m.avatar as assignee_avatar, m.role as assignee_role
      FROM tickets t
      LEFT JOIN members m ON t.assignee_id = m.id
    `;
    const conditions: string[] = [];
    const params: (string | null)[] = [];

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (projectId) {
      conditions.push('t.project_id = ?');
      params.push(projectId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY t.created_at DESC';
    const tickets = db.prepare(query).all(...params) as (Ticket & { assignee_name?: string; assignee_avatar?: string; assignee_role?: string })[];
    return tickets.map(t => ({
      ...t,
      assignee: t.assignee_id ? {
        id: t.assignee_id,
        name: t.assignee_name!,
        avatar: t.assignee_avatar!,
        role: t.assignee_role as Member['role']
      } as Member : undefined
    }));
  },

  getById(id: string): Ticket | undefined {
    const ticket = db.prepare(`
      SELECT t.*, m.name as assignee_name, m.avatar as assignee_avatar, m.role as assignee_role
      FROM tickets t
      LEFT JOIN members m ON t.assignee_id = m.id
      WHERE t.id = ?
    `).get(id) as (Ticket & { assignee_name?: string; assignee_avatar?: string; assignee_role?: string }) | undefined;

    if (!ticket) return undefined;

    return {
      ...ticket,
      assignee: ticket.assignee_id ? {
        id: ticket.assignee_id,
        name: ticket.assignee_name!,
        avatar: ticket.assignee_avatar!,
        role: ticket.assignee_role as Member['role']
      } as Member : undefined
    };
  },

  create(data: { title: string; description?: string; priority?: Ticket['priority']; assignee_id?: string; project_id?: string; created_by?: string }): Ticket {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO tickets (id, title, description, priority, assignee_id, project_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.title, data.description || null, data.priority || 'MEDIUM', data.assignee_id || null, data.project_id || null, data.created_by || null);

    // Log creation
    activityService.log({
      ticket_id: id,
      member_id: data.created_by || null,
      action: 'CREATED',
      new_value: data.title,
      details: `Ticket "${data.title}" was created`
    });

    return this.getById(id)!;
  },

  update(id: string, data: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'priority' | 'assignee_id'>>, updatedBy?: string): Ticket | undefined {
    const current = this.getById(id);
    if (!current) return undefined;

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.status !== undefined && data.status !== current.status) {
      updates.push('status = ?');
      values.push(data.status);
      activityService.log({
        ticket_id: id,
        member_id: updatedBy || null,
        action: 'STATUS_CHANGED',
        old_value: current.status,
        new_value: data.status,
        details: `Status changed from ${current.status} to ${data.status}`
      });
    }
    if (data.priority !== undefined && data.priority !== current.priority) {
      updates.push('priority = ?');
      values.push(data.priority);
      activityService.log({
        ticket_id: id,
        member_id: updatedBy || null,
        action: 'PRIORITY_CHANGED',
        old_value: current.priority,
        new_value: data.priority,
        details: `Priority changed from ${current.priority} to ${data.priority}`
      });
    }
    if (data.assignee_id !== undefined && data.assignee_id !== current.assignee_id) {
      updates.push('assignee_id = ?');
      values.push(data.assignee_id);
      const newAssignee = data.assignee_id ? memberService.getById(data.assignee_id) : null;
      const oldAssignee = current.assignee_id ? memberService.getById(current.assignee_id) : null;
      activityService.log({
        ticket_id: id,
        member_id: updatedBy || null,
        action: 'ASSIGNED',
        old_value: oldAssignee?.name || null,
        new_value: newAssignee?.name || null,
        details: newAssignee
          ? `Assigned to ${newAssignee.name}`
          : 'Unassigned'
      });
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Activity log operations
export const activityService = {
  log(data: { ticket_id: string; member_id: string | null; action: string; old_value?: string | null; new_value?: string | null; details?: string | null }): ActivityLog {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO activity_logs (id, ticket_id, member_id, action, old_value, new_value, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.ticket_id, data.member_id, data.action, data.old_value || null, data.new_value || null, data.details || null);
    return this.getById(id)!;
  },

  getById(id: string): ActivityLog | undefined {
    return db.prepare(`
      SELECT al.*, m.name as member_name, m.avatar as member_avatar
      FROM activity_logs al
      LEFT JOIN members m ON al.member_id = m.id
      WHERE al.id = ?
    `).get(id) as ActivityLog | undefined;
  },

  getByTicketId(ticketId: string): ActivityLog[] {
    const logs = db.prepare(`
      SELECT al.*, m.name as member_name, m.avatar as member_avatar, m.role as member_role
      FROM activity_logs al
      LEFT JOIN members m ON al.member_id = m.id
      WHERE al.ticket_id = ?
      ORDER BY al.created_at DESC
    `).all(ticketId) as (ActivityLog & { member_name?: string; member_avatar?: string; member_role?: string })[];

    return logs.map(log => ({
      ...log,
      member: log.member_id ? {
        id: log.member_id,
        name: log.member_name!,
        avatar: log.member_avatar!,
        role: log.member_role as Member['role']
      } as Member : undefined
    }));
  }
};

// Project operations
export const projectService = {
  getAll(): Project[] {
    return db.prepare('SELECT * FROM projects ORDER BY is_active DESC, name ASC').all() as Project[];
  },

  getById(id: string): Project | undefined {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  },

  getActive(): Project | undefined {
    return db.prepare('SELECT * FROM projects WHERE is_active = 1').get() as Project | undefined;
  },

  create(data: { name: string; path: string; description?: string }): Project {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, name, path, description)
      VALUES (?, ?, ?, ?)
    `).run(id, data.name, data.path, data.description || null);
    return this.getById(id)!;
  },

  setActive(id: string): Project | undefined {
    // Deactivate all projects first
    db.prepare('UPDATE projects SET is_active = 0').run();
    // Activate the selected project
    db.prepare('UPDATE projects SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Agent work log operations
export const agentWorkLogService = {
  create(data: {
    ticket_id: string;
    agent_id: string;
    project_id: string;
    command: string;
    prompt?: string;
  }): AgentWorkLog {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO agent_work_logs (id, ticket_id, agent_id, project_id, command, prompt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.ticket_id, data.agent_id, data.project_id, data.command, data.prompt || null);
    return this.getById(id)!;
  },

  getById(id: string): AgentWorkLog | undefined {
    return db.prepare('SELECT * FROM agent_work_logs WHERE id = ?').get(id) as AgentWorkLog | undefined;
  },

  getByTicketId(ticketId: string): AgentWorkLog[] {
    return db.prepare(`
      SELECT awl.*, m.name as agent_name, m.avatar as agent_avatar, p.name as project_name
      FROM agent_work_logs awl
      LEFT JOIN members m ON awl.agent_id = m.id
      LEFT JOIN projects p ON awl.project_id = p.id
      WHERE awl.ticket_id = ?
      ORDER BY awl.started_at DESC
    `).all(ticketId) as AgentWorkLog[];
  },

  complete(id: string, data: {
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
    output?: string;
    git_commit_hash?: string;
  }): AgentWorkLog | undefined {
    const log = this.getById(id);
    if (!log) return undefined;

    const startTime = new Date(log.started_at).getTime();
    const duration = Date.now() - startTime;

    db.prepare(`
      UPDATE agent_work_logs 
      SET status = ?, output = ?, git_commit_hash = ?, completed_at = CURRENT_TIMESTAMP, duration_ms = ?
      WHERE id = ?
    `).run(data.status, data.output || null, data.git_commit_hash || null, duration, id);

    return this.getById(id);
  }
};

// Conversation operations
export const conversationService = {
  create(data: {
    ticket_id: string;
    agent_id: string;
    provider: 'claude' | 'opencode';
    prompt?: string;
    feedback?: string;
  }): Conversation {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO conversations (id, ticket_id, agent_id, provider, prompt, feedback)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.ticket_id, data.agent_id, data.provider, data.prompt || null, data.feedback || null);
    return this.getById(id)!;
  },

  getById(id: string): Conversation | undefined {
    const conversation = db.prepare(`
      SELECT c.*, m.name as agent_name, m.avatar as agent_avatar, m.role as agent_role
      FROM conversations c
      LEFT JOIN members m ON c.agent_id = m.id
      WHERE c.id = ?
    `).get(id) as (Conversation & { agent_name?: string; agent_avatar?: string; agent_role?: string }) | undefined;

    if (!conversation) return undefined;

    return {
      ...conversation,
      agent: conversation.agent_id ? {
        id: conversation.agent_id,
        name: conversation.agent_name!,
        avatar: conversation.agent_avatar!,
        role: conversation.agent_role as Member['role']
      } as Member : undefined
    };
  },

  getByTicketId(ticketId: string): Conversation[] {
    const conversations = db.prepare(`
      SELECT c.*, m.name as agent_name, m.avatar as agent_avatar, m.role as agent_role
      FROM conversations c
      LEFT JOIN members m ON c.agent_id = m.id
      WHERE c.ticket_id = ?
      ORDER BY c.started_at DESC
    `).all(ticketId) as (Conversation & { agent_name?: string; agent_avatar?: string; agent_role?: string })[];

    return conversations.map(conv => ({
      ...conv,
      agent: conv.agent_id ? {
        id: conv.agent_id,
        name: conv.agent_name!,
        avatar: conv.agent_avatar!,
        role: conv.agent_role as Member['role']
      } as Member : undefined
    }));
  },

  updateStatus(id: string, status: Conversation['status'], commitHash?: string): void {
    db.prepare(`
      UPDATE conversations 
      SET status = ?, git_commit_hash = ?
      WHERE id = ?
    `).run(status, commitHash || null, id);
  },

  complete(id: string, data: {
    status: Conversation['status'];
    git_commit_hash?: string;
  }): void {
    db.prepare(`
      UPDATE conversations 
      SET status = ?, git_commit_hash = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.status, data.git_commit_hash || null, id);
  }
};

// Conversation message operations
export const conversationMessageService = {
  create(conversationId: string, content: string, type: ConversationMessage['message_type'] = 'log'): ConversationMessage {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO conversation_messages (id, conversation_id, content, message_type)
      VALUES (?, ?, ?, ?)
    `).run(id, conversationId, content, type);
    return this.getById(id)!;
  },

  getById(id: string): ConversationMessage | undefined {
    return db.prepare('SELECT * FROM conversation_messages WHERE id = ?').get(id) as ConversationMessage | undefined;
  },

  getByConversationId(conversationId: string): ConversationMessage[] {
    return db.prepare(`
      SELECT * FROM conversation_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `).all(conversationId) as ConversationMessage[];
  },

  appendLog(conversationId: string, content: string): void {
    this.create(conversationId, content, 'log');
  }
};

export default db;
