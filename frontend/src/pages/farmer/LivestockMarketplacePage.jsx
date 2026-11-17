import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BadgeCheck, Beef, Heart, LoaderCircle, MapPin, PawPrint, Search, ShieldCheck, Trash2, Upload, Video,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/livestock.css';

const copy = {
  en: {
    title: 'Livestock Marketplace', subtitle: 'Find livestock from local farmers and breeders.',
    back: 'Back to dashboard', browse: 'Browse animals', saved: 'Saved', enquiries: 'Enquiries',
    sellerDashboard: 'Seller dashboard', myListings: 'My listings', viewed: 'Recently viewed', sell: 'Sell livestock',
    search: 'Search animals or breeds', category: 'Category', allCategories: 'All categories', breed: 'Breed',
    district: 'District', mandal: 'Mandal', village: 'Village', ageMin: 'Min age (months)', ageMax: 'Max age (months)',
    gender: 'Gender', anyGender: 'Any gender', female: 'Female', male: 'Male', unknown: 'Not specified',
    minPrice: 'Min price', maxPrice: 'Max price', health: 'Seller-reported health', anyHealth: 'Any status',
    healthy: 'Seller reports healthy', attention: 'Needs attention', vaccination: 'Vaccination status',
    anyVaccination: 'Any vaccination status', vaccinated: 'Vaccinated', partial: 'Partially vaccinated',
    notVaccinated: 'Not vaccinated', verifiedOnly: 'Verified sellers only', sort: 'Sort by',
    newest: 'Recently added', priceAsc: 'Lowest price', priceDesc: 'Highest price', ageAsc: 'Youngest first',
    ageDesc: 'Oldest first', applyFilters: 'Apply filters', clear: 'Clear', loading: 'Loading livestock…',
    retry: 'Try again', noResults: 'No livestock matches these filters.', noSaved: 'No saved livestock yet.',
    noListings: 'You have not listed any animals yet.', noEnquiries: 'No enquiries yet.',
    view: 'View details', contact: 'Contact seller', save: 'Save listing', unsave: 'Remove saved listing',
    price: 'Asking price', negotiable: 'Price negotiable', age: 'Age', months: 'months', weight: 'Approx. weight',
    healthInfo: 'Health information', vaccinationInfo: 'Vaccination', records: 'Seller-provided records',
    seller: 'Seller', verified: 'Verified seller', unverified: 'Not verified', sellerNote: 'Seller-provided information; not independently verified.',
    location: 'Location', pickup: 'Pickup available', photos: 'Animal photos', description: 'Description',
    sendEnquiry: 'Send enquiry', subject: 'Subject', message: 'Your message', send: 'Send', report: 'Report listing',
    reportReason: 'Reason', reportDetails: 'Details (optional)', reportSubmit: 'Submit report',
    createTitle: 'Create a livestock listing', editTitle: 'Edit listing', animalName: 'Animal name / label',
    ageMonths: 'Age in months', categoryRequired: 'Choose a category', chooseBreed: 'Choose a breed (optional)',
    weightKg: 'Approx. weight (kg)', color: 'Colour', healthStatus: 'Health information',
    healthHealthy: 'Seller reports healthy', healthNeeds: 'Needs attention disclosed', healthUnknown: 'Not specified',
    vaccinationStatus: 'Vaccination status', vaccineUnknown: 'Not known', deworming: 'Deworming information',
    checkupDate: 'Last veterinary checkup', medicalHistory: 'Health notes / history',
    healthRecordNote: 'Health record note', healthRecordDate: 'Health record date',
    vaccineName: 'Vaccine name', vaccinationDate: 'Vaccination date', veterinarianName: 'Veterinarian name',
    milk: 'Average milk (litres/day, if applicable)', lactation: 'Lactation details', feeding: 'Feeding information',
    sellerName: 'Seller name', sellerDescription: 'Seller introduction', phone: 'Contact phone (optional)',
    allowPhone: 'Allow buyers to call me', state: 'State', sellerDistrict: 'District', sellerMandal: 'Mandal',
    sellerVillage: 'Village', pin: 'PIN code (optional)', showVillage: 'Show village and mandal on listing',
    contactPreference: 'Contact preference', platformOnly: 'AGRISATHI enquiries only', phoneOnly: 'Phone only',
    both: 'AGRISATHI and phone', pickupAvailable: 'Pickup available', priceNegotiable: 'Price is negotiable',
    askingPrice: 'Asking price (₹)', animalDescription: 'Animal description', animalPhotos: 'Photos (at least one required)',
    videoFile: 'Short video (optional, max 30 seconds)', certificate: 'Veterinary certificate image (optional)',
    saveForReview: 'Submit for review', updateListing: 'Update listing', cancel: 'Cancel',
    sellerDisclosure: 'Health details are seller-reported. Uploaded certificates are private and are not represented as independently verified.',
    createSuccess: 'Listing submitted for review.', updateSuccess: 'Listing updated and sent for review.',
    error: 'The request could not be completed.', status: 'Status', pending: 'Pending review',
    approved: 'Approved', rejected: 'Rejected', archived: 'Removed', available: 'Available', paused: 'Paused',
    sold: 'Sold', markSold: 'Mark sold', pause: 'Pause', activate: 'Make available', edit: 'Edit',
    remove: 'Remove listing', views: 'Views', active: 'Active listings', total: 'Total listings',
    openEnquiries: 'Open enquiries', pendingListings: 'Pending review', totalViews: 'Listing views',
    reply: 'Reply', closeEnquiry: 'Close enquiry', reopenEnquiry: 'Reopen enquiry',
    thread: 'View conversation', conversation: 'Conversation', you: 'You', otherParticipant: 'Other participant',
    photo: 'Photo', removeMedia: 'Remove media', mediaRemoved: 'Media removed. The listing may need review again.',
    sellerReported: 'Seller-reported', reportMisleading: 'Misleading information',
    reportUnsafe: 'Health or safety concern', reportFraud: 'Suspected fraud', reportOther: 'Other',
    previous: 'Previous', next: 'Next', loadingDetail: 'Loading details…', choosePhoto: 'Choose animal photos',
    noPhone: 'Use an enquiry to contact this seller.', notAvailable: 'This animal is no longer available.',
  },
  te: {
    title: 'పశువుల మార్కెట్', subtitle: 'స్థానిక రైతులు, పెంపకందారుల వద్ద పశువులను కనుగొనండి.',
    back: 'డాష్‌బోర్డ్‌కు తిరిగి', browse: 'పశువులను చూడండి', saved: 'భద్రపరచినవి', enquiries: 'విచారణలు',
    sellerDashboard: 'విక్రేత డాష్‌బోర్డ్', myListings: 'నా ప్రకటనలు', viewed: 'ఇటీవల చూసినవి', sell: 'పశువును అమ్మండి',
    search: 'పశువు లేదా జాతిని వెతకండి', category: 'వర్గం', allCategories: 'అన్ని వర్గాలు', breed: 'జాతి',
    district: 'జిల్లా', mandal: 'మండలం', village: 'గ్రామం', ageMin: 'కనిష్ఠ వయస్సు (నెలలు)', ageMax: 'గరిష్ఠ వయస్సు (నెలలు)',
    gender: 'లింగం', anyGender: 'ఏదైనా', female: 'ఆడ', male: 'మగ', unknown: 'తెలియదు',
    minPrice: 'కనిష్ఠ ధర', maxPrice: 'గరిష్ఠ ధర', health: 'విక్రేత తెలిపిన ఆరోగ్యం', anyHealth: 'ఏదైనా స్థితి',
    healthy: 'ఆరోగ్యంగా ఉందని విక్రేత తెలిపాడు', attention: 'శ్రద్ధ అవసరం', vaccination: 'టీకా స్థితి',
    anyVaccination: 'ఏదైనా టీకా స్థితి', vaccinated: 'టీకాలు వేశారు', partial: 'కొన్ని టీకాలు', notVaccinated: 'టీకాలు వేయలేదు',
    verifiedOnly: 'ధృవీకరించిన విక్రేతలు మాత్రమే', sort: 'క్రమం', newest: 'కొత్తవి', priceAsc: 'తక్కువ ధర',
    priceDesc: 'ఎక్కువ ధర', ageAsc: 'చిన్న వయస్సు ముందు', ageDesc: 'పెద్ద వయస్సు ముందు', applyFilters: 'ఫిల్టర్లు వర్తింపజేయండి',
    clear: 'తొలగించండి', loading: 'పశువులు లోడ్ అవుతున్నాయి…', retry: 'మళ్లీ ప్రయత్నించండి',
    noResults: 'ఈ ఫిల్టర్లకు సరిపడే పశువులు లేవు.', noSaved: 'భద్రపరచిన పశువులు లేవు.',
    noListings: 'మీరు ఇంకా పశువులను ప్రకటన చేయలేదు.', noEnquiries: 'విచారణలు లేవు.',
    view: 'వివరాలు చూడండి', contact: 'విక్రేతను సంప్రదించండి', save: 'భద్రపరచండి', unsave: 'తొలగించండి',
    price: 'అడిగిన ధర', negotiable: 'ధర చర్చించవచ్చు', age: 'వయస్సు', months: 'నెలలు', weight: 'సుమారు బరువు',
    healthInfo: 'ఆరోగ్య సమాచారం', vaccinationInfo: 'టీకాలు', records: 'విక్రేత అందించిన రికార్డులు',
    seller: 'విక్రేత', verified: 'ధృవీకరించిన విక్రేత', unverified: 'ధృవీకరించలేదు',
    sellerNote: 'విక్రేత తెలిపిన సమాచారం; స్వతంత్రంగా ధృవీకరించబడలేదు.', location: 'ప్రాంతం', pickup: 'తీసుకెళ్లే సౌకర్యం',
    photos: 'పశువు ఫోటోలు', description: 'వివరణ', sendEnquiry: 'విచారణ పంపండి', subject: 'విషయం',
    message: 'మీ సందేశం', send: 'పంపండి', report: 'ప్రకటనను నివేదించండి', reportReason: 'కారణం',
    reportDetails: 'వివరాలు (ఐచ్ఛికం)', reportSubmit: 'నివేదిక పంపండి', createTitle: 'పశువు ప్రకటన చేయండి',
    editTitle: 'ప్రకటనను సవరించండి', animalName: 'పశువు పేరు / గుర్తింపు', ageMonths: 'వయస్సు (నెలలు)',
    categoryRequired: 'వర్గాన్ని ఎంచుకోండి', chooseBreed: 'జాతిని ఎంచుకోండి (ఐచ్ఛికం)',
    weightKg: 'సుమారు బరువు (కిలోలు)', color: 'రంగు', healthStatus: 'ఆరోగ్య సమాచారం',
    healthHealthy: 'ఆరోగ్యంగా ఉందని విక్రేత తెలిపాడు', healthNeeds: 'శ్రద్ధ అవసరం', healthUnknown: 'తెలియదు',
    vaccinationStatus: 'టీకా స్థితి', vaccineUnknown: 'తెలియదు', deworming: 'నులిపురుగుల మందు సమాచారం',
    checkupDate: 'చివరి వెటర్నరీ పరీక్ష', medicalHistory: 'ఆరోగ్య గమనికలు / చరిత్ర',
    healthRecordNote: 'ఆరోగ్య రికార్డు గమనిక', healthRecordDate: 'ఆరోగ్య రికార్డు తేదీ',
    vaccineName: 'టీకా పేరు', vaccinationDate: 'టీకా తేదీ', veterinarianName: 'వెటర్నరీ వైద్యుని పేరు',
    milk: 'రోజుకు పాలు (లీటర్లు, వర్తిస్తే)', lactation: 'పాలిచ్చే వివరాలు', feeding: 'మేత సమాచారం',
    sellerName: 'విక్రేత పేరు', sellerDescription: 'విక్రేత పరిచయం', phone: 'ఫోన్ (ఐచ్ఛికం)',
    allowPhone: 'కొనుగోలుదారులు నాకు కాల్ చేయవచ్చు', state: 'రాష్ట్రం', sellerDistrict: 'జిల్లా', sellerMandal: 'మండలం',
    sellerVillage: 'గ్రామం', pin: 'పిన్ కోడ్ (ఐచ్ఛికం)', showVillage: 'ప్రకటనలో గ్రామం, మండలం చూపించండి',
    contactPreference: 'సంప్రదింపు విధానం', platformOnly: 'AGRISATHI విచారణలు మాత్రమే', phoneOnly: 'ఫోన్ మాత్రమే',
    both: 'AGRISATHI మరియు ఫోన్', pickupAvailable: 'పశువును తీసుకెళ్లవచ్చు', priceNegotiable: 'ధర చర్చించవచ్చు',
    askingPrice: 'అడిగిన ధర (₹)', animalDescription: 'పశువు వివరాలు', animalPhotos: 'ఫోటోలు (కనీసం ఒకటి అవసరం)',
    videoFile: 'చిన్న వీడియో (ఐచ్ఛికం, గరిష్ఠం 30 సెకన్లు)', certificate: 'వెటర్నరీ సర్టిఫికెట్ చిత్రం (ఐచ్ఛికం)',
    saveForReview: 'సమీక్షకు పంపండి', updateListing: 'ప్రకటనను నవీకరించండి', cancel: 'రద్దు',
    sellerDisclosure: 'ఆరోగ్య వివరాలు విక్రేత తెలిపినవి. సర్టిఫికెట్లు ప్రైవేట్‌గా ఉంటాయి; స్వతంత్రంగా ధృవీకరించబడినవి కావు.',
    createSuccess: 'ప్రకటన సమీక్షకు పంపబడింది.', updateSuccess: 'ప్రకటన నవీకరించి సమీక్షకు పంపబడింది.',
    error: 'అభ్యర్థన పూర్తికాలేదు.', status: 'స్థితి', pending: 'సమీక్షలో ఉంది', approved: 'ఆమోదించబడింది',
    rejected: 'తిరస్కరించబడింది', archived: 'తొలగించబడింది', available: 'అందుబాటులో ఉంది', paused: 'నిలిపివేశారు',
    sold: 'అమ్మబడింది', markSold: 'అమ్మబడిందిగా గుర్తించండి', pause: 'నిలిపివేయండి',
    activate: 'అందుబాటులో ఉంచండి', edit: 'సవరించండి', remove: 'తొలగించండి', views: 'వీక్షణలు',
    active: 'క్రియాశీల ప్రకటనలు', total: 'మొత్తం ప్రకటనలు', openEnquiries: 'తెరిచిన విచారణలు',
    pendingListings: 'సమీక్షలో ఉన్నవి', totalViews: 'ప్రకటన వీక్షణలు', reply: 'సమాధానం ఇవ్వండి',
    closeEnquiry: 'విచారణ మూసివేయండి', reopenEnquiry: 'మళ్లీ తెరవండి', photo: 'ఫోటో',
    thread: 'సంభాషణ చూడండి', conversation: 'సంభాషణ', you: 'మీరు', otherParticipant: 'మరో వ్యక్తి',
    removeMedia: 'మీడియాను తొలగించండి', mediaRemoved: 'మీడియా తొలగించబడింది. ప్రకటనను మళ్లీ సమీక్షించాల్సి రావచ్చు.',
    sellerReported: 'విక్రేత తెలిపినది', reportMisleading: 'తప్పుదారి పట్టించే సమాచారం',
    reportUnsafe: 'ఆరోగ్యం లేదా భద్రత సమస్య', reportFraud: 'మోసం అనుమానం', reportOther: 'ఇతర',
    previous: 'మునుపటి', next: 'తదుపరి', loadingDetail: 'వివరాలు లోడ్ అవుతున్నాయి…',
    choosePhoto: 'పశువు ఫోటోలను ఎంచుకోండి', noPhone: 'విక్రేతను సంప్రదించడానికి విచారణ పంపండి.',
    notAvailable: 'ఈ పశువు ప్రస్తుతం అందుబాటులో లేదు.',
  },
  hi: {
    title: 'पशुधन बाज़ार', subtitle: 'स्थानीय किसानों और प्रजनकों से पशुधन खोजें।',
    back: 'डैशबोर्ड पर वापस', browse: 'पशु देखें', saved: 'सहेजे गए', enquiries: 'पूछताछ',
    sellerDashboard: 'विक्रेता डैशबोर्ड', myListings: 'मेरी लिस्टिंग', viewed: 'हाल ही में देखे गए', sell: 'पशु बेचें',
    search: 'पशु या नस्ल खोजें', category: 'श्रेणी', allCategories: 'सभी श्रेणियाँ', breed: 'नस्ल',
    district: 'ज़िला', mandal: 'मंडल', village: 'गाँव', ageMin: 'न्यूनतम आयु (महीने)', ageMax: 'अधिकतम आयु (महीने)',
    gender: 'लिंग', anyGender: 'कोई भी', female: 'मादा', male: 'नर', unknown: 'अज्ञात',
    minPrice: 'न्यूनतम कीमत', maxPrice: 'अधिकतम कीमत', health: 'विक्रेता द्वारा बताई गई सेहत',
    anyHealth: 'कोई भी स्थिति', healthy: 'विक्रेता स्वस्थ बताता है', attention: 'ध्यान आवश्यक',
    vaccination: 'टीकाकरण स्थिति', anyVaccination: 'कोई भी स्थिति', vaccinated: 'टीका लगा है',
    partial: 'कुछ टीके लगे हैं', notVaccinated: 'टीका नहीं लगा', verifiedOnly: 'केवल सत्यापित विक्रेता',
    sort: 'क्रम', newest: 'नए पहले', priceAsc: 'कम कीमत', priceDesc: 'अधिक कीमत',
    ageAsc: 'कम आयु पहले', ageDesc: 'अधिक आयु पहले', applyFilters: 'फ़िल्टर लागू करें', clear: 'साफ़ करें',
    loading: 'पशुधन लोड हो रहा है…', retry: 'फिर प्रयास करें', noResults: 'इन फ़िल्टर से मेल खाते पशु नहीं मिले।',
    noSaved: 'अभी कोई पशु सहेजा नहीं है।', noListings: 'आपने अभी कोई पशु सूचीबद्ध नहीं किया है।',
    noEnquiries: 'अभी कोई पूछताछ नहीं।', view: 'विवरण देखें', contact: 'विक्रेता से संपर्क करें',
    save: 'लिस्टिंग सहेजें', unsave: 'सहेजी गई लिस्टिंग हटाएँ', price: 'माँगी गई कीमत',
    negotiable: 'कीमत पर बातचीत संभव', age: 'आयु', months: 'महीने', weight: 'लगभग वज़न',
    healthInfo: 'स्वास्थ्य जानकारी', vaccinationInfo: 'टीकाकरण', records: 'विक्रेता द्वारा दिए रिकॉर्ड',
    seller: 'विक्रेता', verified: 'सत्यापित विक्रेता', unverified: 'सत्यापित नहीं',
    sellerNote: 'विक्रेता की जानकारी; स्वतंत्र रूप से सत्यापित नहीं।', location: 'स्थान', pickup: 'खुद ले जाने की सुविधा',
    photos: 'पशु की तस्वीरें', description: 'विवरण', sendEnquiry: 'पूछताछ भेजें', subject: 'विषय',
    message: 'आपका संदेश', send: 'भेजें', report: 'लिस्टिंग रिपोर्ट करें', reportReason: 'कारण',
    reportDetails: 'विवरण (वैकल्पिक)', reportSubmit: 'रिपोर्ट भेजें', createTitle: 'पशु की लिस्टिंग बनाएँ',
    editTitle: 'लिस्टिंग संपादित करें', animalName: 'पशु का नाम / पहचान', ageMonths: 'आयु (महीने)',
    categoryRequired: 'श्रेणी चुनें', chooseBreed: 'नस्ल चुनें (वैकल्पिक)', weightKg: 'लगभग वज़न (किलो)',
    color: 'रंग', healthStatus: 'स्वास्थ्य जानकारी', healthHealthy: 'विक्रेता स्वस्थ बताता है',
    healthNeeds: 'ध्यान आवश्यक', healthUnknown: 'अज्ञात', vaccinationStatus: 'टीकाकरण स्थिति',
    vaccineUnknown: 'ज्ञात नहीं', deworming: 'कृमिनाशक जानकारी', checkupDate: 'पिछली पशु चिकित्सक जाँच',
    medicalHistory: 'स्वास्थ्य नोट / इतिहास', healthRecordNote: 'स्वास्थ्य रिकॉर्ड नोट',
    healthRecordDate: 'स्वास्थ्य रिकॉर्ड तिथि', vaccineName: 'टीके का नाम',
    vaccinationDate: 'टीकाकरण की तारीख', veterinarianName: 'पशु चिकित्सक का नाम',
    milk: 'औसत दूध (लीटर/दिन, यदि लागू हो)',
    lactation: 'दुग्धावस्था विवरण', feeding: 'चारा जानकारी', sellerName: 'विक्रेता का नाम',
    sellerDescription: 'विक्रेता परिचय', phone: 'संपर्क फ़ोन (वैकल्पिक)', allowPhone: 'खरीदार मुझे कॉल कर सकते हैं',
    state: 'राज्य', sellerDistrict: 'ज़िला', sellerMandal: 'मंडल', sellerVillage: 'गाँव',
    pin: 'पिन कोड (वैकल्पिक)', showVillage: 'लिस्टिंग में गाँव और मंडल दिखाएँ',
    contactPreference: 'संपर्क तरीका', platformOnly: 'केवल AGRISATHI पूछताछ', phoneOnly: 'केवल फ़ोन',
    both: 'AGRISATHI और फ़ोन', pickupAvailable: 'पशु लेने की सुविधा', priceNegotiable: 'कीमत पर बातचीत संभव',
    askingPrice: 'माँगी गई कीमत (₹)', animalDescription: 'पशु का विवरण',
    animalPhotos: 'तस्वीरें (कम से कम एक आवश्यक)', videoFile: 'छोटा वीडियो (वैकल्पिक, अधिकतम 30 सेकंड)',
    certificate: 'पशु चिकित्सा प्रमाणपत्र की तस्वीर (वैकल्पिक)', saveForReview: 'समीक्षा के लिए भेजें',
    updateListing: 'लिस्टिंग अपडेट करें', cancel: 'रद्द करें',
    sellerDisclosure: 'स्वास्थ्य विवरण विक्रेता द्वारा दिए गए हैं। प्रमाणपत्र निजी हैं और स्वतंत्र सत्यापन का दावा नहीं करते।',
    createSuccess: 'लिस्टिंग समीक्षा के लिए भेजी गई।', updateSuccess: 'लिस्टिंग अपडेट कर समीक्षा के लिए भेजी गई।',
    error: 'अनुरोध पूरा नहीं हो सका।', status: 'स्थिति', pending: 'समीक्षा लंबित', approved: 'स्वीकृत',
    rejected: 'अस्वीकृत', archived: 'हटाई गई', available: 'उपलब्ध', paused: 'रोकी गई', sold: 'बिक गया',
    markSold: 'बिका हुआ चिह्नित करें', pause: 'रोकें', activate: 'उपलब्ध करें', edit: 'संपादित करें',
    remove: 'लिस्टिंग हटाएँ', views: 'दृश्य', active: 'सक्रिय लिस्टिंग', total: 'कुल लिस्टिंग',
    openEnquiries: 'खुली पूछताछ', pendingListings: 'समीक्षा लंबित', totalViews: 'लिस्टिंग दृश्य',
    reply: 'जवाब दें', closeEnquiry: 'पूछताछ बंद करें', reopenEnquiry: 'फिर खोलें', photo: 'तस्वीर',
    thread: 'बातचीत देखें', conversation: 'बातचीत', you: 'आप', otherParticipant: 'दूसरा व्यक्ति',
    removeMedia: 'मीडिया हटाएँ', mediaRemoved: 'मीडिया हटा दिया गया। लिस्टिंग की फिर से समीक्षा हो सकती है।',
    sellerReported: 'विक्रेता द्वारा बताया गया', reportMisleading: 'भ्रामक जानकारी', reportUnsafe: 'स्वास्थ्य या सुरक्षा चिंता',
    reportFraud: 'धोखाधड़ी का संदेह', reportOther: 'अन्य', previous: 'पिछला', next: 'अगला',
    loadingDetail: 'विवरण लोड हो रहा है…', choosePhoto: 'पशु की तस्वीरें चुनें',
    noPhone: 'विक्रेता से संपर्क करने के लिए पूछताछ भेजें।', notAvailable: 'यह पशु अब उपलब्ध नहीं है।',
  },
};

