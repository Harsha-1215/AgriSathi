const videoCategories = [
  ['crop-cultivation', 'Crop Cultivation', 'sprout'],
  ['crop-disease-prevention', 'Crop Disease Prevention', 'shield-check'],
  ['fertilizer-management', 'Fertilizer Management', 'flask-conical'],
  ['irrigation-techniques', 'Irrigation Techniques', 'droplets'],
  ['modern-farming-technology', 'Modern Farming Technology', 'cpu'],
  ['organic-farming', 'Organic Farming', 'leaf'],
  ['agricultural-machinery', 'Agricultural Machinery', 'tractor'],
  ['livestock-management', 'Livestock Management', 'beef'],
  ['harvesting-techniques', 'Harvesting Techniques', 'wheat'],
  ['government-schemes', 'Government Schemes', 'landmark'],
  ['soil-health', 'Soil Health', 'shovel'],
  ['farmer-success-stories', 'Farmer Success Stories', 'users'],
].map(([slug, name, icon]) => ({ slug, name, icon, translations: {}, description: {}, isActive: true }));

const schemeCategories = [
  ['financial-assistance', 'Financial Assistance', 'wallet'],
  ['crop-insurance', 'Crop Insurance', 'shield'],
  ['equipment-subsidy', 'Agricultural Equipment Subsidies', 'tractor'],
  ['irrigation-water', 'Irrigation and Water Management', 'droplets'],
  ['soil-fertilizer', 'Soil and Fertilizer Support', 'sprout'],
  ['organic-sustainable', 'Organic and Sustainable Farming', 'leaf'],
  ['horticulture', 'Horticulture', 'apple'],
  ['livestock-fisheries', 'Livestock and Fisheries', 'fish'],
  ['farmer-development', 'Farmer Development', 'graduation-cap'],
].map(([slug, name, icon]) => ({ slug, name, icon, translations: {}, description: {}, isActive: true }));

const marketplaceCategories = [
  ['seeds', 'Seeds', 'sprout'],
  ['fertilizers', 'Fertilizers', 'flask-conical'],
  ['pesticides-crop-protection', 'Pesticides and Crop Protection', 'shield-check'],
  ['agricultural-equipment', 'Agricultural Equipment', 'wrench'],
  ['tractors-machinery', 'Tractors and Machinery', 'tractor'],
  ['irrigation-equipment', 'Irrigation Equipment', 'droplets'],
  ['organic-farming-products', 'Organic Farming Products', 'leaf'],
  ['fruits', 'Fruits', 'apple'],
  ['vegetables', 'Vegetables', 'carrot'],
  ['paddy-rice', 'Paddy and Rice', 'wheat'],
  ['cotton', 'Cotton', 'flower'],
  ['chilli', 'Chilli', 'flame'],
  ['maize', 'Maize', 'wheat'],
  ['groundnut', 'Groundnut', 'nut'],
  ['other-agricultural-products', 'Other Agricultural Products', 'package'],
].map(([slug, name, icon]) => {
  const translations = {
    seeds: ['విత్తనాలు', 'बीज'],
    fertilizers: ['ఎరువులు', 'उर्वरक'],
    'pesticides-crop-protection': ['పురుగుమందులు మరియు పంట రక్షణ', 'कीटनाशक और फसल सुरक्षा'],
    'agricultural-equipment': ['వ్యవసాయ పరికరాలు', 'कृषि उपकरण'],
    'tractors-machinery': ['ట్రాక్టర్లు మరియు యంత్రాలు', 'ट्रैक्टर और मशीनरी'],
    'irrigation-equipment': ['నీటిపారుదల పరికరాలు', 'सिंचाई उपकरण'],
    'organic-farming-products': ['సేంద్రియ వ్యవసాయ ఉత్పత్తులు', 'जैविक खेती उत्पाद'],
    fruits: ['పండ్లు', 'फल'],
    vegetables: ['కూరగాయలు', 'सब्ज़ियाँ'],
    'paddy-rice': ['వరి మరియు బియ్యం', 'धान और चावल'],
    cotton: ['పత్తి', 'कपास'],
    chilli: ['మిరప', 'मिर्च'],
    maize: ['మొక్కజొన్న', 'मक्का'],
    groundnut: ['వేరుశెనగ', 'मूँगफली'],
    'other-agricultural-products': ['ఇతర వ్యవసాయ ఉత్పత్తులు', 'अन्य कृषि उत्पाद'],
  }[slug] || [name, name];
  return { slug, name, icon, translations: { en: name, te: translations[0], hi: translations[1] }, isActive: true };
});

