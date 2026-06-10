/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Button } from '@arco-design/web-react';
import {
  Avatar,
  BookOne,
  Bowl,
  IdCard,
  Left,
  Magic,
  Picture,
  PictureOne,
  ShoppingBag,
  SmilingFace,
  Time,
  Toolkit,
  Topic,
} from '@icon-park/react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAgents } from '@/renderer/hooks/agent/useAgents';
import type { AgentMetadata } from '@/renderer/utils/model/agentTypes';
import { ResultPanel } from './components/ResultPanel';
import { ToolForm } from './components/ToolForm';
import { checkToolReadiness } from './imageGenReadiness';
import type { ToolDef, ToolFormValues } from './types';
import { useToolboxRun } from './useToolboxRun';
import { useToolboxTools } from './useToolboxTools';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Picture,
  PictureOne,
  Topic,
  Magic,
  Avatar,
  SmilingFace,
  ShoppingBag,
  IdCard,
  BookOne,
  Bowl,
  Time,
};

const ToolIcon: React.FC<{ name: string; size?: number }> = ({ name, size }) => {
  const Cmp = ICONS[name] ?? Picture;
  return <Cmp size={size} />;
};

type LastRun = { tool: ToolDef; agent: AgentMetadata | null; values: ToolFormValues };

/** Common AI Toolbox — a grid of practical, form-driven AI tools. */
const ToolboxPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agents } = useAgents();
  const { status, result, error, run, reset } = useToolboxRun();

  const tools = useToolboxTools();
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);
  const lastRunRef = useRef<LastRun | null>(null);

  const readiness = activeTool ? checkToolReadiness(activeTool) : null;
  const toolReady = !readiness || readiness.ready;

  let readinessAlert: React.ReactNode = null;
  if (readiness && readiness.ready === false) {
    const { reasonKey, settingsRoute } = readiness;
    readinessAlert = (
      <Alert
        type='warning'
        content={t(reasonKey)}
        action={
          <Button size='mini' type='text' onClick={() => void navigate(settingsRoute)}>
            {t('toolbox.goToSettings')}
          </Button>
        }
      />
    );
  }

  const openTool = useCallback(
    (tool: ToolDef) => {
      reset();
      lastRunRef.current = null;
      setActiveTool(tool);
    },
    [reset]
  );

  const closeTool = useCallback(() => setActiveTool(null), []);

  const handleRun = useCallback(
    (tool: ToolDef, agent: AgentMetadata | null, values: ToolFormValues) => {
      lastRunRef.current = { tool, agent, values };
      void run(tool, agent, values);
    },
    [run]
  );

  const handleRegenerate = useCallback(() => {
    const last = lastRunRef.current;
    if (last) void run(last.tool, last.agent, last.values);
  }, [run]);

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      void navigate(`/conversation/${conversationId}`);
    },
    [navigate]
  );

  return (
    <div className='w-full min-h-full box-border overflow-y-auto'>
      <div className='mx-auto flex w-full max-w-1100px box-border flex-col gap-24px p-24px'>
        {!activeTool ? (
          <>
            <div className='flex items-center gap-12px'>
              <Toolkit size={24} />
              <div className='flex flex-col'>
                <span className='text-18px font-600 text-t-primary'>{t('toolbox.title')}</span>
                <span className='text-13px text-t-secondary'>{t('toolbox.subtitle')}</span>
              </div>
            </div>

            <div className='grid grid-cols-3 gap-16px'>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type='button'
                  className='flex flex-col items-start gap-8px rounded-12px b-1 b-solid b-line-2 bg-1 p-16px text-left cursor-pointer hover:b-rgb-primary transition-colors'
                  onClick={() => openTool(tool)}
                >
                  <ToolIcon name={tool.icon} size={28} />
                  <span className='text-15px font-500 text-t-primary'>{tool.titleText ?? t(tool.titleKey)}</span>
                  <span className='text-12px text-t-secondary line-clamp-2'>{tool.descText ?? t(tool.descKey)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className='flex items-center gap-10px'>
              <Button shape='circle' icon={<Left />} onClick={closeTool} />
              <ToolIcon name={activeTool.icon} size={22} />
              <span className='text-16px font-600 text-t-primary'>
                {activeTool.titleText ?? t(activeTool.titleKey)}
              </span>
            </div>
            {readinessAlert}
            <div className='flex flex-col lg:flex-row gap-24px items-start'>
              <div className='w-full lg:w-380px lg:shrink-0'>
                <ToolForm
                  tool={activeTool}
                  agents={agents}
                  running={status === 'running'}
                  disabled={!toolReady}
                  onRun={handleRun}
                />
              </div>
              <div className='w-full lg:flex-1 lg:min-w-0 min-h-260px rounded-12px b-1 b-solid b-line-2 bg-1 p-16px'>
                <ResultPanel
                  status={status}
                  result={result}
                  error={error}
                  onOpenConversation={handleOpenConversation}
                  onRegenerate={handleRegenerate}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ToolboxPage;
