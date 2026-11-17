import api from './api';

const allowedRoles = new Set(['farmer', 'expert', 'approved_creator', 'provider', 'buyer', 'seller', 'admin']);

export function unwrapPayload(response) {
  const body = response?.data;
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

export function getAuthenticatedUser(response) {
  const payload = unwrapPayload(response);
  const candidate = payload?.user ?? payload?.profile ?? payload;
  const role = String(candidate?.role ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const roleAliases = { agricultural_expert: 'expert', service_provider: 'provider', administrator: 'admin' };
  const normalizedRole = roleAliases[role] || role;

  if (!candidate || typeof candidate !== 'object' || !allowedRoles.has(normalizedRole)) {
    const error = new Error('The authentication response did not include a valid server-authorized user role.');
    error.code = 'INVALID_AUTH_USER';
    throw error;
  }

  return { ...candidate, role: normalizedRole };
}

function toFormData(values) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || key === 'confirmPassword') return;
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
    } else {
      formData.append(key, value);
    }
  });
  return formData;
}

function hasFile(values) {
  return Object.values(values).some((value) => value instanceof File);
}

const authService = {
  async register(values) {
    const body = hasFile(values) ? toFormData(values) : values;
    const response = await api.post('/auth/register', body, {
      headers: hasFile(values) ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return unwrapPayload(response);
  },

  async registerWithVoice(values) {
    return api.post('/auth/voice/register', values);
  },

  async verifyVoiceRegistration(payload) {
    return api.post('/auth/voice/verify-registration', payload);
  },

  async updateInteractionMode(interactionMode) {
    return api.put('/auth/interaction-mode', { interactionMode });
  },

  async login(credentials) {
    return api.post('/auth/login', credentials);
  },

  async logout() {
    return api.post('/auth/logout');
  },

  async me(config = {}) {
    return api.get('/auth/me', { timeout: 10000, ...config });
  },

  async sendOtp(payload) {
    return api.post('/auth/send-otp', payload);
  },

  async verifyOtp(payload) {
    return api.post('/auth/verify-otp', payload);
  },

  async requestPasswordReset(payload) {
    return api.post('/auth/forgot-password', payload);
  },

  async resetPassword(payload) {
    return api.post('/auth/reset-password', payload);
  },
};

export function getAuthError(error, copy) {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (error?.code === 'INVALID_AUTH_USER') {
    return { status, message: copy.errors.invalidSession };
  }

  if (!error?.response) {
    const isNetworkError = error?.isAxiosError || error?.request || ['ERR_NETWORK', 'ECONNABORTED'].includes(error?.code);
    return { status, message: isNetworkError ? copy.errors.network : (error?.message || copy.errors.generic) };
  }

  return {
    status,
    message: typeof serverMessage === 'string' && serverMessage.trim()
      ? serverMessage
      : copy.errors.generic,
  };
}

export default authService;
