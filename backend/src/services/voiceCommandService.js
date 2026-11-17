const { Op } = require('sequelize');

const serviceAliases = [
  { pattern: /tractor|ట్రాక్టర్|ट्रैक्टर/i, category: 'Tractor rental' },
  { pattern: /drone|డ్రోన్|ड्रोन/i, category: 'Drone spraying' },
  { pattern: /labou?r|కూలి|కూలీలు|मजदूर/i, category: 'Agricultural labour' },
  { pattern: /harvest|హార్వెస్ట|కోత యంత్రం|हार्वेस्टर/i, category: 'Harvesting machines' },
  { pattern: /soil test|నేల పరీక్ష|మట్టి పరీక్ష|मिट्टी जाँच|मिट्टी जांच/i, category: 'Soil testing' },
  { pattern: /veterinary|vet(?:erinary)?|పశువైద్య|पशु चिकित्सा/i, category: 'Veterinary services' },
  { pattern: /irrigation|drip|నీటిపారుదల|డ్రిప్|सिंचाई|ड्रिप/i, category: 'Irrigation services' },
  { pattern: /equipment|పరికరాల అద్దె|उपकरण किराया/i, category: 'Equipment rental' },
  { pattern: /transportation|transport|రవాణా|परिवहन/i, category: 'Transportation' },
];

const productAliases = [
  { pattern: /urea|యూరియా|यूरिया/i, term: 'urea', category: 'fertilizer' },
  { pattern: /fertili[sz]er|ఎరువులు?|खाद/i, term: '', category: 'fertilizer' },
  { pattern: /seed|విత్తనాలు?|बीज/i, term: '', category: 'seed' },
  { pattern: /pesticide|పురుగుమందు|कीटनाशक/i, term: '', category: 'pesticide' },
];

function classifyCommand(command) {
  const text = command.trim();
  const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:acres?|ఎకరాలు?|एकड़)/i);
  const areaWords = { one: 1, two: 2, three: 3, నాలుగు: 4, రెండు: 2, ఒకటి: 1, एक: 1, दो: 2, तीन: 3 };
  const spokenArea = Object.entries(areaWords).find(([word]) => /[a-z]/i.test(word)
    ? new RegExp(`\\b${word}\\b`, 'i').test(text)
    : text.includes(word));
  const landArea = areaMatch ? Number(areaMatch[1]) : spokenArea ? spokenArea[1] : null;
  const service = serviceAliases.find((item) => item.pattern.test(text));
  if (/order|delivery|track|ఆర్డర్|డెలివరీ|ऑर्डर|डिलीवरी/i.test(text)) {
    return { intent: 'order_status', entities: {} };
  }
  if (/my bookings?|show bookings?|నా బుకింగ్స్|నా బుకింగ్|बुकिंग दिखाओ|मेरी बुकिंग/i.test(text)) {
    return { intent: 'booking_status', entities: {} };
  }
  if (service && (/booking|book|reserve|schedule|బుకింగ్|బుక్|చేయించు|बुकिंग|बुक|tomorrow|today|రేపు|ఈరోజు|कल|आज/i.test(text))) {
    return { intent: 'service_booking', entities: { serviceCategory: service.category, landArea } };
  }
  if (/పశు|పశువ|ఆవు|గేదె|మేక|గొర్రె|కోడి|livestock|cattle|cow|buffalo|goat|sheep|poultry/i.test(text)) {
    return { intent: 'livestock_search', entities: {} };
  }
  if (/sell|list|విక్రయించ|అమ్మాలి|అమ్మకం|बेचना|बेचनी/i.test(text)) {
    const quantity = text.match(/(\d+(?:\.\d+)?)\s*(quintals?|క్వింటాళ్లు?|కిలోలు?|kg|టన్నులు?|tons?)/i);
    return {
      intent: 'listing_draft',
      entities: {
        product: /paddy|rice|వరి|ధాన్యం|धान|चावल/i.test(text) ? 'paddy' : null,
        quantity: quantity ? Number(quantity[1]) : null,
        unit: quantity ? quantity[2] : null,
      },
    };
  }
  if (/price|rate|ధర|ధరలు|ధాన్యం ధర|మార్కెట్ ధర|भाव|मूल्य/i.test(text)
    && /paddy|rice|వరి|धान|चावल/i.test(text)) {
    return { intent: 'market_prices', entities: { commodity: 'paddy' } };
  }
  if (service) {
    return { intent: 'service_search', entities: { serviceCategory: service.category, landArea } };
  }
  const product = productAliases.find((item) => item.pattern.test(text));
  if (product) return { intent: 'product_search', entities: { term: product.term, category: product.category } };
  return { intent: 'general_question', entities: {} };
}

