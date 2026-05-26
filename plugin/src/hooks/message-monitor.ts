import type {
  OpenClawPluginApi,
  PluginHookMessageSentEvent,
  PluginHookMessageReceivedEvent,
  PluginHookMessageContext,
} from '../types.js';
import { LOG_PREFIX } from '../constants.js';

const MAX_MESSAGE_COUNTS = 1000;
const messageCounts = new Map<string, number>();

/**
 * Registers the message monitor hooks.
 * Logs message events for audit purposes without modifying messages.
 */
export function registerMessageMonitor(api: OpenClawPluginApi) {
  api.on<PluginHookMessageSentEvent, void>(
    'message_sent',
    async (event: PluginHookMessageSentEvent, ctx: PluginHookMessageContext): Promise<void> => {
      const content = event.content ?? '';
      const preview = content.substring(0, 100);
      const channelId = ctx.channelId || 'unknown';
      const currentCount = messageCounts.get(channelId) ?? 0;
      const nextCount = currentCount + 1;
      messageCounts.set(channelId, nextCount);

      // Enforce max size limit with LRU eviction
      if (messageCounts.size > MAX_MESSAGE_COUNTS) {
        const oldestKey = messageCounts.keys().next().value;
        if (oldestKey !== undefined) {
          messageCounts.delete(oldestKey);
        }
      }

      api.logger.info(`${LOG_PREFIX} Message sent:`, {
        preview,
        channelId,
        messageCount: nextCount,
      });
    },
    { priority: 100 },
  );

  api.on<PluginHookMessageReceivedEvent, void>(
    'message_received',
    async (event: PluginHookMessageReceivedEvent, ctx: PluginHookMessageContext): Promise<void> => {
      const content = event.content ?? '';
      const preview = content.substring(0, 100);
      const channelId = ctx.channelId || 'unknown';
      api.logger.info(`${LOG_PREFIX} Message received:`, { preview, channelId });
    },
    { priority: 100 },
  );
}

/**
 * Returns the current message count
 * Useful for status reporting
 */
export function getMessageCount(channelId?: string): number {
  if (channelId) {
    return messageCounts.get(channelId) ?? 0;
  }

  let total = 0;
  for (const count of messageCounts.values()) {
    total += count;
  }
  return total;
}