const livestockCategoryDefinitions = [
  ['cattle', 'Cattle', 'cow', ['పశువులు', 'मवेशी'], [
    ['cows', 'Cows', 'ఆవులు', 'गायें'],
    ['bulls', 'Bulls', 'ఎద్దులు', 'बैल'],
    ['calves', 'Calves', 'దూడలు', 'बछड़े'],
    ['dairy-cattle', 'Dairy cattle', 'పాడి పశువులు', 'डेयरी मवेशी'],
  ]],
  ['buffaloes', 'Buffaloes', 'beef', ['గేదెలు', 'भैंस'], [
    ['dairy-buffaloes', 'Dairy buffaloes', 'పాడి గేదెలు', 'डेयरी भैंस'],
    ['male-buffaloes', 'Male buffaloes', 'మగ గేదెలు', 'नर भैंस'],
    ['buffalo-calves', 'Buffalo calves', 'గేదె దూడలు', 'भैंस के बच्चे'],
  ]],
  ['goats', 'Goats', 'rabbit', ['మేకలు', 'बकरियाँ'], [
    ['boer', 'Boer', 'బోయర్', 'बोअर'],
    ['jamunapari', 'Jamunapari', 'జమునాపరి', 'जमुनापारी'],
    ['osmanabadi', 'Osmanabadi', 'ఉస్మానాబాది', 'उस्मानाबादी'],
    ['black-bengal', 'Black Bengal', 'బ్లాక్ బెంగాల్', 'ब्लैक बंगाल'],
    ['other-goat-breeds', 'Other breeds', 'ఇతర జాతులు', 'अन्य नस्लें'],
  ]],
  ['sheep', 'Sheep', 'sheep', ['గొర్రెలు', 'भेड़'], [
    ['nellore', 'Nellore', 'నెల్లూరు', 'नेल्लोर'],
    ['deccani', 'Deccani', 'దక్కని', 'दक्कनी'],
    ['mandya', 'Mandya', 'మాండ్య', 'मांड्या'],
    ['other-sheep-breeds', 'Other breeds', 'ఇతర జాతులు', 'अन्य नस्लें'],
  ]],
  ['poultry', 'Poultry', 'bird', ['కోళ్లు', 'मुर्गीपालन'], [
    ['chickens', 'Chickens', 'కోళ్లు', 'मुर्गियाँ'],
    ['country-chickens', 'Country chickens', 'నాటుకోళ్లు', 'देसी मुर्गियाँ'],
    ['broiler-chickens', 'Broiler chickens', 'బ్రాయిలర్ కోళ్లు', 'ब्रॉयलर मुर्गियाँ'],
    ['layers', 'Layers', 'గుడ్లు పెట్టే కోళ్లు', 'अंडा देने वाली मुर्गियाँ'],
    ['ducks', 'Ducks', 'బాతులు', 'बत्तखें'],
    ['turkeys', 'Turkeys', 'టర్కీలు', 'टर्की'],
  ]],
  ['other-livestock', 'Other livestock', 'paw-print', ['ఇతర పశువులు', 'अन्य पशुधन'], [
    ['pigs', 'Pigs', 'పందులు', 'सूअर'],
    ['rabbits', 'Rabbits', 'కుందేళ్లు', 'खरगोश'],
    ['other-farm-animals', 'Other farm animals', 'ఇతర వ్యవసాయ జంతువులు', 'अन्य खेत के जानवर'],
  ]],
];

const livestockCategories = livestockCategoryDefinitions.map(([slug, name, icon, [te, hi]]) => ({
  slug,
  name,
  icon,
  translations: { en: name, te, hi },
  isActive: true,
}));

async function seedPlatformCatalogs(models) {
  await models.AgriVideoCategory.bulkCreate(videoCategories, { updateOnDuplicate: ['name', 'icon', 'isActive'] });
  await models.SchemeCategory.bulkCreate(schemeCategories, { updateOnDuplicate: ['name', 'icon', 'isActive'] });
  await models.MarketplaceCategory.bulkCreate(marketplaceCategories, { updateOnDuplicate: ['name', 'icon', 'translations', 'isActive'] });
  await models.LivestockCategory.bulkCreate(livestockCategories, { updateOnDuplicate: ['name', 'icon', 'translations', 'isActive'] });
  const categories = await models.LivestockCategory.findAll({ attributes: ['id', 'slug'], raw: true });
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
  const breeds = livestockCategoryDefinitions.flatMap(([categorySlug, , , , categoryBreeds]) => (
    categoryBreeds.map(([slug, name, te, hi]) => ({
      categoryId: categoryIds.get(categorySlug),
      slug,
      name,
      translations: { en: name, te, hi },
      isActive: true,
    }))
  ));
  await models.LivestockBreed.bulkCreate(breeds, { updateOnDuplicate: ['name', 'translations', 'isActive'] });
}

module.exports = { videoCategories, schemeCategories, marketplaceCategories, livestockCategories, seedPlatformCatalogs };