async function findProducts({ term, category, district }) {
  const { MarketplaceProduct, MarketplaceCategory } = require('../models');
  const categoryWhere = category
    ? { name: { [Op.iLike]: `%${category}%` } }
    : undefined;
  const where = { status: 'approved', availability: 'available', availableQuantity: { [Op.gt]: 0 } };
  if (term) where.productName = { [Op.iLike]: `%${term}%` };
  if (district) where.district = { [Op.iLike]: district };
  const categories = categoryWhere
    ? await MarketplaceCategory.findAll({ where: categoryWhere, attributes: ['id'] })
    : [];
  if (categoryWhere) {
    const ids = categories.map((item) => item.id);
    where.categoryId = { [Op.in]: ids };
  }
  const rows = await MarketplaceProduct.findAll({
    where,
    include: [{ model: MarketplaceCategory, attributes: ['name', 'translations'], required: true }],
    order: [['createdAt', 'DESC']],
    limit: 6,
  });
  return rows.map((item) => ({
    id: item.id,
    product: item.productName,
    category: item.MarketplaceCategory.name,
    price: Number(item.price),
    unit: item.unit,
    availableQuantity: Number(item.availableQuantity),
    district: item.district,
    availability: item.availability,
  }));
}

async function findMarketPrices(district) {
  const { MarketPrice, Commodity, AgriculturalMarket } = require('../models');
  const commodities = await Commodity.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'localName', 'translations', 'standardUnit'] });
  const matches = commodities.filter((item) => /paddy|rice|వరి|धान|चावल/i.test([
    item.name,
    item.localName || '',
    ...Object.values(item.translations || {}),
  ].join(' ')));
  if (!matches.length) return [];
  const marketWhere = district ? { district: { [Op.iLike]: district } } : {};
  const rows = await MarketPrice.findAll({
    where: { commodityId: { [Op.in]: matches.map((item) => item.id) } },
    include: [
      { model: Commodity, attributes: ['name', 'localName', 'standardUnit'], required: true },
      { model: AgriculturalMarket, attributes: ['name', 'district', 'state'], where: marketWhere, required: Boolean(district) },
    ],
    order: [['arrivalDate', 'DESC']],
    limit: 6,
  });
  return rows.map((item) => ({
    commodity: item.Commodity.name,
    market: item.AgriculturalMarket.name,
    district: item.AgriculturalMarket.district,
    arrivalDate: item.arrivalDate,
    minimumPrice: Number(item.minimumPrice),
    maximumPrice: Number(item.maximumPrice),
    modalPrice: Number(item.modalPrice),
    unit: item.unit,
    currency: item.currency,
  }));
}

async function findProviders({ serviceCategory, district }) {
  const { ServiceProviderProfile } = require('../models');
  const where = { approvalStatus: 'approved' };
  if (district) where.district = { [Op.iLike]: district };
  const rows = await ServiceProviderProfile.findAll({
    where,
    attributes: ['userId', 'businessName', 'serviceCategories', 'serviceDescription', 'pricing', 'workingHours', 'district', 'village'],
    order: [['updatedAt', 'DESC']],
    limit: 30,
  });
  const serviceMatch = {
    'tractor rental': /tractor|ట్రాక్టర్|ट्रैक्टर/i,
    'irrigation services': /irrigation|drip|నీటిపారుదల|డ్రిప్|सिंचाई/i,
    'drone spraying': /drone|డ్రోన్|ड्रोन/i,
    'agricultural labour': /labou?r|కూలి|मजदूर/i,
    'harvesting machines': /harvest|కోత|कटाई/i,
    'soil testing': /soil|నేల పరీక్ష|మట్టి పరీక్ష|मिट्टी जाँच|मिट्टी जांच/i,
    'veterinary services': /veterinary|vet|పశువైద్య|पशु चिकित्सा/i,
    'equipment rental': /equipment|పరికరాల అద్దె|उपकरण किराया/i,
    transportation: /transport|రవాణా|परिवहन/i,
  }[serviceCategory.toLocaleLowerCase()] || new RegExp(serviceCategory.split(' ')[0], 'i');
  return rows
    .filter((item) => (item.serviceCategories || []).some((value) => serviceMatch.test(String(value))))
    .slice(0, 6)
    .map((item) => ({
      providerId: item.userId,
      businessName: item.businessName,
      serviceCategory,
      serviceDescription: item.serviceDescription,
      pricing: item.pricing,
      workingHours: item.workingHours,
      district: item.district,
      village: item.village,
    }));
}

