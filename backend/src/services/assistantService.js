const { Op } = require('sequelize');
const HttpError = require('../utils/httpError');
const {
  sequelize,
  AssistantConversation,
  AssistantMessage,
  AssistantUsageLog,
  LivestockListing,
  LivestockCategory,
  LivestockBreed,
  LivestockSellerProfile,
} = require('../models');
const { generateText } = require('./geminiService');
const { getFarmerContext } = require('./farmerContextService');

const livestockQuestionPattern = /\b(livestock|cattle|cow|cows|bull|buffalo|buffaloes|goat|goats|sheep|poultry|chicken|duck|turkey|pig|rabbit|animal|breed|dairy|milk)\b|పశు|పశువ|ఆవు|గేదె|మేక|గొర్రె|కోడి|బర్రె|पशु|गाय|भैंस|बकरी|भेड़|मुर्ग|दूध/i;
const livestockCategories = [
  { slug: 'cattle', pattern: /\b(cattle|cow|cows|bull|calf|calves|dairy cattle)\b|ఆవు|ఎద్దు|దూడ|गाय|बैल|बछड़ा/i },
  { slug: 'buffaloes', pattern: /\bbuffalo(?:es)?\b|గేదె|బర్రె|भैंस/i },
  { slug: 'goats', pattern: /\bgoat(?:s)?\b|మేక|बकरी/i },
  { slug: 'sheep', pattern: /\bsheep\b|గొర్రె|भेड़/i },
  { slug: 'poultry', pattern: /\b(poultry|chicken|chickens|duck|ducks|turkey|turkeys|broiler|layers?)\b|కోడి|బాతు|मुर्ग|बत्तख|टर्की/i },
  { slug: 'other-livestock', pattern: /\b(pig|pigs|rabbit|rabbits)\b|పంది|కుందేలు|सूअर|खरगोश/i },
];

