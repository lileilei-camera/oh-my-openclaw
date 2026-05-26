import type {
  OpenClawPluginApi,
  PluginHookGatewayStartEvent,
  PluginHookGatewayContext,
} from '../types.js';
import { PLUGIN_ID } from '../types.js';
import { VERSION } from '../version.js';

/**
 * Registers the gateway startup hook.
 * Logs plugin activation when the Gateway starts.
 */
export function registerStartupHook(api: OpenClawPluginApi) {
  api.on<PluginHookGatewayStartEvent, void>(
    'gateway_start',
    async (_event: PluginHookGatewayStartEvent, _ctx: PluginHookGatewayContext): Promise<void> => {
      api.logger.info(`[${PLUGIN_ID}] Gateway started — plugin v${VERSION} active`);
    },
    { priority: 100 },
  );
}
