const jwt = require('jsonwebtoken');

function getToken(req) {
  const cookieName = process.env.AUTH_COOKIE_NAME || 'accessToken';
  const cookieToken = req.cookies && req.cookies[cookieName];
  if (cookieToken) return cookieToken;

  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function safeProfile(claims) {
  const profile = claims.profile && typeof claims.profile === 'object'
    ? claims.profile
    : claims.user && typeof claims.user === 'object' ? claims.user.profile || claims.user : claims;
  const result = {};
  [
    'name', 'location', 'state', 'district', 'mandal', 'village', 'pinCode',
    'landArea', 'landAreaUnit', 'areaUnit', 'farmName', 'farmLocation',
    'primaryCrop', 'otherCrops', 'currentCrops', 'soilType', 'irrigationMethod',
    'farmerCategory', 'livestock', 'agriculturalActivities', 'preferredLanguage',
    'latitude', 'longitude',
  ].forEach((key) => {
    if (profile[key] !== undefined && profile[key] !== null) result[key] = profile[key];
  });
  return result;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Authentication is required.' });
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ success: false, message: 'Authentication is not configured on this server.' });
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const id = claims.sub || claims.userId || claims.id || (claims.user && claims.user.id);
    const role = claims.role || (claims.user && claims.user.role);
    if (id === undefined || id === null || typeof role !== 'string') {
      return res.status(401).json({ success: false, message: 'The authenticated session is incomplete.' });
    }

    const allowedRoles = Array.isArray(claims.roles)
      ? claims.roles.filter((item) => typeof item === 'string').map((item) => item.toLowerCase())
      : [role.toLowerCase()];
    req.user = { id: String(id), role: role.toLowerCase(), roles: allowedRoles, profile: safeProfile(claims) };
    req.authToken = token;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'The authenticated session is invalid or expired.' });
    }
    return next(error);
  }
}

function requireFarmer(req, res, next) {
  if (!req.user || !['farmer', 'farmer_user'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'This feature is available to farmer accounts.' });
  }
  return next();
}

function requireRoles(roles) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    if (!req.user || !allowed.has(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Your account does not have permission to use this feature.' });
    }
    return next();
  };
}

function requireAdmin(req, res, next) {
  return requireRoles(['admin'])(req, res, next);
}

async function checkAccountStatus(req, res, next) {
  try {
    const { User, UserRole } = require('../models');
    const role = req.user.role === 'farmer_user' ? 'farmer' : req.user.role;
    const [user, assignedRole] = await Promise.all([
      User.findByPk(req.user.id, { attributes: ['id', 'status', 'isVerified'] }),
      UserRole.findOne({ where: { userId: req.user.id, role }, attributes: ['id'] }),
    ]);
    if (!user || user.status !== 'active' || !user.isVerified || !assignedRole) {
      return res.status(401).json({ success: false, message: 'The account is not available.' });
    }
    req.account = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireApprovedExpert(req, res, next) {
  const { ExpertProfile } = require('../models');
  ExpertProfile.findOne({ where: { userId: req.user.id, approvalStatus: 'approved' } })
    .then((profile) => profile
      ? next()
      : res.status(403).json({ success: false, message: 'An approved expert account is required.' }))
    .catch(next);
}

function requireApprovedProvider(req, res, next) {
  const { ServiceProviderProfile } = require('../models');
  ServiceProviderProfile.findOne({ where: { userId: req.user.id, approvalStatus: 'approved' } })
    .then((profile) => profile
      ? next()
      : res.status(403).json({ success: false, message: 'An approved service provider account is required.' }))
    .catch(next);
}

module.exports = {
  requireAuth,
  requireFarmer,
  requireRoles,
  requireAdmin,
  checkAccountStatus,
  requireApprovedExpert,
  requireApprovedProvider,
};
