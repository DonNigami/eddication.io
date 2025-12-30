/**
 * Broadcast Scheduler
 * Processes scheduled broadcasts from Supabase broadcast_queue table
 * Runs periodically to send messages at scheduled times
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

class BroadcastScheduler {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        this.lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        this.isRunning = false;
    }

    /**
     * Start the broadcast scheduler (runs every 30 seconds)
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[BroadcastScheduler] Started - checking every 30 seconds');

        this.interval = setInterval(() => this.processBroadcasts(), 30000);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.isRunning = false;
            console.log('[BroadcastScheduler] Stopped');
        }
    }

    /**
     * Process all pending broadcasts
     */
    async processBroadcasts() {
        try {
            const now = new Date().toISOString();

            // Fetch scheduled broadcasts that are due
            const { data: pendingBroadcasts, error } = await this.supabase
                .from('broadcast_queue')
                .select('*')
                .eq('status', 'scheduled')
                .lte('scheduled_at', now)
                .order('scheduled_at', { ascending: true })
                .limit(50);

            if (error) {
                console.error('[BroadcastScheduler] Error fetching broadcasts:', error);
                return;
            }

            if (!pendingBroadcasts || pendingBroadcasts.length === 0) {
                return;
            }

            console.log(`[BroadcastScheduler] Processing ${pendingBroadcasts.length} broadcasts`);

            for (const broadcast of pendingBroadcasts) {
                await this.sendBroadcast(broadcast);
            }
        } catch (err) {
            console.error('[BroadcastScheduler] Fatal error:', err);
        }
    }

    /**
     * Send a single broadcast message
     */
    async sendBroadcast(broadcast) {
        try {
            const { id, target, msg_type, message, image_url, flex_json } = broadcast;

            // Get target audience
            const userIds = await this.getTargetUsers(target);

            if (!userIds || userIds.length === 0) {
                console.log(`[BroadcastScheduler] No users found for target: ${target}`);
                await this.updateBroadcastStatus(id, 'sent');
                return;
            }

            // Build message payload
            let messagePayload;
            switch (msg_type) {
                case 'text':
                    messagePayload = { type: 'text', text: message || 'Message' };
                    break;
                case 'image':
                    messagePayload = {
                        type: 'image',
                        originalContentUrl: image_url,
                        previewImageUrl: image_url
                    };
                    break;
                case 'flex':
                    try {
                        messagePayload = { type: 'flex', altText: 'Notification', contents: JSON.parse(flex_json) };
                    } catch (e) {
                        console.error(`[BroadcastScheduler] Invalid flex JSON for broadcast ${id}:`, e);
                        await this.updateBroadcastStatus(id, 'failed');
                        return;
                    }
                    break;
                default:
                    messagePayload = { type: 'text', text: message || 'Message' };
            }

            // Send to all users
            const results = await Promise.allSettled(
                userIds.map(userId => this.sendToUser(userId, messagePayload))
            );

            const sentCount = results.filter(r => r.status === 'fulfilled').length;
            console.log(`[BroadcastScheduler] Sent broadcast ${id} to ${sentCount}/${userIds.length} users`);

            await this.updateBroadcastStatus(id, 'sent');
        } catch (err) {
            console.error(`[BroadcastScheduler] Error sending broadcast:`, err);
            await this.updateBroadcastStatus(broadcast.id, 'failed');
        }
    }

    /**
     * Get target user IDs based on broadcast target
     */
    async getTargetUsers(target) {
        try {
            if (target === 'all') {
                const { data } = await this.supabase
                    .from('profiles')
                    .select('line_user_id')
                    .eq('role', 'member');
                return data?.map(p => p.line_user_id).filter(Boolean) || [];
            }

            if (target.startsWith('segment:')) {
                const segmentId = target.replace('segment:', '');
                const { data: segment } = await this.supabase
                    .from('customer_segments')
                    .select('conditions')
                    .eq('id', segmentId)
                    .single();

                if (!segment) return [];

                // Apply segment conditions to fetch matching users
                let query = this.supabase.from('profiles').select('line_user_id');
                const conditions = segment.conditions || {};

                if (conditions.min_days_joined) {
                    const joinedDate = new Date();
                    joinedDate.setDate(joinedDate.getDate() - conditions.min_days_joined);
                    query = query.lte('created_at', joinedDate.toISOString());
                }
                if (conditions.max_points !== null && conditions.max_points !== undefined) {
                    query = query.lt('points', conditions.max_points);
                }
                if (conditions.inactive_days) {
                    const inactiveDate = new Date();
                    inactiveDate.setDate(inactiveDate.getDate() - conditions.inactive_days);
                    query = query.lt('last_activity', inactiveDate.toISOString());
                }

                const { data } = await query;
                return data?.map(p => p.line_user_id).filter(Boolean) || [];
            }

            if (target.startsWith('tag:')) {
                const tag = target.replace('tag:', '');
                const { data } = await this.supabase
                    .from('profiles')
                    .select('line_user_id')
                    .contains('tags', [tag]);
                return data?.map(p => p.line_user_id).filter(Boolean) || [];
            }

            return [];
        } catch (err) {
            console.error('[BroadcastScheduler] Error getting target users:', err);
            return [];
        }
    }

    /**
     * Send message to a single LINE user
     */
    async sendToUser(userId, messagePayload) {
        try {
            const response = await axios.post(
                'https://api.line.biz/v1/bot/message/push',
                { to: userId, messages: [messagePayload] },
                {
                    headers: {
                        'Authorization': `Bearer ${this.lineChannelAccessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (err) {
            console.error(`[BroadcastScheduler] Failed to send to user ${userId}:`, err.response?.data || err.message);
            throw err;
        }
    }

    /**
     * Update broadcast status in database
     */
    async updateBroadcastStatus(id, status) {
        try {
            await this.supabase
                .from('broadcast_queue')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);
        } catch (err) {
            console.error(`[BroadcastScheduler] Error updating broadcast ${id}:`, err);
        }
    }
}

module.exports = { BroadcastScheduler };
