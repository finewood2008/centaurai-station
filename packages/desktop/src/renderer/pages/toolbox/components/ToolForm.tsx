/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Message, Select } from '@arco-design/web-react';
import { Magic } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useConfigModelListWithImage from '@/renderer/hooks/agent/useConfigModelListWithImage';
import { getAgentDisplayName, type AgentMetadata } from '@/renderer/utils/model/agentTypes';
import { findMissingRequired } from '../toolboxPrompt';
import { addImageModel, applyImageModelSelection, getCurrentImageModel, getImageModelOptions } from '../imageModel';
import type { ToolDef, ToolFormValues } from '../types';
import { DynamicField } from './DynamicField';

const Option = Select.Option;

type ToolFormProps = {
  tool: ToolDef;
  agents: AgentMetadata[];
  running: boolean;
  disabled?: boolean;
  onRun: (tool: ToolDef, agent: AgentMetadata | null, values: ToolFormValues) => void;
};

/** Build the initial form values from the tool's declared field defaults. */
function initialValues(tool: ToolDef): ToolFormValues {
  const values: ToolFormValues = {};
  for (const field of tool.fields) {
    if (field.defaultValue !== undefined) values[field.name] = field.defaultValue;
    else if (field.type === 'upload') values[field.name] = [];
  }
  return values;
}

/** Form for a single tool: dynamic fields + agent picker + run action. */
export const ToolForm: React.FC<ToolFormProps> = ({ tool, agents, running, disabled, onRun }) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<ToolFormValues>(() => initialValues(tool));
  const [agentKey, setAgentKey] = useState<string>('');

  // Image tools generate directly with the configured image model — no agent.
  const usesImageModel = tool.requires === 'image-model';
  const { modelListWithImage: imageProviders } = useConfigModelListWithImage();
  const [imageModel, setImageModel] = useState<string>(() => getCurrentImageModel());
  const imageModelOptions = useMemo(() => getImageModelOptions(imageProviders), [imageProviders]);

  const handleImageModelChange = async (value: string) => {
    setImageModel(value);
    // Newly typed (allowCreate) value → register it on the provider.
    if (value && !imageModelOptions.includes(value)) await addImageModel(value);
  };

  // Reset the form whenever the selected tool changes.
  useEffect(() => {
    setValues(initialValues(tool));
  }, [tool]);

  const eligibleAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (agent.available === false || agent.enabled === false) return false;
      if (!tool.agents || tool.agents.length === 0) return true;
      const backend = agent.backend || agent.agent_type;
      return tool.agents.includes(backend);
    });
  }, [agents, tool.agents]);

  // Default the agent selection to the first eligible agent.
  useEffect(() => {
    if (!agentKey && eligibleAgents.length > 0) setAgentKey(eligibleAgents[0].id);
  }, [agentKey, eligibleAgents]);

  const handleChange = (name: string, value: string | number | string[]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleRun = async () => {
    const missing = findMissingRequired(tool, values);
    if (missing.length > 0) {
      Message.error(t('toolbox.fillRequired', { field: t(missing[0].labelKey) }));
      return;
    }
    if (usesImageModel) {
      if (imageModel) await applyImageModelSelection(imageModel);
      onRun(tool, null, values);
      return;
    }
    const agent = eligibleAgents.find((a) => a.id === agentKey);
    if (!agent) {
      Message.error(t('toolbox.noAgent'));
      return;
    }
    onRun(tool, agent, values);
  };

  const runDisabled = disabled || (!usesImageModel && eligibleAgents.length === 0);

  return (
    <div className='flex flex-col gap-16px'>
      {tool.fields.map((field) => (
        <DynamicField key={field.name} field={field} value={values[field.name]} onChange={handleChange} />
      ))}

      {usesImageModel ? (
        <div className='flex flex-col gap-4px'>
          <span className='text-13px text-t-secondary'>{t('toolbox.imageModel')}</span>
          <Select
            value={imageModel || undefined}
            showSearch
            allowCreate
            placeholder={t('toolbox.imageModelPlaceholder')}
            notFoundContent={t('toolbox.imageModelUnset')}
            onChange={(v) => void handleImageModelChange(v)}
          >
            {imageModelOptions.map((m) => (
              <Option key={m} value={m}>
                {m}
              </Option>
            ))}
          </Select>
        </div>
      ) : (
        <div className='flex flex-col gap-4px'>
          <span className='text-13px text-t-secondary'>{t('toolbox.agent')}</span>
          <Select
            value={agentKey}
            placeholder={t('toolbox.agentPlaceholder')}
            onChange={setAgentKey}
            notFoundContent={t('toolbox.noAgent')}
          >
            {eligibleAgents.map((agent) => (
              <Option key={agent.id} value={agent.id}>
                {getAgentDisplayName(agent)}
              </Option>
            ))}
          </Select>
        </div>
      )}

      <Button type='primary' icon={<Magic />} loading={running} disabled={runDisabled} onClick={() => void handleRun()}>
        {running ? t('toolbox.generating') : t('toolbox.generate')}
      </Button>
    </div>
  );
};

export default ToolForm;
