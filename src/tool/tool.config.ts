import { defaultFeatures, type ExportFormat, type ToolConfig } from '@itsjust/core';

const toolConfigBase = {
  id: 'slug-uniqueness-checker',
  name: 'Slug Uniqueness Checker',
  category: 'Utility',
  description:
    'Validates a list of slugs or titles against a target set, flagging duplicates, collisions after normalization, reserved names, and URL-unsafe characters.',
  version: '1.0.0',
  exportFormats: ['png', 'pdf', 'json', 'jpeg', 'webp'] as ExportFormat[],
  features: { ...defaultFeatures },
  theme: { brand: 'Slug Uniqueness Checker', icon: '🔗' },
};

export const toolConfig: ToolConfig = toolConfigBase;
export const toolCategory = toolConfigBase.category as string;
export default toolConfig;