async function findOrders(userId) {
  const { MarketplaceOrder } = require('../models');
  const rows = await MarketplaceOrder.findAll({
    where: { buyerId: String(userId) },
    attributes: ['id', 'status', 'paymentStatus', 'total', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });
  return rows.map((item) => ({
    id: item.id,
    status: item.status,
    paymentStatus: item.paymentStatus,
    total: Number(item.total),
    createdAt: item.createdAt,
  }));
}

async function findBookings(userId) {
  const { ServiceBooking, ServiceProviderProfile } = require('../models');
  const rows = await ServiceBooking.findAll({
    where: { farmerId: userId },
    include: [{ model: ServiceProviderProfile, attributes: ['businessName'] }],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });
  return rows.map((item) => ({
    id: item.id,
    provider: item.ServiceProviderProfile?.businessName || 'Service provider',
    serviceCategory: item.serviceCategory,
    requestedDate: item.requestedDate,
    status: item.status,
  }));
}

function responseText(language, intent, results, entities) {
  if (language === 'en') {
    if (intent === 'product_search') return results.length
      ? `I found ${results.length} approved marketplace listings: ${results.map((item) => `${item.product}, ₹${item.price}/${item.unit}, ${item.district || 'location not listed'}`).join('; ')}.`
      : 'There are no matching approved marketplace listings right now.';
    if (intent === 'market_prices') return results.length
      ? `Latest verified market records: ${results.map((item) => `${item.market}, ${item.arrivalDate}, modal price ₹${item.modalPrice}/${item.unit}`).join('; ')}.`
      : 'Verified paddy market prices are not available right now.';
    if (intent === 'service_search' || intent === 'service_booking') return results.length
      ? `${intent === 'service_booking' ? 'Available approved providers' : 'Approved service providers'}: ${results.map((item) => `${item.businessName}, ${item.district || ''}, pricing: ${item.pricing || 'contact provider'}`).join('; ')}.${intent === 'service_booking' ? ' Select a provider, date, and location, then explicitly confirm before a booking is created.' : ''}`
      : 'No approved providers matching that service are listed for your district.';
    if (intent === 'order_status') return results.length
      ? `Your recent orders: ${results.map((item) => `${item.id.slice(0, 8)} is ${item.status}, total ₹${item.total}`).join('; ')}.`
      : 'No order history was found for your account.';
    if (intent === 'booking_status') return results.length
      ? `Your recent service bookings: ${results.map((item) => `${item.serviceCategory} with ${item.provider} on ${item.requestedDate}, status ${item.status}`).join('; ')}.`
      : 'No service booking history was found for your account.';
    if (intent === 'listing_draft') return `I can prepare a ${entities.product || 'product'} listing draft. I still need ${entities.quantity ? 'the expected price and pickup location' : 'quantity, expected price, and pickup location'}. Nothing will be listed until you review and confirm.`;
  }
  if (language === 'hi') {
    if (intent === 'product_search') return results.length
      ? `स्वीकृत मार्केटप्लेस में ${results.length} उत्पाद मिले: ${results.map((item) => `${item.product}, ₹${item.price}/${item.unit}, ${item.district || 'स्थान उपलब्ध नहीं'}`).join('; ')}।`
      : 'अभी कोई मेल खाती स्वीकृत उत्पाद सूची उपलब्ध नहीं है।';
    if (intent === 'market_prices') return results.length
      ? `नवीनतम सत्यापित मंडी जानकारी: ${results.map((item) => `${item.market}, ${item.arrivalDate}, मॉडल भाव ₹${item.modalPrice}/${item.unit}`).join('; ')}।`
      : 'अभी सत्यापित धान के मंडी भाव उपलब्ध नहीं हैं।';
    if (intent === 'service_search' || intent === 'service_booking') return results.length
      ? `स्वीकृत सेवा प्रदाता: ${results.map((item) => `${item.businessName}, ${item.district || ''}, कीमत: ${item.pricing || 'प्रदाता से पूछें'}`).join('; ')}।${intent === 'service_booking' ? ' बुकिंग बनाने से पहले प्रदाता, तारीख और स्थान चुनकर स्पष्ट पुष्टि करें।' : ''}`
      : 'आपके जिले में इस सेवा के स्वीकृत प्रदाता नहीं मिले।';
    if (intent === 'order_status') return results.length
      ? `आपके हाल के ऑर्डर: ${results.map((item) => `${item.id.slice(0, 8)}, स्थिति ${item.status}, कुल ₹${item.total}`).join('; ')}।`
      : 'आपके खाते में कोई ऑर्डर इतिहास नहीं मिला।';
    if (intent === 'booking_status') return results.length
      ? `आपकी हाल की सेवा बुकिंग: ${results.map((item) => `${item.serviceCategory}, ${item.provider}, ${item.requestedDate}, स्थिति ${item.status}`).join('; ')}।`
      : 'आपके खाते में कोई सेवा बुकिंग नहीं मिली।';
    if (intent === 'listing_draft') return `मैं ${entities.product || 'उत्पाद'} की सूची का मसौदा बना सकता हूँ। ${entities.quantity ? 'अपेक्षित कीमत और पिकअप स्थान' : 'मात्रा, अपेक्षित कीमत और पिकअप स्थान'} बताएं। आपकी पुष्टि के बिना सूची प्रकाशित नहीं होगी।`;
  }
  if (intent === 'product_search') {
    if (!results.length) return 'క్షమించండి, ప్రస్తుతం సరిపోలే ఉత్పత్తి జాబితాలు లేవు.';
    return `ధృవీకరించిన మార్కెట్‌ప్లేస్ జాబితాల్లో ${results.length} ఉత్పత్తులు దొరికాయి: ${results.map((item) => `${item.product}, ${item.price} రూపాయలు / ${item.unit}, ${item.district || 'స్థలం ఇవ్వలేదు'}`).join('; ')}.`;
  }
  if (intent === 'market_prices') {
    if (!results.length) return 'ప్రస్తుతం ధృవీకరించిన వరి మార్కెట్ ధరలు అందుబాటులో లేవు.';
    return `తాజా ధృవీకరించిన మార్కెట్ సమాచారం: ${results.map((item) => `${item.market}, ${item.arrivalDate}, మోడల్ ధర ${item.modalPrice} ${item.currency} / ${item.unit}`).join('; ')}.`;
  }
  if (intent === 'service_search' || intent === 'service_booking') {
    if (!results.length) return 'మీ ప్రాంతానికి సరిపడే ఆమోదిత సేవా ప్రదాతల వివరాలు ప్రస్తుతం లేవు.';
    const providers = results.map((item) => `${item.businessName}, ${item.district || ''}, ధర వివరాలు: ${item.pricing || 'ప్రదాతను సంప్రదించండి'}`).join('; ');
    return intent === 'service_booking'
      ? `ఈ ప్రదాతలు అందుబాటులో ఉన్నారు: ${providers}. బుకింగ్‌ను సృష్టించడానికి ప్రదాత, తేదీ, స్థలాన్ని ఎంచుకుని స్పష్టంగా నిర్ధారించండి.`
      : `ఆమోదిత సేవా ప్రదాతలు: ${providers}.`;
  }
  if (intent === 'order_status') {
    if (!results.length) return 'మీ ఖాతాలో ఆర్డర్ చరిత్ర కనిపించలేదు.';
    return `మీ తాజా ఆర్డర్లు: ${results.map((item) => `${item.id.slice(0, 8)}, స్థితి ${item.status}, మొత్తం ${item.total} రూపాయలు`).join('; ')}.`;
  }
  if (intent === 'booking_status') {
    if (!results.length) return 'మీ ఖాతాలో సేవా బుకింగ్ చరిత్ర కనిపించలేదు.';
    return `మీ తాజా సేవా బుకింగ్‌లు: ${results.map((item) => `${item.serviceCategory}, ${item.provider}, ${item.requestedDate}, స్థితి ${item.status}`).join('; ')}.`;
  }
  if (intent === 'listing_draft') {
    const quantity = entities.quantity ? `${entities.quantity} ${entities.unit}` : 'పరిమాణం';
    return `మీ ${entities.product || 'ఉత్పత్తి'} జాబితా ముసాయిదా సిద్ధం చేయడానికి ${quantity}, ఆశించిన ధర, పికప్ స్థలం కావాలి. వివరాలు మరియు తుది నిర్ధారణ లేకుండా జాబితా సృష్టించబడదు.`;
  }
  return '';
}

async function processCommand({ command, user, language = 'te', classified = classifyCommand(command) }) {
  let results = [];
  if (classified.intent === 'product_search') results = await findProducts({ ...classified.entities, district: user.profile.district });
  if (classified.intent === 'market_prices') results = await findMarketPrices(user.profile.district);
  if (classified.intent === 'service_search' || classified.intent === 'service_booking') {
    results = await findProviders({ ...classified.entities, district: user.profile.district });
  }
  if (classified.intent === 'order_status') results = await findOrders(user.id);
  if (classified.intent === 'booking_status') results = await findBookings(user.id);
  const answer = responseText(language, classified.intent, results, classified.entities);
  return {
    ...classified,
    results,
    answer,
    requiresConfirmation: classified.intent === 'service_booking' || classified.intent === 'listing_draft',
  };
}

module.exports = { classifyCommand, processCommand };