const emptyForm = {
  categoryId: '', breedId: '', listingName: '', ageMonths: '', gender: 'female', weightKg: '', color: '',
  healthCondition: 'unknown', vaccinationStatus: 'unknown', dewormingInformation: '',
  veterinaryCheckupDate: '', medicalHistory: '', milkLitresPerDay: '', lactationDetails: '',
  healthRecordNote: '', healthRecordDate: '', vaccineName: '', vaccinationDate: '', veterinarianName: '',
  feedingInformation: '', description: '', price: '', negotiable: false, contactPreference: 'platform',
  locationPublic: true, state: '', district: '', mandal: '', village: '', pinCode: '',
  pickupAvailable: true, sellerName: '', sellerDescription: '', contactPhone: '', allowPhoneContact: false,
};

function categoryName(category, lang) {
  return category?.translations?.[lang] || category?.name || '';
}

function formatPrice(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function getError(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function getItems(response) {
  const body = response?.data || {};
  return { items: Array.isArray(body.data) ? body.data : [], pagination: body.pagination || { page: 1, pages: 1, total: 0 } };
}

function ListingCard({ listing, labels, lang, saved, onOpen, onSave, onEnquire }) {
  const photo = listing.images?.find((image) => image.type === 'image');
  return (
    <article className="livestock-card">
      <button className="livestock-card__media" type="button" onClick={() => onOpen(listing)} aria-label={`${labels.view}: ${listing.listingName}`}>
        {photo ? <img src={photo.url} alt={`${listing.listingName} animal`} /> : <Beef size={44} aria-hidden="true" />}
      </button>
      <div className="livestock-card__content">
        <div className="livestock-card__topline">
          <span>{categoryName(listing.category, lang)}{listing.breed ? ` · ${categoryName(listing.breed, lang)}` : ''}</span>
          {listing.seller?.isVerified && <span className="livestock-verified"><BadgeCheck size={15} />{labels.verified}</span>}
        </div>
        <h2>{listing.listingName}</h2>
        <p className="livestock-card__facts">{listing.ageMonths} {labels.months} · {labels[listing.gender] || labels.unknown}{listing.weightKg ? ` · ${listing.weightKg} kg` : ''}</p>
        <strong className="livestock-price">{formatPrice(listing.price)} {listing.negotiable && <small>{labels.negotiable}</small>}</strong>
        <p className="livestock-location"><MapPin size={15} aria-hidden="true" />{[listing.location?.village, listing.location?.mandal, listing.location?.district].filter(Boolean).join(', ') || listing.location?.state}</p>
        <p className="livestock-disclosure">{labels.sellerNote}</p>
        {listing.availability !== 'available' && <p className="livestock-disclosure">{labels.notAvailable}</p>}
        <div className="livestock-card__actions">
          <button type="button" className="livestock-button livestock-button--primary" onClick={() => onOpen(listing)}>{labels.view}</button>
          <button type="button" className="livestock-icon-button" onClick={() => onSave(listing)} disabled={!saved && listing.availability !== 'available'} aria-label={saved ? labels.unsave : labels.save}>
            <Heart size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button type="button" className="livestock-button" disabled={listing.availability !== 'available'} onClick={() => onEnquire(listing)}>{labels.contact}</button>
        </div>
      </div>
    </article>
  );
}

function Pagination({ pagination, page, setPage, labels }) {
  if (!pagination || pagination.pages < 2) return null;
  return (
    <nav className="livestock-pagination" aria-label="Pagination">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{labels.previous}</button>
      <span>{page} / {pagination.pages}</span>
      <button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>{labels.next}</button>
    </nav>
  );
}

function ListingForm({ labels, categories, lang, initial, onSubmit, onCancel, onRemoveMedia, mediaBusy, busy, error, success }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const imagePreviews = useMemo(() => images.map((image) => URL.createObjectURL(image)), [images]);
  useEffect(() => () => imagePreviews.forEach((url) => URL.revokeObjectURL(url)), [imagePreviews]);
  const category = categories.find((item) => item.id === form.categoryId);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const data = {
      categoryId: form.categoryId,
      breedId: form.breedId || null,
      listingName: form.listingName,
      ageMonths: form.ageMonths,
      gender: form.gender,
      weightKg: form.weightKg || null,
      color: form.color,
      healthCondition: form.healthCondition,
      vaccinationStatus: form.vaccinationStatus,
      dewormingInformation: form.dewormingInformation,
      veterinaryCheckupDate: form.veterinaryCheckupDate || null,
      medicalHistory: form.medicalHistory,
      productionDetails: {
        milkLitresPerDay: form.milkLitresPerDay ? Number(form.milkLitresPerDay) : undefined,
        lactationDetails: form.lactationDetails || undefined,
      },
      feedingInformation: form.feedingInformation,
      description: form.description,
      price: form.price,
      negotiable: form.negotiable,
      contactPreference: form.contactPreference,
      locationPublic: form.locationPublic,
      state: form.state,
      district: form.district,
      mandal: form.mandal,
      village: form.village,
      pinCode: form.pinCode,
      pickupAvailable: form.pickupAvailable,
    };
    if (!initial) {
      data.sellerName = form.sellerName;
      data.sellerDescription = form.sellerDescription;
      data.contactPhone = form.contactPhone;
      data.allowPhoneContact = form.allowPhoneContact;
      data.healthRecords = form.healthRecordNote ? [{
        recordDate: form.healthRecordDate,
        note: form.healthRecordNote,
        veterinarianName: form.veterinarianName,
      }] : [];
      data.vaccinationRecords = form.vaccineName ? [{
        vaccineName: form.vaccineName,
        administeredAt: form.vaccinationDate,
        veterinarianName: form.veterinarianName,
      }] : [];
    }
    onSubmit({ data, images, video, certificate });
  };
  const field = (label, key, props = {}) => (
    <label className="livestock-field" key={key}>
      <span>{label}</span>
      <input {...props} value={form[key] ?? ''} onChange={(event) => update(key, event.target.value)} />
    </label>
  );

  return (
    <form className="livestock-panel livestock-form" onSubmit={submit}>
      <div className="livestock-section-heading"><div><p className="livestock-eyebrow">{labels.seller}</p><h2>{initial ? labels.editTitle : labels.createTitle}</h2></div></div>
      <p className="livestock-disclosure"><ShieldCheck size={16} aria-hidden="true" />{labels.sellerDisclosure}</p>
      {error && <p className="livestock-alert livestock-alert--error" role="alert">{error}</p>}
      {success && <p className="livestock-alert livestock-alert--success" role="status">{success}</p>}
      <div className="livestock-form-section">
        <h3>{labels.title}</h3>
        <div className="livestock-form-grid">
          <label className="livestock-field"><span>{labels.category}</span>
            <select required value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value, breedId: '' }))}>
              <option value="">{labels.categoryRequired}</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{categoryName(item, lang)}</option>)}
            </select>
          </label>
          <label className="livestock-field"><span>{labels.breed}</span>
            <select value={form.breedId} onChange={(event) => update('breedId', event.target.value)}>
              <option value="">{labels.chooseBreed}</option>
              {(category?.LivestockBreeds || []).map((item) => <option key={item.id} value={item.id}>{categoryName(item, lang)}</option>)}
            </select>
          </label>
          {field(labels.animalName, 'listingName', { required: true, maxLength: 180 })}
          {field(labels.ageMonths, 'ageMonths', { type: 'number', required: true, min: 0, max: 600, step: 1 })}
          <label className="livestock-field"><span>{labels.gender}</span>
            <select value={form.gender} onChange={(event) => update('gender', event.target.value)}>
              <option value="female">{labels.female}</option><option value="male">{labels.male}</option><option value="unknown">{labels.unknown}</option>
            </select>
          </label>
          {field(labels.weightKg, 'weightKg', { type: 'number', min: 0.1, max: 5000, step: 0.01 })}
          {field(labels.color, 'color', { maxLength: 100 })}
          <label className="livestock-field"><span>{labels.healthStatus}</span>
            <select value={form.healthCondition} onChange={(event) => update('healthCondition', event.target.value)}>
              <option value="unknown">{labels.healthUnknown}</option><option value="seller_reports_healthy">{labels.healthHealthy}</option><option value="needs_attention">{labels.healthNeeds}</option>
            </select>
          </label>
          <label className="livestock-field"><span>{labels.vaccinationStatus}</span>
            <select value={form.vaccinationStatus} onChange={(event) => update('vaccinationStatus', event.target.value)}>
              <option value="unknown">{labels.vaccineUnknown}</option><option value="vaccinated">{labels.vaccinated}</option><option value="partially_vaccinated">{labels.partial}</option><option value="not_vaccinated">{labels.notVaccinated}</option>
            </select>
          </label>
          {field(labels.checkupDate, 'veterinaryCheckupDate', { type: 'date' })}
          {field(labels.deworming, 'dewormingInformation', { maxLength: 1000 })}
          {!initial && field(labels.healthRecordDate, 'healthRecordDate', { type: 'date', required: Boolean(form.healthRecordNote) })}
          {!initial && field(labels.vaccineName, 'vaccineName', { maxLength: 180, required: Boolean(form.vaccinationDate) })}
          {!initial && field(labels.vaccinationDate, 'vaccinationDate', { type: 'date', required: Boolean(form.vaccineName) })}
          {!initial && field(labels.veterinarianName, 'veterinarianName', { maxLength: 160 })}
          {!initial && <label className="livestock-field livestock-field--wide"><span>{labels.healthRecordNote}</span><textarea rows="3" maxLength="1600" value={form.healthRecordNote} onChange={(event) => update('healthRecordNote', event.target.value)} /></label>}
          {field(labels.milk, 'milkLitresPerDay', { type: 'number', min: 0, max: 200, step: 0.1 })}
          {field(labels.lactation, 'lactationDetails', { maxLength: 1000 })}
          <label className="livestock-field livestock-field--wide"><span>{labels.medicalHistory}</span>
            <textarea rows="3" maxLength="3000" value={form.medicalHistory} onChange={(event) => update('medicalHistory', event.target.value)} />
          </label>
          <label className="livestock-field livestock-field--wide"><span>{labels.feeding}</span>
            <textarea rows="3" maxLength="3000" value={form.feedingInformation} onChange={(event) => update('feedingInformation', event.target.value)} />
          </label>
          <label className="livestock-field livestock-field--wide"><span>{labels.animalDescription}</span>
            <textarea required rows="4" maxLength="5000" value={form.description} onChange={(event) => update('description', event.target.value)} />
          </label>
        </div>
      </div>
      <div className="livestock-form-section">
        <h3>{labels.photos}</h3>
        <div className="livestock-form-grid">
          {field(labels.askingPrice, 'price', { type: 'number', required: true, min: 1, max: 999999999, step: 0.01 })}
          <label className="livestock-field"><span>{labels.contactPreference}</span>
            <select value={form.contactPreference} onChange={(event) => update('contactPreference', event.target.value)}>
              <option value="platform">{labels.platformOnly}</option><option value="phone">{labels.phoneOnly}</option><option value="both">{labels.both}</option>
            </select>
          </label>
          <label className="livestock-check"><input type="checkbox" checked={form.negotiable} onChange={(event) => update('negotiable', event.target.checked)} />{labels.priceNegotiable}</label>
          <label className="livestock-check"><input type="checkbox" checked={form.pickupAvailable} onChange={(event) => update('pickupAvailable', event.target.checked)} />{labels.pickupAvailable}</label>
          <label className="livestock-field livestock-field--wide livestock-file-input"><span><Upload size={18} />{labels.animalPhotos}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple required={!initial} onChange={(event) => setImages(Array.from(event.target.files || []))} />
            {images.length > 0 && <small>{images.map((image) => image.name).join(', ')}</small>}
            {initial?.images?.length > 0 && (
              <div className="livestock-upload-previews">
                {initial.images.map((image) => (
                  <div className="livestock-upload-item" key={image.id}>
                    {image.type === 'image'
                      ? <img src={image.url} alt={labels.photo} />
                      : <video src={image.url} controls aria-label={labels.videoFile} />}
                    <button type="button" disabled={mediaBusy} onClick={() => onRemoveMedia(image)} aria-label={labels.removeMedia}>
                      <Trash2 size={16} />{labels.removeMedia}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {imagePreviews.length > 0 && <div className="livestock-upload-previews">{imagePreviews.map((url) => <img src={url} alt={labels.photo} key={url} />)}</div>}
          </label>
          <label className="livestock-field livestock-field--wide livestock-file-input"><span><Video size={18} />{labels.videoFile}</span>
            <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => setVideo(event.target.files?.[0] || null)} />
            {video && <small>{video.name}</small>}
          </label>
          <label className="livestock-field livestock-field--wide livestock-file-input"><span><ShieldCheck size={18} />{labels.certificate}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCertificate(event.target.files?.[0] || null)} />
            {certificate && <small>{certificate.name}</small>}
          </label>
        </div>
      </div>
      <div className="livestock-form-section">
        <h3>{labels.seller}</h3>
        <div className="livestock-form-grid">
          {field(labels.sellerName, 'sellerName', { required: true, maxLength: 160 })}
          {field(labels.phone, 'contactPhone', { type: 'tel', maxLength: 30 })}
          {field(labels.sellerDescription, 'sellerDescription', { maxLength: 1600 })}
          {field(labels.state, 'state', { required: true, maxLength: 100 })}
          {field(labels.sellerDistrict, 'district', { required: true, maxLength: 100 })}
          {field(labels.sellerMandal, 'mandal', { maxLength: 100 })}
          {field(labels.sellerVillage, 'village', { maxLength: 120 })}
          {field(labels.pin, 'pinCode', { inputMode: 'numeric', maxLength: 6 })}
          <label className="livestock-check"><input type="checkbox" checked={form.allowPhoneContact} onChange={(event) => update('allowPhoneContact', event.target.checked)} />{labels.allowPhone}</label>
          <label className="livestock-check"><input type="checkbox" checked={form.locationPublic} onChange={(event) => update('locationPublic', event.target.checked)} />{labels.showVillage}</label>
        </div>
      </div>
      <div className="livestock-form-actions">
        <button type="button" className="livestock-button" onClick={onCancel}>{labels.cancel}</button>
        <button type="submit" className="livestock-button livestock-button--primary" disabled={busy}>
          {busy ? <LoaderCircle className="livestock-spin" size={18} /> : null}{initial ? labels.updateListing : labels.saveForReview}
        </button>
      </div>
    </form>
  );
}

export default function LivestockMarketplacePage() {
  const { lang } = useLanguage();
  const labels = copy[lang] || copy.en;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role || 'farmer';
  const canSell = ['farmer', 'farmer_user', 'seller'].includes(role);
  const dashboardPath = role === 'seller' ? '/seller/dashboard' : role === 'buyer' ? '/buyer/dashboard' : '/farmer/dashboard';
  const [view, setView] = useState('browse');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ categoryId: '', breedId: '', district: '', mandal: '', village: '', minAge: '', maxAge: '', gender: '', minPrice: '', maxPrice: '', healthCondition: '', vaccinationStatus: '', verifiedSeller: false, sort: 'newest' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [enquiryListing, setEnquiryListing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquirySubject, setEnquirySubject] = useState('');
  const [reportTarget, setReportTarget] = useState('');
  const [selectedEnquiryId, setSelectedEnquiryId] = useState('');
  useEffect(() => setPage(1), [filters, search]);

  const categoriesQuery = useQuery({ queryKey: ['livestock', 'categories'], queryFn: async () => unwrapPayload(await api.get('/livestock/categories')), retry: false });
  const categories = categoriesQuery.data || [];
  const listingParams = useMemo(() => ({
    page,
    q: search || undefined,
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== false && value !== undefined)),
  }), [page, search, filters]);
  const listingsQuery = useQuery({
    queryKey: ['livestock', 'listings', listingParams],
    queryFn: async () => getItems(await api.get('/livestock', { params: listingParams })),
    enabled: view === 'browse',
    retry: false,
  });
  const savedQuery = useQuery({
    queryKey: ['livestock', 'wishlist'],
    queryFn: async () => unwrapPayload(await api.get('/livestock/wishlist')),
    enabled: view === 'saved',
    retry: false,
  });
  const viewedQuery = useQuery({
    queryKey: ['livestock', 'recently-viewed'],
    queryFn: async () => unwrapPayload(await api.get('/livestock/recently-viewed')),
    enabled: view === 'viewed',
    retry: false,
  });
  const sellerQuery = useQuery({
    queryKey: ['livestock', 'seller-dashboard'],
    queryFn: async () => unwrapPayload(await api.get('/livestock/seller/dashboard')),
    enabled: view === 'sellerDashboard',
    retry: false,
  });
  const sellerListingsQuery = useQuery({
    queryKey: ['livestock', 'seller-listings'],
    queryFn: async () => getItems(await api.get('/livestock/seller/listings', { params: { limit: 48 } })),
    enabled: view === 'myListings' || view === 'sellerDashboard',
    retry: false,
  });
  const enquiriesQuery = useQuery({
    queryKey: ['livestock', 'enquiries'],
    queryFn: async () => getItems(await api.get('/livestock/enquiries', { params: { limit: 48 } })),
    enabled: view === 'enquiries',
    retry: false,
  });
  const enquiryDetailQuery = useQuery({
    queryKey: ['livestock', 'enquiry', selectedEnquiryId],
    queryFn: async () => unwrapPayload(await api.get(`/livestock/enquiries/${selectedEnquiryId}`)),
    enabled: Boolean(selectedEnquiryId),
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ['livestock', 'detail', selected?.id],
    queryFn: async () => unwrapPayload(await api.get(`/livestock/${selected.id}`)),
    enabled: Boolean(selected?.id),
    retry: false,
  });

  const refreshLivestock = () => queryClient.invalidateQueries({ queryKey: ['livestock'] });
  const saveMutation = useMutation({
    mutationFn: async (listing) => listing.isWishlisted
      ? api.delete(`/livestock/wishlist/${listing.id}`)
      : api.post(`/livestock/wishlist/${listing.id}`),
    onSuccess: () => { refreshLivestock(); setNotice(labels.saved); },
    onError: (reason) => setError(getError(reason, labels.error)),
  });
  const listingMutation = useMutation({
    mutationFn: async ({ data, images, video, certificate, id }) => {
      const body = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
      images.forEach((image) => body.append('images', image));
      if (video) body.append('video', video);
      if (certificate) body.append('healthCertificate', certificate);
      if (id) return api.put(`/livestock/${id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      return api.post('/livestock', body, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      refreshLivestock();
      setEditing(null);
      setFormSuccess(editing ? labels.updateSuccess : labels.createSuccess);
      setNotice(editing ? labels.updateSuccess : labels.createSuccess);
      setFormError('');
      setView('myListings');
    },
    onError: (reason) => setFormError(getError(reason, labels.error)),
  });
  const mediaMutation = useMutation({
    mutationFn: ({ listingId, imageId }) => api.delete(`/livestock/seller/listings/${listingId}/images/${imageId}`),
    onSuccess: (_, { imageId }) => {
      refreshLivestock();
      setEditing((current) => current && ({
        ...current,
        images: (current.images || []).filter((image) => image.id !== imageId),
      }));
      setNotice(labels.mediaRemoved);
    },
    onError: (reason) => setFormError(getError(reason, labels.error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ listing, availability }) => api.put(`/livestock/seller/listings/${listing.id}/status`, { availability }),
    onSuccess: () => { refreshLivestock(); setNotice(labels.status); },
    onError: (reason) => setError(getError(reason, labels.error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (listing) => api.delete(`/livestock/${listing.id}`),
    onSuccess: () => { refreshLivestock(); setNotice(labels.remove); },
    onError: (reason) => setError(getError(reason, labels.error)),
  });
  const enquiryMutation = useMutation({
    mutationFn: () => api.post('/livestock/enquiries', { listingId: enquiryListing.id, subject: enquirySubject || 'Livestock enquiry', message: enquiryMessage }),
    onSuccess: () => {
      refreshLivestock();
      setEnquiryListing(null);
      setEnquiryMessage('');
      setEnquirySubject('');
      setNotice(labels.send);
      setError('');
    },
    onError: (reason) => setError(getError(reason, labels.error)),
  });
  const reportMutation = useMutation({
    mutationFn: ({ listingId, reason, description }) => api.post('/livestock/reports', { listingId, reason, description }),
    onSuccess: () => { setReportTarget(''); setNotice(labels.reportSubmit); setError(''); },
    onError: (reason) => setError(getError(reason, labels.error)),
  });
  const messageMutation = useMutation({
    mutationFn: ({ enquiryId, message }) => api.post(`/livestock/enquiries/${enquiryId}/messages`, { message }),
    onSuccess: () => { refreshLivestock(); setNotice(labels.send); },
    onError: (reason) => setError(getError(reason, labels.error)),
  });
  const enquiryStatusMutation = useMutation({
    mutationFn: ({ enquiryId, status }) => api.put(`/livestock/enquiries/${enquiryId}/status`, { status }),
    onSuccess: refreshLivestock,
    onError: (reason) => setError(getError(reason, labels.error)),
  });

  const openEnquiry = (listing) => {
    setSelected(null);
    setEnquiryListing(listing);
    setError('');
  };
  const saveListing = (listing) => saveMutation.mutate({
    id: listing.id,
    isWishlisted: view === 'saved' || listing.isWishlisted,
  });
  const submitListing = ({ data, images, video, certificate }) => {
    setFormError('');
    if (editing) {
      listingMutation.mutate({ data, images, video, certificate, id: editing.id });
      return;
    }
    listingMutation.mutate({ data, images, video, certificate });
  };
  const editListing = (listing) => {
    setEditing({
      ...listing,
      id: listing.id,
      categoryId: listing.category?.id || '',
      breedId: listing.breed?.id || '',
      listingName: listing.listingName,
      ageMonths: String(listing.ageMonths),
      weightKg: listing.weightKg || '',
      color: listing.color || '',
      price: String(listing.price),
      productionDetails: listing.productionDetails || {},
      milkLitresPerDay: listing.productionDetails?.milkLitresPerDay || '',
      lactationDetails: listing.productionDetails?.lactationDetails || '',
      state: listing.location?.state || '',
      district: listing.location?.district || '',
      mandal: listing.location?.mandal || '',
      village: listing.location?.village || '',
      pinCode: '',
      sellerName: listing.seller?.name || '',
      sellerDescription: listing.seller?.description || '',
      contactPhone: '',
      allowPhoneContact: false,
      negotiable: listing.negotiable,
      pickupAvailable: listing.pickupAvailable,
    });
    setView('sell');
  };

  return (
    <div className="livestock-page">
      <header className="livestock-header">
        <div className="livestock-brand"><Link to={dashboardPath} aria-label={labels.back}><Logo size="small" /></Link><span><strong>{labels.title}</strong><small>{labels.subtitle}</small></span></div>
        <div className="livestock-header__actions"><ModuleLanguageSelector /><Link className="livestock-header__back" to={dashboardPath}><ArrowLeft size={17} />{labels.back}</Link></div>
      </header>
      <main className="livestock-main">
        <div className="livestock-hero">
          <div><p className="livestock-eyebrow"><PawPrint size={17} />AGRISATHI</p><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>
          {canSell && <button className="livestock-button livestock-button--primary" type="button" onClick={() => { setEditing(null); setFormError(''); setFormSuccess(''); setView('sell'); }}>{labels.sell}</button>}
        </div>
        <nav className="livestock-tabs" aria-label={labels.title}>
          <button className={view === 'browse' ? 'is-active' : ''} type="button" onClick={() => setView('browse')}>{labels.browse}</button>
          <button className={view === 'saved' ? 'is-active' : ''} type="button" onClick={() => setView('saved')}>{labels.saved}</button>
          <button className={view === 'viewed' ? 'is-active' : ''} type="button" onClick={() => setView('viewed')}>{labels.viewed}</button>
          <button className={view === 'enquiries' ? 'is-active' : ''} type="button" onClick={() => setView('enquiries')}>{labels.enquiries}</button>
          {canSell && <button className={view === 'sellerDashboard' ? 'is-active' : ''} type="button" onClick={() => setView('sellerDashboard')}>{labels.sellerDashboard}</button>}
          {canSell && <button className={view === 'myListings' ? 'is-active' : ''} type="button" onClick={() => setView('myListings')}>{labels.myListings}</button>}
        </nav>
        {notice && <p className="livestock-alert livestock-alert--success" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label={labels.clear}>×</button></p>}
        {error && <p className="livestock-alert livestock-alert--error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label={labels.clear}>×</button></p>}

        {view === 'browse' && (
          <>
            <div className="livestock-search"><Search size={20} aria-hidden="true" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={labels.search} aria-label={labels.search} /></div>
            <div className="livestock-filters">
              <label><span>{labels.category}</span><select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value, breedId: '' })}><option value="">{labels.allCategories}</option>{categories.map((item) => <option key={item.id} value={item.id}>{categoryName(item, lang)}</option>)}</select></label>
              <label><span>{labels.breed}</span><select value={filters.breedId} onChange={(event) => setFilters({ ...filters, breedId: event.target.value })}><option value="">{labels.breed}</option>{(categories.find((item) => item.id === filters.categoryId)?.LivestockBreeds || []).map((breed) => <option key={breed.id} value={breed.id}>{categoryName(breed, lang)}</option>)}</select></label>
              <label><span>{labels.district}</span><input value={filters.district} onChange={(event) => setFilters({ ...filters, district: event.target.value })} /></label>
              <label><span>{labels.mandal}</span><input value={filters.mandal} onChange={(event) => setFilters({ ...filters, mandal: event.target.value })} /></label>
              <label><span>{labels.village}</span><input value={filters.village} onChange={(event) => setFilters({ ...filters, village: event.target.value })} /></label>
              <label><span>{labels.ageMin}</span><input type="number" min="0" max="600" value={filters.minAge} onChange={(event) => setFilters({ ...filters, minAge: event.target.value })} /></label>
              <label><span>{labels.ageMax}</span><input type="number" min="0" max="600" value={filters.maxAge} onChange={(event) => setFilters({ ...filters, maxAge: event.target.value })} /></label>
              <label><span>{labels.gender}</span><select value={filters.gender} onChange={(event) => setFilters({ ...filters, gender: event.target.value })}><option value="">{labels.anyGender}</option><option value="female">{labels.female}</option><option value="male">{labels.male}</option><option value="unknown">{labels.unknown}</option></select></label>
              <label><span>{labels.minPrice}</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} /></label>
              <label><span>{labels.maxPrice}</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} /></label>
              <label><span>{labels.health}</span><select value={filters.healthCondition} onChange={(event) => setFilters({ ...filters, healthCondition: event.target.value })}><option value="">{labels.anyHealth}</option><option value="seller_reports_healthy">{labels.healthy}</option><option value="needs_attention">{labels.attention}</option></select></label>
              <label><span>{labels.vaccination}</span><select value={filters.vaccinationStatus} onChange={(event) => setFilters({ ...filters, vaccinationStatus: event.target.value })}><option value="">{labels.anyVaccination}</option><option value="vaccinated">{labels.vaccinated}</option><option value="partially_vaccinated">{labels.partial}</option><option value="not_vaccinated">{labels.notVaccinated}</option><option value="unknown">{labels.unknown}</option></select></label>
              <label><span>{labels.sort}</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">{labels.newest}</option><option value="price_asc">{labels.priceAsc}</option><option value="price_desc">{labels.priceDesc}</option><option value="age_asc">{labels.ageAsc}</option><option value="age_desc">{labels.ageDesc}</option></select></label>
              <label className="livestock-filter-check"><input type="checkbox" checked={filters.verifiedSeller} onChange={(event) => setFilters({ ...filters, verifiedSeller: event.target.checked })} />{labels.verifiedOnly}</label>
            </div>
            {listingsQuery.isPending ? <p className="livestock-state" role="status">{labels.loading}</p>
              : listingsQuery.isError ? <div className="livestock-state livestock-state--error"><p>{labels.error}</p><button type="button" onClick={() => listingsQuery.refetch()}>{labels.retry}</button></div>
                : listingsQuery.data.items.length ? <div className="livestock-grid">{listingsQuery.data.items.map((listing) => <ListingCard key={listing.id} listing={listing} labels={labels}                 lang={lang} saved={listing.isWishlisted} onOpen={setSelected} onSave={saveListing} onEnquire={openEnquiry} />)}</div>
                  : <p className="livestock-state">{labels.noResults}</p>}
            <Pagination pagination={listingsQuery.data?.pagination} page={page} setPage={setPage} labels={labels} />
          </>
        )}

        {view === 'saved' && (savedQuery.isPending ? <p className="livestock-state" role="status">{labels.loading}</p>
          : savedQuery.isError ? <p className="livestock-state livestock-state--error" role="alert">{labels.error}</p>
            : savedQuery.data?.length ? <div className="livestock-grid">{savedQuery.data.map((listing) => <ListingCard key={listing.id} listing={listing} labels={labels} lang={lang} saved onOpen={setSelected} onSave={saveListing} onEnquire={openEnquiry} />)}</div>
              : <p className="livestock-state">{labels.noSaved}</p>)}
        {view === 'viewed' && (viewedQuery.isPending ? <p className="livestock-state" role="status">{labels.loading}</p>
          : viewedQuery.isError ? <p className="livestock-state livestock-state--error" role="alert">{labels.error}</p>
            : viewedQuery.data?.length ? <div className="livestock-grid">{viewedQuery.data.map((listing) => <ListingCard key={listing.id} listing={listing} labels={labels} lang={lang} saved={listing.isWishlisted} onOpen={setSelected} onSave={saveListing} onEnquire={openEnquiry} />)}</div>
              : <p className="livestock-state">{labels.noResults}</p>)}

        {(view === 'sell') && (
          <ListingForm
            labels={labels}
            categories={categories}
            lang={lang}
            initial={editing}
            busy={listingMutation.isPending}
            mediaBusy={mediaMutation.isPending}
            error={formError}
            success={formSuccess}
            onRemoveMedia={(image) => mediaMutation.mutate({ listingId: editing.id, imageId: image.id })}
            onCancel={() => { setView('myListings'); setEditing(null); }}
            onSubmit={submitListing}
          />
        )}

        {(view === 'myListings' || view === 'sellerDashboard') && canSell && (
          <section className="livestock-seller">
            {view === 'sellerDashboard' && (
              sellerQuery.isPending ? <p className="livestock-state" role="status">{labels.loading}</p>
                : sellerQuery.isError ? <p className="livestock-state livestock-state--error" role="alert">{labels.error}</p>
                  : <div className="livestock-stats">
                    <article><span>{labels.total}</span><strong>{sellerQuery.data.total}</strong></article>
                    <article><span>{labels.active}</span><strong>{sellerQuery.data.active}</strong></article>
                    <article><span>{labels.pendingListings}</span><strong>{sellerQuery.data.pending}</strong></article>
                    <article><span>{labels.sold}</span><strong>{sellerQuery.data.sold}</strong></article>
                    <article><span>{labels.openEnquiries}</span><strong>{sellerQuery.data.openEnquiries}</strong></article>
                    <article><span>{labels.totalViews}</span><strong>{sellerQuery.data.views}</strong></article>
                  </div>
            )}
            {sellerListingsQuery.isPending ? <p className="livestock-state" role="status">{labels.loading}</p>
              : sellerListingsQuery.isError ? <p className="livestock-state livestock-state--error" role="alert">{labels.error}</p>
                : sellerListingsQuery.data.items.length ? <div className="livestock-seller-list">{sellerListingsQuery.data.items.map((listing) => (
                  <article className="livestock-seller-row" key={listing.id}>
                    <div className="livestock-seller-row__main"><h3>{listing.listingName}</h3><span>{labels.status}: {labels[listing.status] || listing.status} · {labels[listing.availability] || listing.availability} · {formatPrice(listing.price)}</span>
                      {listing.rejectionReason && <p className="livestock-disclosure">{listing.rejectionReason}</p>}
                    </div>
                    <div className="livestock-seller-row__actions">
                      <button type="button" onClick={() => editListing(listing)}>{labels.edit}</button>
                      {listing.status === 'approved' && listing.availability !== 'sold' && <button type="button" onClick={() => statusMutation.mutate({ listing, availability: listing.availability === 'available' ? 'paused' : 'available' })}>{listing.availability === 'available' ? labels.pause : labels.activate}</button>}
                      {listing.status === 'approved' && listing.availability !== 'sold' && <button type="button" onClick={() => statusMutation.mutate({ listing, availability: 'sold' })}>{labels.markSold}</button>}
                      {listing.status !== 'archived' && <button type="button" onClick={() => deleteMutation.mutate(listing)}><Trash2 size={16} />{labels.remove}</button>}
                    </div>
                  </article>
                ))}</div> : <p className="livestock-state">{labels.noListings}</p>}
          </section>
        )}

        {view === 'enquiries' && (enquiriesQuery.isPending ? <p className="livestock-state" role="status">{labels.loading}</p>
          : enquiriesQuery.isError ? <p className="livestock-state livestock-state--error" role="alert">{labels.error}</p>
            : enquiriesQuery.data.items.length ? <div className="livestock-enquiries">{enquiriesQuery.data.items.map((enquiry) => (
              <article className="livestock-panel livestock-enquiry" key={enquiry.id}>
                <div><h2>{enquiry.LivestockListing?.listingName || enquiry.subject}</h2><p>{enquiry.subject} · {labels.status}: {enquiry.status}</p></div>
                <button type="button" className="livestock-link-button" onClick={() => setSelectedEnquiryId(enquiry.id)}>{labels.thread}</button>
                {selectedEnquiryId === enquiry.id && (
                  <div className="livestock-thread">
                    <h3>{labels.conversation}</h3>
                    {enquiryDetailQuery.isPending ? <p role="status">{labels.loading}</p>
                      : enquiryDetailQuery.isError ? <p className="livestock-alert livestock-alert--error" role="alert">{getError(enquiryDetailQuery.error, labels.error)}</p>
                        : (enquiryDetailQuery.data.LivestockEnquiryMessages || []).map((item) => (
                          <p className="livestock-thread__message" key={item.id}>
                            <strong>{item.isMine ? labels.you : labels.otherParticipant}</strong>
                            <span>{item.message}</span>
                            <time>{new Date(item.createdAt).toLocaleString()}</time>
                          </p>
                        ))}
                  </div>
                )}
                <form onSubmit={(event) => { event.preventDefault(); const message = new FormData(event.currentTarget).get('message'); messageMutation.mutate({ enquiryId: enquiry.id, message }); event.currentTarget.reset(); }}>
                  <label><span>{labels.reply}</span><input name="message" required maxLength={3000} /></label>
                  <button type="submit" className="livestock-button livestock-button--primary">{labels.send}</button>
                </form>
                <button type="button" className="livestock-link-button" onClick={() => enquiryStatusMutation.mutate({ enquiryId: enquiry.id, status: enquiry.status === 'closed' ? 'open' : 'closed' })}>{enquiry.status === 'closed' ? labels.reopenEnquiry : labels.closeEnquiry}</button>
              </article>
            ))}</div> : <p className="livestock-state">{labels.noEnquiries}</p>)}

      </main>

      {selected && (
        <div className="livestock-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="livestock-modal" role="dialog" aria-modal="true" aria-labelledby="livestock-detail-title">
            <button type="button" className="livestock-modal__close" onClick={() => setSelected(null)} aria-label={labels.cancel}>×</button>
            {detailQuery.isPending ? <p className="livestock-state" role="status">{labels.loadingDetail}</p>
              : detailQuery.isError ? <p className="livestock-state livestock-state--error">{getError(detailQuery.error, labels.error)}</p>
                : (() => {
                  const listing = detailQuery.data;
                  return (
                    <>
                      <div className="livestock-detail-gallery">
                        {listing.images?.map((image) => image.type === 'image'
                          ? <img src={image.url} alt={listing.listingName} key={image.id} />
                          : <video controls preload="metadata" src={image.url} key={image.id} aria-label={labels.videoFile} />)}
                        {!listing.images?.length && <Beef size={64} aria-hidden="true" />}
                      </div>
                      <div className="livestock-detail-content">
                        <p className="livestock-eyebrow">{categoryName(listing.category, lang)}{listing.breed ? ` · ${categoryName(listing.breed, lang)}` : ''}</p>
                        <h2 id="livestock-detail-title">{listing.listingName}</h2>
                        <strong className="livestock-price">{formatPrice(listing.price)} {listing.negotiable && <small>{labels.negotiable}</small>}</strong>
                        <p>{listing.ageMonths} {labels.months} · {labels[listing.gender] || labels.unknown}{listing.weightKg ? ` · ${listing.weightKg} kg` : ''}{listing.color ? ` · ${listing.color}` : ''}</p>
                        {listing.productionDetails?.milkLitresPerDay !== undefined && <p>{labels.milk}: {listing.productionDetails.milkLitresPerDay}</p>}
                        <p className="livestock-disclosure"><ShieldCheck size={16} />{labels.sellerNote}</p>
                        <h3>{labels.healthInfo}</h3><p>{labels[listing.healthCondition === 'seller_reports_healthy' ? 'healthHealthy' : listing.healthCondition === 'needs_attention' ? 'healthNeeds' : 'healthUnknown']}</p>
                        <h3>{labels.vaccinationInfo}</h3><p>{labels[listing.vaccinationStatus === 'vaccinated' ? 'vaccinated' : listing.vaccinationStatus === 'partially_vaccinated' ? 'partial' : listing.vaccinationStatus === 'not_vaccinated' ? 'notVaccinated' : 'vaccineUnknown']}</p>
                        <p>{listing.medicalHistory || listing.dewormingInformation}</p>
                        <h3>{labels.records}</h3>
                        {[...(listing.healthRecords || []), ...(listing.vaccinationRecords || [])].map((record) => <p key={record.id}>{record.date}: {record.note}{record.certificateUrl ? <> · <a href={record.certificateUrl} target="_blank" rel="noreferrer">{labels.certificate}</a></> : record.certificateAvailable ? ` · ${labels.certificate}` : ''}</p>)}
                        <h3>{labels.description}</h3><p>{listing.description}</p>
                        <p className="livestock-location"><MapPin size={15} />{[listing.location?.village, listing.location?.mandal, listing.location?.district, listing.location?.state].filter(Boolean).join(', ')}</p>
                        <h3>{labels.seller}</h3><p>{listing.seller?.name} {listing.seller?.isVerified ? <span className="livestock-verified"><BadgeCheck size={15} />{labels.verified}</span> : <span>{labels.unverified}</span>}</p>
                        {listing.seller?.phone ? <a className="livestock-button" href={`tel:${listing.seller.phone}`}>{labels.contact}: {listing.seller.phone}</a> : <p>{labels.noPhone}</p>}
                        {listing.status === 'approved' && listing.availability === 'available' && !listing.isOwner && (
                          <div className="livestock-detail-actions">
                            <button type="button" className="livestock-button livestock-button--primary" onClick={() => openEnquiry(listing)}>{labels.sendEnquiry}</button>
                            <button type="button" className="livestock-button" onClick={() => setReportTarget(listing.id)}>{labels.report}</button>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
          </section>
        </div>
      )}

      {enquiryListing && (
        <div className="livestock-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEnquiryListing(null); }}>
          <form className="livestock-modal livestock-enquiry-form" onSubmit={(event) => { event.preventDefault(); enquiryMutation.mutate(); }}>
            <button type="button" className="livestock-modal__close" onClick={() => setEnquiryListing(null)} aria-label={labels.cancel}>×</button>
            <p className="livestock-eyebrow">{enquiryListing.listingName}</p><h2>{labels.sendEnquiry}</h2>
            {error && <p className="livestock-alert livestock-alert--error" role="alert">{error}</p>}
            <label><span>{labels.subject}</span><input value={enquirySubject} onChange={(event) => setEnquirySubject(event.target.value)} maxLength={180} placeholder={labels.subject} /></label>
            <label><span>{labels.message}</span><textarea required rows="5" maxLength={3000} value={enquiryMessage} onChange={(event) => setEnquiryMessage(event.target.value)} /></label>
            <button type="submit" className="livestock-button livestock-button--primary" disabled={enquiryMutation.isPending}>{enquiryMutation.isPending && <LoaderCircle className="livestock-spin" size={18} />}{labels.send}</button>
          </form>
        </div>
      )}
      {reportTarget && (
        <div className="livestock-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportTarget(''); }}>
          <form className="livestock-modal livestock-enquiry-form" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            reportMutation.mutate({ listingId: reportTarget, reason: data.get('reason'), description: data.get('description') });
          }}>
            <button type="button" className="livestock-modal__close" onClick={() => setReportTarget('')} aria-label={labels.cancel}>×</button>
            <h2>{labels.report}</h2>
            <label><span>{labels.reportReason}</span>
              <select name="reason" required defaultValue="other">
                <option value="misleading">{labels.reportMisleading}</option>
                <option value="unsafe">{labels.reportUnsafe}</option>
                <option value="fraud">{labels.reportFraud}</option>
                <option value="other">{labels.reportOther}</option>
              </select>
            </label>
            <label><span>{labels.reportDetails}</span><textarea name="description" rows="4" maxLength="1600" /></label>
            {error && <p className="livestock-alert livestock-alert--error" role="alert">{error}</p>}
            <button type="submit" className="livestock-button livestock-button--primary" disabled={reportMutation.isPending}>{labels.reportSubmit}</button>
          </form>
        </div>
      )}
    </div>
  );
}
