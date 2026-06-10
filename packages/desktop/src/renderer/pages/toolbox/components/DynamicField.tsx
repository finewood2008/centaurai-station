/**
 * @license
 * Copyright 2025 CentaurAI (centaurloop.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, InputNumber, Select, Tag } from '@arco-design/web-react';
import { DownloadOne } from '@icon-park/react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import type { ToolField } from '../types';

const TextArea = Input.TextArea;
const Option = Select.Option;

type DynamicFieldValue = string | number | string[] | undefined;

type DynamicFieldProps = {
  field: ToolField;
  value: DynamicFieldValue;
  onChange: (name: string, value: string | number | string[]) => void;
};

/** Render the file name from an absolute path. */
function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** Renders a single tool form field based on its declared type. */
export const DynamicField: React.FC<DynamicFieldProps> = ({ field, value, onChange }) => {
  const { t } = useTranslation();
  const label = t(field.labelKey);
  const placeholder = field.placeholderKey ? t(field.placeholderKey) : undefined;

  const pickFiles = useCallback(async () => {
    const properties: Array<'openFile' | 'multiSelections'> = field.multiple
      ? ['openFile', 'multiSelections']
      : ['openFile'];
    const files = await ipcBridge.dialog.showOpen.invoke({ properties });
    if (files && files.length > 0) {
      const current = Array.isArray(value) ? value : [];
      onChange(field.name, field.multiple ? [...current, ...files] : [files[0]]);
    }
  }, [field.multiple, field.name, onChange, value]);

  const removeFile = useCallback(
    (path: string) => {
      const current = Array.isArray(value) ? value : [];
      onChange(
        field.name,
        current.filter((p) => p !== path)
      );
    },
    [field.name, onChange, value]
  );

  const renderControl = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <TextArea
            value={typeof value === 'string' ? value : ''}
            placeholder={placeholder}
            autoSize={{ minRows: 3, maxRows: 8 }}
            onChange={(v) => onChange(field.name, v)}
          />
        );
      case 'number':
        return (
          <InputNumber
            value={typeof value === 'number' ? value : undefined}
            min={field.min}
            max={field.max}
            placeholder={placeholder}
            className='w-full'
            onChange={(v) => onChange(field.name, typeof v === 'number' ? v : (field.min ?? 1))}
          />
        );
      case 'select':
        return (
          <Select
            value={typeof value === 'string' ? value : undefined}
            placeholder={placeholder}
            onChange={(v) => onChange(field.name, v)}
          >
            {(field.options ?? []).map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </Option>
            ))}
          </Select>
        );
      case 'upload': {
        const files = Array.isArray(value) ? value : [];
        return (
          <div className='flex flex-col gap-8px'>
            <Button icon={<DownloadOne />} onClick={() => void pickFiles()}>
              {placeholder || label}
            </Button>
            {files.length > 0 && (
              <div className='flex flex-wrap gap-4px'>
                {files.map((path) => (
                  <Tag key={path} closable onClose={() => removeFile(path)}>
                    {baseName(path)}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'text':
      default:
        return (
          <Input
            value={typeof value === 'string' ? value : ''}
            placeholder={placeholder}
            onChange={(v) => onChange(field.name, v)}
          />
        );
    }
  };

  return (
    <div className='flex flex-col gap-4px'>
      <span className='text-13px text-t-secondary'>
        {label}
        {field.required && <span className='text-rgb-danger ml-2px'>*</span>}
      </span>
      {renderControl()}
    </div>
  );
};

export default DynamicField;
