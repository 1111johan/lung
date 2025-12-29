/**
 * API 配置与密钥读取
 * - 从 Vite 环境变量中读取密钥，避免硬编码
 * - 使用时请在 .env 或系统环境变量中设置 VITE_DEEPSEEK_API_KEY
 */

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
const DEEPSEEK_BASE_URL = (import.meta.env.VITE_DEEPSEEK_BASE_URL as string | undefined) || 'https://api.deepseek.com';

export function getDeepseekApiKey() {
  if (!DEEPSEEK_API_KEY) {
    console.warn('DeepSeek API key is not configured. Set VITE_DEEPSEEK_API_KEY in your .env file.');
  }
  return DEEPSEEK_API_KEY;
}

export function getDeepseekBaseUrl() {
  return DEEPSEEK_BASE_URL;
}

export const apiConfig = {
  deepseek: {
    baseUrl: DEEPSEEK_BASE_URL,
    get apiKey() {
      return getDeepseekApiKey();
    },
  },
};