async function getLivestockListings(question, user) {
  if (!livestockQuestionPattern.test(question)) return [];
  const where = { status: 'approved', availability: 'available' };
  if (user.profile.district) where.district = { [Op.iLike]: user.profile.district };
  const categories = livestockCategories.filter((item) => item.pattern.test(question)).map((item) => item.slug);
  if (categories.length) {
    const categoryRows = await LivestockCategory.findAll({
      where: { slug: { [Op.in]: categories }, isActive: true },
      attributes: ['id'],
    });
    where.categoryId = { [Op.in]: categoryRows.map((item) => item.id) };
  }
  const maxPriceMatch = question.match(/\b(?:under|below|less than|up to|upto|max(?:imum)?)\s*(?:₹|rs\.?\s*)?([\d,]+)\b|(?:లోపు|వరకు|से कम|तक)\s*₹?\s*([\d,]+)/i);
  const minPriceMatch = question.match(/\b(?:over|above|more than|minimum)\s*(?:₹|rs\.?\s*)?([\d,]+)\b|(?:కంటే ఎక్కువ|से अधिक)\s*₹?\s*([\d,]+)/i);
  const maximum = maxPriceMatch ? Number((maxPriceMatch[1] || maxPriceMatch[2]).replace(/,/g, '')) : null;
  const minimum = minPriceMatch ? Number((minPriceMatch[1] || minPriceMatch[2]).replace(/,/g, '')) : null;
  if (Number.isFinite(maximum) && maximum >= 0) where.price = { ...(where.price || {}), [Op.lte]: maximum };
  if (Number.isFinite(minimum) && minimum >= 0) where.price = { ...(where.price || {}), [Op.gte]: minimum };
  if (/\b(female|cow|dairy cow)\b|ఆడ|मादा|गाय/i.test(question)) where.gender = 'female';
  else if (/\b(male|bull|buck|ram)\b|మగ|ఎద్దు|नर|बैल/i.test(question)) where.gender = 'male';

  const breeds = await LivestockBreed.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'translations'],
  });
  const query = question.toLocaleLowerCase();
  const matchingBreeds = breeds.filter((breed) => [
    breed.name,
    ...Object.values(breed.translations || {}),
  ].some((label) => typeof label === 'string' && label.length >= 3 && query.includes(label.toLocaleLowerCase())));
  if (matchingBreeds.length) where.breedId = { [Op.in]: matchingBreeds.map((breed) => breed.id) };

  const rows = await LivestockListing.findAll({
    where,
    include: [
      { model: LivestockCategory, attributes: ['name', 'translations'], where: { isActive: true }, required: true },
      { model: LivestockBreed, attributes: ['name', 'translations'], required: false },
      {
        model: LivestockSellerProfile,
        attributes: ['sellerName', 'verificationStatus'],
        where: { isSuspended: false },
        required: true,
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 8,
  });
  return rows.map((listing) => ({
    animal: listing.listingName,
    category: listing.LivestockCategory.name,
    breed: listing.LivestockBreed ? listing.LivestockBreed.name : null,
    ageMonths: listing.ageMonths,
    gender: listing.gender,
    approximateWeightKg: listing.weightKg === null ? null : Number(listing.weightKg),
    sellerReportedHealth: listing.healthCondition,
    sellerReportedVaccination: listing.vaccinationStatus,
    askingPriceRupees: Number(listing.price),
    negotiable: listing.negotiable,
    seller: listing.LivestockSellerProfile.sellerName,
    sellerVerified: listing.LivestockSellerProfile.verificationStatus === 'verified',
    district: listing.district,
    village: listing.locationPublic ? listing.village : null,
    updatedAt: listing.updatedAt,
  }));
}

async function checkUsage(userId) {
  const limit = Math.max(1, Math.min(500, Number.parseInt(process.env.ASSISTANT_DAILY_LIMIT, 10) || 40));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const used = await AssistantUsageLog.count({ where: { userId, requestType: 'text', createdAt: { [Op.gte]: start } } });
  if (used >= limit) throw new HttpError(429, 'You have reached today’s assistant request limit. Please try again tomorrow.');
}

async function recordExchange({ userId, question, answer, language, conversationId = null }) {
  const transaction = await sequelize.transaction();
  try {
    let conversation = conversationId
      ? await AssistantConversation.findOne({ where: { id: conversationId, userId }, transaction })
      : null;
    if (conversationId && !conversation) throw new HttpError(404, 'Conversation not found.');
    if (!conversation) {
      conversation = await AssistantConversation.create({
        userId,
        title: question.slice(0, 80),
        language,
      }, { transaction });
    } else {
      await conversation.update({ language }, { transaction });
    }
    const userMessage = await AssistantMessage.create({
      conversationId: conversation.id,
      role: 'user',
      message: question,
    }, { transaction });
    const assistantMessage = await AssistantMessage.create({
      conversationId: conversation.id,
      role: 'assistant',
      message: answer,
    }, { transaction });
    await conversation.update({ updatedAt: new Date() }, { transaction });
    await transaction.commit();
    return {
      conversationId: conversation.id,
      messages: [userMessage, assistantMessage],
      answer,
      language,
      generatedAt: assistantMessage.createdAt,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function ask({ user, question, language, context = {}, conversationId = null }) {
  await checkUsage(user.id);
  let conversation = null;
  let history = [];
  if (conversationId) {
    conversation = await AssistantConversation.findOne({ where: { id: conversationId, userId: user.id } });
    if (!conversation) throw new HttpError(404, 'Conversation not found.');
    history = await AssistantMessage.findAll({
      where: { conversationId },
      order: [['createdAt', 'DESC']],
      limit: 8,
    });
    history = history.reverse().map((message) => ({ role: message.role, message: message.message }));
  }
  const [contextData, livestockListings] = await Promise.all([
    getFarmerContext(user.id, { ...context, language }, question),
    getLivestockListings(question, user),
  ]);
  const usage = await AssistantUsageLog.create({
    userId: user.id,
    provider: 'gemini',
    requestType: 'text',
    status: 'processing',
  });
  let answer;
  try {
    answer = await generateText({
      question,
      language,
      profile: {},
      history,
      livestockListings,
      contextData,
    });
    await usage.update({ status: 'completed' });
  } catch (error) {
    await usage.update({ status: 'failed' });
    throw error;
  }

  return recordExchange({ userId: user.id, question, answer, language, conversationId });
}

module.exports = { ask, recordExchange, getLivestockListings };
