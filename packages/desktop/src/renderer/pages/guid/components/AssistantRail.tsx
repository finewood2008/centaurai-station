/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lightning, Plus, Robot } from '@icon-park/react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import styles from '../index.module.css';
import { resolveAssistantAvatar } from './assistantPresentation';

type AssistantRailProps = {
  assistants: Assistant[];
  localeKey: string;
  selectedAssistantId?: string | null;
  onSelect: (assistantId: string) => void;
  /** Pinned default option: chat directly without an assistant. */
  onSelectNone: () => void;
  onHover: (assistant: Assistant | null) => void;
};

/**
 * Right-side vertical rail listing every assistant. Hovering a row enlarges it
 * and surfaces the assistant's capability card (via `onHover`); clicking selects
 * it. Scrolls when the list is taller than the viewport.
 */
export const AssistantRail: React.FC<AssistantRailProps> = ({
  assistants,
  localeKey,
  selectedAssistantId,
  onSelect,
  onSelectNone,
  onHover,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const list = assistants
    .filter((a) => a.enabled !== false)
    .toSorted((a, b) => {
      if (a.id === 'cowork') return -1;
      if (b.id === 'cowork') return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  return (
    <div className={styles.assistantRail} onMouseLeave={() => onHover(null)}>
      <div className={styles.assistantRailTitle}>{t('guid.assistantsTitle', { defaultValue: 'Assistants' })}</div>
      <div className={styles.assistantRailList}>
        <button
          type='button'
          data-testid='assistant-rail-none'
          className={`${styles.assistantRailItem} ${!selectedAssistantId ? styles.assistantRailItemSelected : ''}`}
          onMouseEnter={() => onHover(null)}
          onFocus={() => onHover(null)}
          onClick={onSelectNone}
        >
          <span className={styles.assistantRailAvatar}>
            <Lightning theme='outline' size={16} />
          </span>
          <span className={styles.assistantRailName}>{t('guid.noAssistant', { defaultValue: 'No assistant' })}</span>
        </button>
        {list.map((assistant) => {
          const avatar = resolveAssistantAvatar(assistant);
          const name = assistant.name_i18n?.[localeKey] || assistant.name;
          const isSelected = selectedAssistantId === assistant.id;
          return (
            <button
              key={assistant.id}
              type='button'
              title={name}
              data-testid={`assistant-rail-${assistant.id}`}
              className={`${styles.assistantRailItem} ${isSelected ? styles.assistantRailItemSelected : ''}`}
              onMouseEnter={() => onHover(assistant)}
              onFocus={() => onHover(assistant)}
              onClick={() => onSelect(`custom:${assistant.id}`)}
            >
              <span className={styles.assistantRailAvatar}>
                {avatar.kind === 'image' ? (
                  <img src={avatar.src} alt='' />
                ) : avatar.kind === 'emoji' ? (
                  <span className={styles.assistantRailEmoji}>{avatar.value}</span>
                ) : (
                  <Robot theme='outline' size={16} />
                )}
              </span>
              <span className={styles.assistantRailName}>{name}</span>
            </button>
          );
        })}
        <button
          type='button'
          data-testid='assistant-rail-add'
          className={styles.assistantRailAdd}
          onClick={() => navigate('/settings/assistants')}
          aria-label={t('guid.addAssistant', { defaultValue: 'Add assistant' })}
        >
          <Plus theme='outline' size={16} />
          <span className={styles.assistantRailName}>{t('guid.addAssistant', { defaultValue: 'Add assistant' })}</span>
        </button>
      </div>
    </div>
  );
};

export default AssistantRail;
