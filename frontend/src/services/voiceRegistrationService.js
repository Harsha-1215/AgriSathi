import api from './api';

const voiceRegistrationService = {
  async startSession(language = 'te') {
    const response = await api.post('/voice-registration/start', { language });
    return response.data;
  },

  async respond(sessionId, response, field) {
    const responseData = await api.post('/voice-registration/respond', { sessionId, response, field });
    return responseData.data;
  },

  async confirm(sessionId, confirmed = true) {
    const responseData = await api.post('/voice-registration/confirm', { sessionId, confirmed });
    return responseData.data;
  },

  async verifyOTP(sessionId, code) {
    const responseData = await api.post('/voice-registration/verify-otp', { sessionId, code });
    return responseData.data;
  },

  async resendOTP(sessionId) {
    const responseData = await api.post('/voice-registration/resend-otp', { sessionId });
    return responseData.data;
  },

  async getSession(sessionId) {
    const responseData = await api.get(`/voice-registration/session/${sessionId}`);
    return responseData.data;
  },
};

export default voiceRegistrationService;