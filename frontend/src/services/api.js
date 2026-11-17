import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const MODULE_API_BASE_URL = import.meta.env.VITE_MODULE_API_BASE_URL
  || (import.meta.env.VITE_API_BASE_URL ? API_BASE_URL : 'http://localhost:5001/api');
const modulePathPrefixes = [
  '/auth', '/farmers', '/public',
  '/assistant', '/crop-doctor', '/weather', '/land-measurements', '/calculators',
  '/crop-knowledge', '/agri-shorts', '/government-schemes', '/scheme-applications',
  '/marketplace', '/livestock', '/admin/crop-knowledge', '/admin/agri-shorts', '/admin/government-schemes',
  '/admin/marketplace', '/admin/livestock',
];

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
  timeout: 30000,
});

let refreshPromise = null;

api.interceptors.request.use(
  (config) => {
    if (modulePathPrefixes.some((prefix) => config.url?.startsWith(prefix))) {
      config.baseURL = MODULE_API_BASE_URL;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    const requestUrl = config?.url || '';
    const refreshExcluded = [
      '/auth/refresh-token',
      '/auth/login',
      '/auth/register',
      '/auth/logout',
      '/auth/send-otp',
      '/auth/verify-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
    ];

    if (error.response?.status !== 401 || !config || config._retry || refreshExcluded.some((path) => requestUrl.startsWith(path))) {
      return Promise.reject(error);
    }

    config._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh-token', {}, { timeout: 10000 });
      }
      await refreshPromise;
      return api.request(config);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);

export default api;

export { API_BASE_URL, MODULE_API_BASE_URL };