const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const voiceRegistrationRoutes = require('./routes/voiceRegistrationRoutes');
const cropDoctorRoutes = require('./routes/cropDoctorRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const landMeasurementRoutes = require('./routes/landMeasurementRoutes');
const cropRoutes = require('./routes/cropRoutes');
const calculatorRoutes = require('./routes/calculatorRoutes');
const cropKnowledgeRoutes = require('./routes/cropKnowledgeRoutes');
const cropKnowledgeAdminRoutes = require('./routes/cropKnowledgeAdminRoutes');
const agriShortsRoutes = require('./routes/agriShortsRoutes');
const agriShortsAdminRoutes = require('./routes/agriShortsAdminRoutes');
const governmentSchemeRoutes = require('./routes/governmentSchemeRoutes');
const schemeApplicationRoutes = require('./routes/schemeApplicationRoutes');
const governmentSchemeAdminRoutes = require('./routes/governmentSchemeAdminRoutes');
const marketRoutes = require('./routes/marketRoutes');
const marketAdminRoutes = require('./routes/marketAdminRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const marketplaceAdminRoutes = require('./routes/marketplaceAdminRoutes');
const livestockRoutes = require('./routes/livestockRoutes');
const livestockAdminRoutes = require('./routes/livestockAdminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
const configuredOrigins = process.env.FRONTEND_ORIGINS || process.env.CORS_ORIGINS || '';
const developmentOrigins = process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set(
  [...developmentOrigins, ...configuredOrigins.split(',')]
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (!req.body) req.body = {};
  next();
});
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ success: true, service: 'agrisathi-api' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/voice-registration', voiceRegistrationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/crop-doctor', cropDoctorRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/land-measurements', landMeasurementRoutes);
app.use('/api/land-measurement', landMeasurementRoutes);
app.use('/api/land-plots', landMeasurementRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/calculators', calculatorRoutes);
app.use('/api/crop-knowledge', cropKnowledgeRoutes);
app.use('/api/admin/crop-knowledge', cropKnowledgeAdminRoutes);
app.use('/api/agri-shorts', agriShortsRoutes);
app.use('/api/admin/agri-shorts', agriShortsAdminRoutes);
app.use('/api/government-schemes', governmentSchemeRoutes);
app.use('/api/scheme-applications', schemeApplicationRoutes);
app.use('/api/admin/government-schemes', governmentSchemeAdminRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin/market', marketAdminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/admin/marketplace', marketplaceAdminRoutes);
app.use('/api/livestock', livestockRoutes);
app.use('/api/admin/livestock', livestockAdminRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'The requested endpoint was not found.' }));
app.use(errorHandler);

module.exports = app;
