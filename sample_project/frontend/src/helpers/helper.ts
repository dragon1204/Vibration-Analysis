import { API_ENDPOINT } from '@/configs/constant.config';

/**
 * Utility to get the base API URL.
 * Previously used for VR share URL routing — now simplified.
 */
export const getBaseApiUrl = () => API_ENDPOINT || '';
