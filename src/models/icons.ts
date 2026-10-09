/**
 * Iconos de proveedor para los modelos.
 *
 * El catálogo guarda solo una clave de icono serializable (`iconKey`); aquí se
 * resuelve a un componente React. Los logos son SVG oficiales monocromos de
 * `@lobehub/icons-static-svg`; para proveedores desconocidos se usa `Bot`.
 */
import { Bot } from 'lucide-react';
import React, { type ElementType } from 'react';
import ai21Icon from '@lobehub/icons-static-svg/icons/ai21.svg';
import aionLabsIcon from '@lobehub/icons-static-svg/icons/aionlabs.svg';
import anthropicIcon from '@lobehub/icons-static-svg/icons/anthropic.svg';
import arceeIcon from '@lobehub/icons-static-svg/icons/arcee.svg';
import awsIcon from '@lobehub/icons-static-svg/icons/aws.svg';
import baiduIcon from '@lobehub/icons-static-svg/icons/baidu.svg';
import bytedanceIcon from '@lobehub/icons-static-svg/icons/bytedance.svg';
import cohereIcon from '@lobehub/icons-static-svg/icons/cohere.svg';
import deepCogitoIcon from '@lobehub/icons-static-svg/icons/deepcogito.svg';
import deepSeekIcon from '@lobehub/icons-static-svg/icons/deepseek.svg';
import essentialAiIcon from '@lobehub/icons-static-svg/icons/essentialai.svg';
import fireworksIcon from '@lobehub/icons-static-svg/icons/fireworks.svg';
import googleIcon from '@lobehub/icons-static-svg/icons/google.svg';
import groqIcon from '@lobehub/icons-static-svg/icons/groq.svg';
import ibmIcon from '@lobehub/icons-static-svg/icons/ibm.svg';
import inceptionIcon from '@lobehub/icons-static-svg/icons/inception.svg';
import inflectionIcon from '@lobehub/icons-static-svg/icons/inflection.svg';
import kwaipilotIcon from '@lobehub/icons-static-svg/icons/kwaipilot.svg';
import liquidIcon from '@lobehub/icons-static-svg/icons/liquid.svg';
import metaIcon from '@lobehub/icons-static-svg/icons/meta.svg';
import microsoftIcon from '@lobehub/icons-static-svg/icons/microsoft.svg';
import minimaxIcon from '@lobehub/icons-static-svg/icons/minimax.svg';
import mistralIcon from '@lobehub/icons-static-svg/icons/mistral.svg';
import moonshotIcon from '@lobehub/icons-static-svg/icons/moonshot.svg';
import morphIcon from '@lobehub/icons-static-svg/icons/morph.svg';
import nousResearchIcon from '@lobehub/icons-static-svg/icons/nousresearch.svg';
import nvidiaIcon from '@lobehub/icons-static-svg/icons/nvidia.svg';
import openAiIcon from '@lobehub/icons-static-svg/icons/openai.svg';
import openRouterIcon from '@lobehub/icons-static-svg/icons/openrouter.svg';
import perplexityIcon from '@lobehub/icons-static-svg/icons/perplexity.svg';
import qwenIcon from '@lobehub/icons-static-svg/icons/qwen.svg';
import relaceIcon from '@lobehub/icons-static-svg/icons/relace.svg';
import stepfunIcon from '@lobehub/icons-static-svg/icons/stepfun.svg';
import tencentIcon from '@lobehub/icons-static-svg/icons/tencent.svg';
import togetherIcon from '@lobehub/icons-static-svg/icons/together.svg';
import upstageIcon from '@lobehub/icons-static-svg/icons/upstage.svg';
import xAiIcon from '@lobehub/icons-static-svg/icons/xai.svg';
import xiaomiIcon from '@lobehub/icons-static-svg/icons/xiaomimimo.svg';
import zhipuIcon from '@lobehub/icons-static-svg/icons/zhipu.svg';

const PROVIDER_ICON_PATHS: Readonly<Record<string, string>> = {
  ai21: ai21Icon,
  'aion-labs': aionLabsIcon,
  aionlabs: aionLabsIcon,
  amazon: awsIcon,
  aws: awsIcon,
  anthropic: anthropicIcon,
  'arcee-ai': arceeIcon,
  arcee: arceeIcon,
  baidu: baiduIcon,
  bytedance: bytedanceIcon,
  'bytedance-seed': bytedanceIcon,
  cohere: cohereIcon,
  deepcogito: deepCogitoIcon,
  deepseek: deepSeekIcon,
  essentialai: essentialAiIcon,
  fireworks: fireworksIcon,
  glm: zhipuIcon,
  google: googleIcon,
  groq: groqIcon,
  'ibm-granite': ibmIcon,
  ibm: ibmIcon,
  inception: inceptionIcon,
  inflection: inflectionIcon,
  kwaipilot: kwaipilotIcon,
  liquid: liquidIcon,
  meta: metaIcon,
  'meta-llama': metaIcon,
  microsoft: microsoftIcon,
  minimax: minimaxIcon,
  mistral: mistralIcon,
  mistralai: mistralIcon,
  moonshot: moonshotIcon,
  moonshotai: moonshotIcon,
  morph: morphIcon,
  nousresearch: nousResearchIcon,
  nvidia: nvidiaIcon,
  openai: openAiIcon,
  openrouter: openRouterIcon,
  perplexity: perplexityIcon,
  qwen: qwenIcon,
  relace: relaceIcon,
  stepfun: stepfunIcon,
  tencent: tencentIcon,
  together: togetherIcon,
  upstage: upstageIcon,
  'x-ai': xAiIcon,
  xai: xAiIcon,
  xiaomi: xiaomiIcon,
  'z-ai': zhipuIcon,
  zhipu: zhipuIcon,
};

const providerIconCache = new Map<string, ElementType>();

const createImageIcon = (src: string): ElementType => {
  const cached = providerIconCache.get(src);
  if (cached) {
    return cached;
  }

  const ImageIcon = ({
    className,
    size = 20,
    style,
  }: {
    className?: string;
    size?: number;
    style?: React.CSSProperties;
  }) =>
    React.createElement('img', {
      src,
      className: ['model-provider-logo', className].filter(Boolean).join(' '),
      style: {
        width: size,
        height: size,
        objectFit: 'contain',
        ...style,
      },
      alt: '',
      'aria-hidden': true,
      draggable: false,
    });

  ImageIcon.displayName = `ModelIcon(${src})`;
  providerIconCache.set(src, ImageIcon as ElementType);
  return ImageIcon as ElementType;
};

/**
 * Resuelve una clave de icono (id de proveedor, p. ej. `anthropic`, o ruta a
 * un SVG propio) a un componente. Las instancias se cachean por ruta para que
 * React no remonte el `<img>` en cada render.
 */
export const resolveModelIcon = (iconKey: string | undefined): ElementType => {
  if (!iconKey) {
    return Bot;
  }

  const providerIconPath = PROVIDER_ICON_PATHS[iconKey.toLowerCase().replace(/^~/, '')];
  if (providerIconPath) {
    return createImageIcon(providerIconPath);
  }

  if (iconKey.startsWith('/') || iconKey.startsWith('http')) {
    return createImageIcon(iconKey);
  }
  return Bot;
};
