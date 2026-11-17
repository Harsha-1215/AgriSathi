const categories = [
  { id: 'cereals', name: 'Cereals and millets', translations: { te: 'ధాన్యాలు మరియు చిరుధాన్యాలు', hi: 'अनाज और मोटे अनाज' } },
  { id: 'pulses', name: 'Pulses', translations: { te: 'పప్పుధాన్యాలు', hi: 'दलहन' } },
  { id: 'oilseeds', name: 'Oilseeds', translations: { te: 'నూనె గింజలు', hi: 'तिलहन' } },
  { id: 'commercial', name: 'Commercial crops', translations: { te: 'వాణిజ్య పంటలు', hi: 'व्यावसायिक फसलें' } },
  { id: 'vegetables', name: 'Vegetables', translations: { te: 'కూరగాయలు', hi: 'सब्ज़ियाँ' } },
  { id: 'fruits', name: 'Fruits', translations: { te: 'పండ్లు', hi: 'फल' } },
  { id: 'spices', name: 'Spices', translations: { te: 'సుగంధ ద్రవ్యాలు', hi: 'मसाले' } },
  { id: 'fodder', name: 'Fodder crops', translations: { te: 'పశుగ్రాస పంటలు', hi: 'चारा फसलें' } },
];

const entries = [
  ['rice', 'Rice', 'వరి', 'धान', 'cereals'],
  ['wheat', 'Wheat', 'గోధుమ', 'गेहूँ', 'cereals'],
  ['maize', 'Maize', 'మొక్కజొన్న', 'मक्का', 'cereals'],
  ['sorghum', 'Sorghum', 'జొన్న', 'ज्वार', 'cereals'],
  ['pearl-millet', 'Pearl millet', 'సజ్జ', 'बाजरा', 'cereals'],
  ['finger-millet', 'Finger millet', 'రాగి', 'रागी', 'cereals'],
  ['chickpea', 'Chickpea', 'శనగ', 'चना', 'pulses'],
  ['pigeon-pea', 'Pigeon pea', 'కందులు', 'अरहर', 'pulses'],
  ['green-gram', 'Green gram', 'పెసలు', 'मूंग', 'pulses'],
  ['black-gram', 'Black gram', 'మినుములు', 'उड़द', 'pulses'],
  ['groundnut', 'Groundnut', 'వేరుశనగ', 'मूंगफली', 'oilseeds'],
  ['sesame', 'Sesame', 'నువ్వులు', 'तिल', 'oilseeds'],
  ['sunflower', 'Sunflower', 'పొద్దుతిరుగుడు', 'सूरजमुखी', 'oilseeds'],
  ['soybean', 'Soybean', 'సోయాబీన్', 'सोयाबीन', 'oilseeds'],
  ['cotton', 'Cotton', 'పత్తి', 'कपास', 'commercial'],
  ['sugarcane', 'Sugarcane', 'చెరకు', 'गन्ना', 'commercial'],
  ['jute', 'Jute', 'జనపనార', 'जूट', 'commercial'],
  ['tobacco', 'Tobacco', 'పొగాకు', 'तंबाकू', 'commercial'],
  ['chilli', 'Chilli', 'మిరప', 'मिर्च', 'spices'],
  ['turmeric', 'Turmeric', 'పసుపు', 'हल्दी', 'spices'],
  ['coriander', 'Coriander', 'కొత్తిమీర', 'धनिया', 'spices'],
  ['tomato', 'Tomato', 'టమాటా', 'टमाटर', 'vegetables'],
  ['onion', 'Onion', 'ఉల్లిపాయ', 'प्याज़', 'vegetables'],
  ['potato', 'Potato', 'బంగాళాదుంప', 'आलू', 'vegetables'],
  ['okra', 'Okra', 'బెండకాయ', 'भिंडी', 'vegetables'],
  ['brinjal', 'Brinjal', 'వంకాయ', 'बैंगन', 'vegetables'],
  ['cabbage', 'Cabbage', 'క్యాబేజీ', 'पत्तागोभी', 'vegetables'],
  ['mango', 'Mango', 'మామిడి', 'आम', 'fruits'],
  ['banana', 'Banana', 'అరటి', 'केला', 'fruits'],
  ['citrus', 'Citrus', 'నిమ్మజాతి పండ్లు', 'खट्टे फल', 'fruits'],
  ['papaya', 'Papaya', 'బొప్పాయి', 'पपीता', 'fruits'],
  ['fodder-sorghum', 'Fodder sorghum', 'పశుగ్రాస జొన్న', 'चारा ज्वार', 'fodder'],
];

const crops = entries.map(([id, name, te, hi, categoryId]) => ({
  id,
  name,
  translations: { te, hi },
  categoryId,
  description: {
    en: 'Crop listing. Verified cultivation guidance for this crop has not yet been published.',
    te: 'పంట జాబితా. ఈ పంటకు ధృవీకరించిన సాగు సమాచారం ఇంకా ప్రచురించబడలేదు.',
    hi: 'फसल सूची। इस फसल के लिए सत्यापित खेती की जानकारी अभी प्रकाशित नहीं हुई है।',
  },
  growingSeasons: [],
}));

async function seedCropCatalog(models) {
  await models.CropCategory.bulkCreate(categories, { updateOnDuplicate: ['name', 'translations'] });
  await models.Crop.bulkCreate(crops, { updateOnDuplicate: ['name', 'translations', 'categoryId', 'description'] });
}

module.exports = { categories, crops, seedCropCatalog };
