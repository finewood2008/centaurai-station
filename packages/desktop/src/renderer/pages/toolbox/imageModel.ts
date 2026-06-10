/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { mcpService } from '@/common/adapter/ipcBridge';
import { configService } from '@/common/config/configService';
import { BUILTIN_IMAGE_GEN_ID, BUILTIN_IMAGE_GEN_NAME, type IProvider } from '@/common/config/storage';
import { isImageGenSupported } from '@/common/utils/imageModelAllowlist';

/** The currently configured image model name. */
export function getCurrentImageModel(): string {
  return configService.get('tools.imageGenerationModel')?.use_model ?? '';
}

/**
 * Eligible image-model names for the configured image provider — i.e. every
 * model on that provider whose name marks it as image-capable. The currently
 * selected model is always included even if it isn't in the provider list yet.
 */
export function getImageModelOptions(providers: IProvider[] | undefined): string[] {
  const cfg = configService.get('tools.imageGenerationModel');
  const current = cfg?.use_model;
  const provider = providers?.find((p) => p.id === cfg?.id);
  const models = provider ? (provider.models || []).filter((m) => isImageGenSupported(provider, m)) : [];
  if (current && !models.includes(current)) models.unshift(current);
  return models;
}

const isBuiltinImageGen = (s: { builtin?: boolean; id?: string; name?: string }): boolean =>
  s.builtin === true && (s.id === BUILTIN_IMAGE_GEN_ID || s.name === BUILTIN_IMAGE_GEN_NAME);

/**
 * Persist a new image-model choice: update the tools config and sync the
 * builtin image MCP's `AIONUI_IMG_MODEL` env so the next generation uses it.
 * The provider credentials stay the same (selection is within one provider).
 */
export async function applyImageModelSelection(useModel: string): Promise<void> {
  const cfg = configService.get('tools.imageGenerationModel');
  if (!cfg || !useModel || cfg.use_model === useModel) return;
  await configService.set('tools.imageGenerationModel', { ...cfg, use_model: useModel });
  try {
    const servers = await mcpService.listServers.invoke();
    const img = servers.find(isBuiltinImageGen);
    if (img && img.transport.type === 'stdio') {
      const env = { ...img.transport.env, AIONUI_IMG_MODEL: useModel };
      await mcpService.updateServer.invoke({ id: img.id, data: { transport: { ...img.transport, env } } });
    }
  } catch (error) {
    console.error('[toolbox] failed to sync image MCP env', error);
  }
}

/** Manually add a model name to the configured image provider's model list. */
export async function addImageModel(modelName: string): Promise<void> {
  const name = modelName.trim();
  const cfg = configService.get('tools.imageGenerationModel');
  if (!name || !cfg?.id) return;
  const providers = await ipcBridge.mode.listProviders.invoke();
  const provider = providers.find((p) => p.id === cfg.id);
  if (!provider || provider.models.includes(name)) return;
  await ipcBridge.mode.updateProvider.invoke({ id: cfg.id, models: [...provider.models, name] });
}
