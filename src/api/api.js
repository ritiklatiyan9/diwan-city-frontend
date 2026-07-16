import axios from 'axios';
import { toast } from 'sonner';
import eventBus from '../utils/eventBus';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const sessionId = localStorage.getItem('sessionId');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (sessionId) {
      config.headers['X-Session-ID'] = sessionId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Emit data-mutated event on any successful non-GET request (skip auth/upload-only/search)
api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || '').toLowerCase();
    if (method !== 'get') {
      const url = response.config.url || '';
      const skip = /\/auth\/|\/upload\/|\/search/i.test(url);
      if (!skip) {
        eventBus.emit('data-mutated', { method, url });
      }
    }
    return response;
  },
);

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('sessionId');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Avoid parallel refresh calls (race condition can invalidate tokens unexpectedly).
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const response = await refreshPromise;

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        api.defaults.headers.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (err) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionId');
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    if (error.response?.status === 403) {
      toast.error(error.response?.data?.message || 'You do not have permission for this action.');
    }

    return Promise.reject(error);
  }
);

export default api;
