/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Button, Message } from '@arco-design/web-react';
import { Info, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AionSelect from '@/renderer/components/base/AionSelect';
import { useProvidersQuery } from '@/renderer/hooks/agent/useModelProviderList';
import { useConfig } from '@/renderer/hooks/config/useConfig';
import {
  buildImageGenerationModelProviders,
  getImageModelValue,
  parseImageModelValue,
  registerImageGenerationModel,
  setImageGenerationModelSelection,
} from '@/renderer/utils/model/imageGenerationModels';

const ToolboxSettings: React.FC = () => {
  const { t } = useTranslation();
  const { data, mutate } = useProvidersQuery();
  const [message, messageContext] = Message.useMessage();
  const [imageModelRegistry] = useConfig('tools.imageGenerationModels');
  const [imageGenerationModel] = useConfig('tools.imageGenerationModel');
  const [imageProviderId, setImageProviderId] = useState('');
  const [imageModelInput, setImageModelInput] = useState('');

  const imageModelProviders = useMemo(
    () => buildImageGenerationModelProviders(data, imageModelRegistry, imageGenerationModel),
    [data, imageGenerationModel, imageModelRegistry]
  );
  const selectedImageProvider = useMemo(
    () => (data || []).find((provider) => provider.id === imageProviderId),
    [data, imageProviderId]
  );
  const currentImageModelValue =
    imageGenerationModel?.id && imageGenerationModel.use_model
      ? getImageModelValue(imageGenerationModel.id, imageGenerationModel.use_model)
      : undefined;

  useEffect(() => {
    if (!data?.length) return;
    const currentProviderId = imageGenerationModel?.id;
    const nextProviderId =
      currentProviderId && data.some((provider) => provider.id === currentProviderId) ? currentProviderId : data[0].id;

    if (!imageProviderId || !data.some((provider) => provider.id === imageProviderId)) {
      setImageProviderId(nextProviderId);
    }
  }, [data, imageGenerationModel?.id, imageProviderId]);

  const handleAddImageModel = useCallback(async () => {
    const modelName = imageModelInput.trim();
    if (!selectedImageProvider || !modelName) return;

    try {
      const providers = await ipcBridge.mode.listProviders.invoke();
      const provider = providers.find((item) => item.id === selectedImageProvider.id);
      if (!provider) {
        message.error(t('settings.saveModelConfigFailed'));
        return;
      }

      const models = provider.models.includes(modelName) ? provider.models : [...provider.models, modelName];
      const updatedProvider = { ...provider, models };
      if (!provider.models.includes(modelName)) {
        await ipcBridge.mode.updateProvider.invoke({ id: provider.id, models });
      }

      const nextProviders = providers.map((item) => (item.id === provider.id ? updatedProvider : item));
      await registerImageGenerationModel(provider.id, modelName);
      await setImageGenerationModelSelection(updatedProvider, modelName, nextProviders);
      await mutate();
      setImageModelInput('');
      message.success(t('settings.imageModelSaved', { defaultValue: '图像模型已保存' }));
    } catch (error) {
      console.error('Failed to add image model:', error);
      message.error(t('settings.saveModelConfigFailed'));
    }
  }, [imageModelInput, message, mutate, selectedImageProvider, t]);

  const handleCurrentImageModelChange = useCallback(
    async (value: string) => {
      const parsed = parseImageModelValue(value);
      if (!parsed) return;
      const provider = (data || []).find((item) => item.id === parsed.providerId);
      if (!provider) return;

      try {
        await setImageGenerationModelSelection(provider, parsed.modelName, data || []);
        message.success(t('settings.imageModelSaved', { defaultValue: '图像模型已保存' }));
      } catch (error) {
        console.error('Failed to select image model:', error);
        message.error(t('settings.saveModelConfigFailed'));
      }
    },
    [data, message, t]
  );

  return (
    <div className='flex flex-col h-full w-full'>
      {messageContext}
      <div className='space-y-16px'>
        <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
          <div className='flex flex-col gap-4px mb-18px'>
            <div className='text-16px font-600 text-t-primary'>{t('settings.imageModelsTitle')}</div>
            <div className='text-13px text-t-secondary'>{t('settings.imageModelsDescription')}</div>
          </div>

          {!data || data.length === 0 ? (
            <div className='flex items-center gap-8px text-13px text-t-secondary rounded-8px border border-dashed border-border-2 px-12px py-12px'>
              <Info theme='outline' size='16' />
              <span>{t('settings.noConfiguredModels')}</span>
            </div>
          ) : (
            <>
              <div className='grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-10px items-end'>
                <div className='flex flex-col gap-6px min-w-0'>
                  <span className='text-12px text-t-secondary'>{t('settings.modelProvider')}</span>
                  <AionSelect value={imageProviderId || undefined} onChange={setImageProviderId}>
                    {(data || []).map((provider) => (
                      <AionSelect.Option key={provider.id} value={provider.id}>
                        {provider.name}
                      </AionSelect.Option>
                    ))}
                  </AionSelect>
                </div>

                <div className='flex flex-col gap-6px min-w-0'>
                  <span className='text-12px text-t-secondary'>{t('settings.imageModelAddLabel')}</span>
                  <AionSelect
                    value={imageModelInput || undefined}
                    showSearch
                    allowCreate
                    placeholder={t('settings.imageModelAddPlaceholder')}
                    onChange={setImageModelInput}
                  >
                    {(selectedImageProvider?.models ?? []).map((modelName) => (
                      <AionSelect.Option key={modelName} value={modelName}>
                        {modelName}
                      </AionSelect.Option>
                    ))}
                  </AionSelect>
                </div>

                <Button
                  type='primary'
                  icon={<Plus size='14' />}
                  disabled={!selectedImageProvider || !imageModelInput.trim()}
                  onClick={() => void handleAddImageModel()}
                >
                  {t('settings.addImageModel')}
                </Button>
              </div>

              <div className='mt-16px flex flex-col gap-6px'>
                <span className='text-12px text-t-secondary'>{t('settings.currentImageModel')}</span>
                {imageModelProviders.length > 0 ? (
                  <AionSelect
                    value={currentImageModelValue}
                    placeholder={t('settings.imageModelSelectPlaceholder')}
                    onChange={(value) => void handleCurrentImageModelChange(value)}
                  >
                    {imageModelProviders.map((provider) => (
                      <AionSelect.OptGroup label={provider.name} key={provider.id}>
                        {provider.models.map((modelName) => (
                          <AionSelect.Option
                            key={getImageModelValue(provider.id, modelName)}
                            value={getImageModelValue(provider.id, modelName)}
                          >
                            {modelName}
                          </AionSelect.Option>
                        ))}
                      </AionSelect.OptGroup>
                    ))}
                  </AionSelect>
                ) : (
                  <div className='text-13px text-t-secondary rounded-8px border border-dashed border-border-2 px-12px py-10px'>
                    {t('settings.noAvailable')}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolboxSettings;
