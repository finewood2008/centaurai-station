/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Empty, Image, Spin } from '@arco-design/web-react';
import { DownloadOne, Refresh, Right } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { downloadFileFromPath } from '@/renderer/utils/file/download';
import type { ToolImageResult, ToolRunResult } from '../types';

type ResultStatus = 'idle' | 'running' | 'done' | 'error';

type ResultPanelProps = {
  status: ResultStatus;
  result: ToolRunResult | null;
  error: string | null;
  onOpenConversation: (conversationId: string) => void;
  onRegenerate: () => void;
};

function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || 'image.png';
}

const ImageCard: React.FC<{ image: ToolImageResult }> = ({ image }) => {
  const { t } = useTranslation();
  return (
    <div className='flex flex-col gap-6px rounded-10px overflow-hidden b-1 b-solid b-line-2 bg-1 p-8px'>
      {/* Arco Image gives click-to-zoom preview out of the box. */}
      <Image
        src={image.dataUrl}
        alt={fileName(image.path)}
        width='100%'
        height={320}
        className='rounded-8px bg-2 cursor-zoom-in'
        style={{ objectFit: 'contain' }}
      />
      <Button
        size='small'
        type='text'
        icon={<DownloadOne />}
        onClick={() => void downloadFileFromPath(image.path, fileName(image.path))}
      >
        {t('toolbox.download')}
      </Button>
    </div>
  );
};

/** Renders the run state: loading, generated images / text, or an error. */
export const ResultPanel: React.FC<ResultPanelProps> = ({
  status,
  result,
  error,
  onOpenConversation,
  onRegenerate,
}) => {
  const { t } = useTranslation();

  if (status === 'running') {
    return (
      <div className='flex flex-col items-center justify-center gap-12px py-48px'>
        <Spin dot />
        <span className='text-13px text-t-secondary'>{t('toolbox.generating')}</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className='flex flex-col items-center gap-12px py-32px'>
        <span className='text-13px text-rgb-danger'>{t('toolbox.runFailed')}</span>
        {error && <span className='text-12px text-t-tertiary break-all'>{error}</span>}
        <Button icon={<Refresh />} onClick={onRegenerate}>
          {t('toolbox.retry')}
        </Button>
      </div>
    );
  }

  if (status === 'done' && result) {
    const hasImages = result.images.length > 0;
    return (
      <div className='flex flex-col gap-12px'>
        {hasImages ? (
          <Image.PreviewGroup infinite={false}>
            <div
              className={
                result.images.length === 1 ? 'grid grid-cols-1 gap-12px' : 'grid grid-cols-1 sm:grid-cols-2 gap-12px'
              }
            >
              {result.images.map((image) => (
                <ImageCard key={image.path} image={image} />
              ))}
            </div>
          </Image.PreviewGroup>
        ) : (
          <div className='whitespace-pre-wrap text-13px text-t-primary'>{result.text || t('toolbox.noOutput')}</div>
        )}
        <div className='flex gap-8px'>
          <Button icon={<Refresh />} onClick={onRegenerate}>
            {t('toolbox.regenerate')}
          </Button>
          {result.conversation_id && (
            <Button type='outline' icon={<Right />} onClick={() => onOpenConversation(result.conversation_id)}>
              {t('toolbox.openInConversation')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <Empty description={t('toolbox.resultHint')} />;
};

export default ResultPanel;
