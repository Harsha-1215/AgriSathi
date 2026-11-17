import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BadgeCheck, Heart, Leaf, LoaderCircle, MapPin, Package, PawPrint, Search, ShoppingCart,
  Store, Trash2, Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/marketplace.css';

const copy = {
  en: {
    title: 'Agricultural Marketplace', subtitle: 'Find farm inputs and equipment from marketplace sellers.',
    back: 'Back to dashboard', browse: 'Browse', cart: 'Cart', wishlist: 'Saved', orders: 'My orders', myEnquiries: 'My enquiries',
    sell: 'Sell on AGRISATHI', listings: 'My listings', sellerOrders: 'Seller orders', enquiries: 'Enquiries', sellerOverview: 'Seller dashboard',
    products: 'Listings', pendingProducts: 'Pending review', openEnquiries: 'Open enquiries', ordersCount: 'Orders',
    search: 'Search products', allCategories: 'All categories', allLocations: 'All districts', sort: 'Sort by', previous: 'Previous', next: 'Next',
    loading: 'Loading marketplace…', retry: 'Try again', empty: 'No matching listings are available.',
    addCart: 'Add to cart', save: 'Save', unsave: 'Remove saved', details: 'Details',
    organic: 'Organic', verified: 'Verified seller', pending: 'Awaiting review', rejected: 'Needs changes',
    available: 'Available', out: 'Out of stock', quantity: 'Quantity', remove: 'Remove', subtotal: 'Subtotal',
    checkout: 'Place COD order', codOff: 'Cash on delivery is not enabled. Contact the marketplace administrator.', settingsError: 'Could not load checkout settings.',
    noOnline: 'Online payments are not available. No payment will be taken.',
    recipient: 'Recipient name', phone: 'Phone', address: 'Address', village: 'Village / town',
    mandal: 'Mandal', district: 'District', state: 'State', pinCode: 'PIN code', orderSuccess: 'Order placed.',
    name: 'Product name', category: 'Category', price: 'Price (₹)', unit: 'Unit', stock: 'Available quantity',
    minOrder: 'Minimum order', description: 'Description', brand: 'Brand', images: 'Product photos', pickupLocation: 'Pickup location',
    createListing: 'Submit listing for review', listingNote: 'New and edited listings are reviewed before appearing publicly.',
    noListings: 'You have no listings yet.', noOrders: 'No orders yet.', noEnquiries: 'No enquiries yet.',
    status: 'Status', update: 'Update', reply: 'Reply to farmer', question: 'Question',
    review: 'Leave a review', rating: 'Rating', submitReview: 'Submit review', delivered: 'Delivered',
    error: 'Marketplace request failed.', location: 'Location',             sellerProfile: 'Seller profile', delivery: 'Delivery', pickup: 'Pickup', license: 'License number', safety: 'Product safety information', edit: 'Edit listing', saveChanges: 'Save changes',
    businessName: 'Business name', businessDescription: 'Business description', saveProfile: 'Save seller profile',
    loginNeeded: 'Sign in to browse and buy products.', report: 'Report listing',
  },
  te: {
    title: 'వ్యవసాయ మార్కెట్', subtitle: 'వ్యవసాయ ఉత్పత్తులు, పరికరాలను విక్రేతల నుంచి కనుగొనండి.',
    back: 'డాష్‌బోర్డ్‌కు తిరిగి', browse: 'వెతకండి', cart: 'కార్ట్', wishlist: 'భద్రపరచినవి', orders: 'నా ఆర్డర్లు', myEnquiries: 'నా విచారణలు',
    sell: 'AGRISATHIలో అమ్మండి', listings: 'నా ప్రకటనలు', sellerOrders: 'విక్రేత ఆర్డర్లు', enquiries: 'విచారణలు', sellerOverview: 'విక్రేత డాష్‌బోర్డ్',
    products: 'ప్రకటనలు', pendingProducts: 'సమీక్షలో ఉన్నవి', openEnquiries: 'తెరిచిన విచారణలు', ordersCount: 'ఆర్డర్లు',
    search: 'ఉత్పత్తులను వెతకండి', allCategories: 'అన్ని వర్గాలు', allLocations: 'అన్ని జిల్లాలు', sort: 'క్రమం', previous: 'మునుపటి', next: 'తదుపరి',
    loading: 'మార్కెట్ లోడ్ అవుతోంది…', retry: 'మళ్లీ ప్రయత్నించండి', empty: 'సరిపోలే ప్రకటనలు లేవు.',
    addCart: 'కార్ట్‌లో చేర్చండి', save: 'భద్రపరచండి', unsave: 'తొలగించండి', details: 'వివరాలు',
    organic: 'సేంద్రియం', verified: 'ధృవీకరించిన విక్రేత', pending: 'సమీక్షలో ఉంది', rejected: 'మార్పులు అవసరం',
    available: 'అందుబాటులో ఉంది', out: 'స్టాక్ లేదు', quantity: 'పరిమాణం', remove: 'తొలగించండి', subtotal: 'మొత్తం',
    checkout: 'COD ఆర్డర్ చేయండి', codOff: 'క్యాష్ ఆన్ డెలివరీ ప్రారంభించలేదు. నిర్వాహకుడిని సంప్రదించండి.', settingsError: 'చెక్‌అవుట్ సెట్టింగ్‌లను లోడ్ చేయలేకపోయాం.',
    noOnline: 'ఆన్‌లైన్ చెల్లింపులు అందుబాటులో లేవు. డబ్బు తీసుకోబడదు.',
    recipient: 'పొందేవారి పేరు', phone: 'ఫోన్', address: 'చిరునామా', village: 'గ్రామం / పట్టణం',
    mandal: 'మండలం', district: 'జిల్లా', state: 'రాష్ట్రం', pinCode: 'పిన్ కోడ్', orderSuccess: 'ఆర్డర్ పూర్తయింది.',
    name: 'ఉత్పత్తి పేరు', category: 'వర్గం', price: 'ధర (₹)', unit: 'యూనిట్', stock: 'అందుబాటులో ఉన్న పరిమాణం',
    minOrder: 'కనీస ఆర్డర్', description: 'వివరణ', brand: 'బ్రాండ్', images: 'ఉత్పత్తి ఫోటోలు', pickupLocation: 'పికప్ స్థలం',
    createListing: 'సమీక్షకు ప్రకటన పంపండి', listingNote: 'కొత్త, సవరించిన ప్రకటనలు ప్రచురణకు ముందు సమీక్షించబడతాయి.',
    noListings: 'మీ ప్రకటనలు లేవు.', noOrders: 'ఆర్డర్లు లేవు.', noEnquiries: 'విచారణలు లేవు.',
    status: 'స్థితి', update: 'నవీకరించండి', reply: 'రైతుకు సమాధానం', question: 'ప్రశ్న',
    review: 'సమీక్ష రాయండి', rating: 'రేటింగ్', submitReview: 'సమీక్ష పంపండి', delivered: 'చేరింది',
    error: 'మార్కెట్ అభ్యర్థన విఫలమైంది.', location: 'ప్రాంతం',             sellerProfile: 'విక్రేత వివరాలు', delivery: 'డెలివరీ', pickup: 'పికప్', license: 'లైసెన్స్ నంబర్', safety: 'ఉత్పత్తి భద్రతా సమాచారం', edit: 'ప్రకటనను సవరించండి', saveChanges: 'మార్పులను భద్రపరచండి',
    businessName: 'వ్యాపార పేరు', businessDescription: 'వ్యాపార వివరణ', saveProfile: 'విక్రేత వివరాలు భద్రపరచండి',
    loginNeeded: 'ఉత్పత్తులు కొనడానికి సైన్ ఇన్ చేయండి.', report: 'ప్రకటనను నివేదించండి',
  },
  hi: {
    title: 'कृषि बाज़ार', subtitle: 'कृषि सामग्री और उपकरण विक्रेताओं से खोजें।',
    back: 'डैशबोर्ड पर वापस', browse: 'खोजें', cart: 'कार्ट', wishlist: 'सहेजे गए', orders: 'मेरे ऑर्डर', myEnquiries: 'मेरी पूछताछ',
    sell: 'AGRISATHI पर बेचें', listings: 'मेरी लिस्टिंग', sellerOrders: 'विक्रेता ऑर्डर', enquiries: 'पूछताछ', sellerOverview: 'विक्रेता डैशबोर्ड',
    products: 'लिस्टिंग', pendingProducts: 'समीक्षा लंबित', openEnquiries: 'खुली पूछताछ', ordersCount: 'ऑर्डर',
    search: 'उत्पाद खोजें', allCategories: 'सभी श्रेणियाँ', allLocations: 'सभी जिले', sort: 'क्रम', previous: 'पिछला', next: 'अगला',
    loading: 'बाज़ार लोड हो रहा है…', retry: 'फिर प्रयास करें', empty: 'कोई मिलती-जुलती लिस्टिंग उपलब्ध नहीं है।',
    addCart: 'कार्ट में जोड़ें', save: 'सहेजें', unsave: 'हटाएँ', details: 'विवरण',
    organic: 'जैविक', verified: 'सत्यापित विक्रेता', pending: 'समीक्षा लंबित', rejected: 'सुधार आवश्यक',
    available: 'उपलब्ध', out: 'स्टॉक समाप्त', quantity: 'मात्रा', remove: 'हटाएँ', subtotal: 'उप-योग',
    checkout: 'कैश-ऑन-डिलीवरी ऑर्डर', codOff: 'कैश ऑन डिलीवरी सक्षम नहीं है। व्यवस्थापक से संपर्क करें।', settingsError: 'चेकआउट सेटिंग लोड नहीं हुई।',
    noOnline: 'ऑनलाइन भुगतान उपलब्ध नहीं है। कोई भुगतान नहीं लिया जाएगा।',
    recipient: 'प्राप्तकर्ता का नाम', phone: 'फ़ोन', address: 'पता', village: 'गाँव / शहर',
    mandal: 'मंडल', district: 'ज़िला', state: 'राज्य', pinCode: 'पिन कोड', orderSuccess: 'ऑर्डर हो गया।',
    name: 'उत्पाद का नाम', category: 'श्रेणी', price: 'कीमत (₹)', unit: 'इकाई', stock: 'उपलब्ध मात्रा',
    minOrder: 'न्यूनतम ऑर्डर', description: 'विवरण', brand: 'ब्रांड', images: 'उत्पाद फ़ोटो', pickupLocation: 'पिकअप स्थान',
    createListing: 'समीक्षा के लिए लिस्टिंग भेजें', listingNote: 'नई और संपादित लिस्टिंग प्रकाशन से पहले जाँची जाती हैं।',
    noListings: 'आपकी कोई लिस्टिंग नहीं है।', noOrders: 'अभी कोई ऑर्डर नहीं।', noEnquiries: 'अभी कोई पूछताछ नहीं।',
    status: 'स्थिति', update: 'अपडेट', reply: 'किसान को जवाब दें', question: 'प्रश्न',
    review: 'समीक्षा लिखें', rating: 'रेटिंग', submitReview: 'समीक्षा जमा करें', delivered: 'डिलीवर',
    error: 'बाज़ार अनुरोध विफल हुआ।', location: 'स्थान',             sellerProfile: 'विक्रेता प्रोफ़ाइल', delivery: 'डिलीवरी', pickup: 'पिकअप', license: 'लाइसेंस नंबर', safety: 'उत्पाद सुरक्षा जानकारी', edit: 'लिस्टिंग संपादित करें', saveChanges: 'बदलाव सहेजें',
    businessName: 'व्यवसाय का नाम', businessDescription: 'व्यवसाय विवरण', saveProfile: 'प्रोफ़ाइल सहेजें',
    loginNeeded: 'खरीदने के लिए साइन इन करें।', report: 'लिस्टिंग रिपोर्ट करें',
  },
};

function getError(error, fallback) {
  return error?.response?.data?.message || fallback;
}

async function getPage(promise) {
  const response = await promise;
  const body = response?.data || {};
  return {
    items: Array.isArray(body.data) ? body.data : [],
    pagination: body.pagination || { page: 1, pages: 1, total: 0 },
  };
}

function Pagination({ pagination, page, onChange, labels }) {
  if (!pagination || pagination.pages < 2) return null;
  return (
    <nav className="market-pagination" aria-label="Pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>{labels.previous}</button>
      <span>{page} / {pagination.pages}</span>
      <button type="button" disabled={page >= pagination.pages} onClick={() => onChange(page + 1)}>{labels.next}</button>
    </nav>
  );
}

function categoryName(category, lang) {
  return category?.translations?.[lang] || category?.name || '';
}

function ProductCard({ product, labels, lang, onAdd, onWish, onOpen, busy }) {
  return (
    <article className="market-card">
      <button className="market-card__image" type="button" onClick={() => onOpen(product)} aria-label={`${labels.details}: ${product.productName}`}>
        {product.images?.[0]?.imageUrl ? <img src={product.images[0].imageUrl} alt={product.productName} /> : <Package size={38} aria-hidden="true" />}
      </button>
      <div className="market-card__body">
        <div className="market-card__tags">
          {product.isOrganic && <span className="market-tag"><Leaf size={14} />{labels.organic}</span>}
          {product.seller?.isVerified && <span className="market-tag market-tag--verified"><BadgeCheck size={14} />{labels.verified}</span>}
        </div>
        <h2>{product.productName}</h2>
        <p className="market-muted">{categoryName(product.category, lang)}{product.brand ? ` · ${product.brand}` : ''}</p>
        {product.averageRating !== null && product.averageRating !== undefined && <p className="market-rating" aria-label={`${product.averageRating} out of 5`}>★ {Number(product.averageRating).toFixed(1)} <small>({product.reviewCount || 0})</small></p>}
        <strong className="market-price">₹{Number(product.price).toLocaleString()} <small>/ {product.unit}</small></strong>
        <p className="market-muted"><MapPin size={14} /> {[product.location?.village, product.location?.district, product.location?.state].filter(Boolean).join(', ') || '—'}</p>
        <div className="market-card__actions">
          <button type="button" className="market-button market-button--primary" disabled={busy || product.availability !== 'available'} onClick={() => onAdd(product)}>{labels.addCart}</button>
          <button type="button" className="market-icon-button" onClick={() => onWish(product)} aria-label={labels.save}><Heart size={19} fill={product.isWishlisted ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
    </article>
  );
}

const emptyAddress = { recipientName: '', phone: '', addressLine1: '', village: '', mandal: '', district: '', state: '', pinCode: '' };

export default function MarketplacePage({ initialView = 'browse' }) {
  const { lang } = useLanguage();
  const labels = copy[lang] || copy.en;
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [address, setAddress] = useState(emptyAddress);
  const [fulfillmentMethods, setFulfillmentMethods] = useState({});
  const [reply, setReply] = useState({});
  const [searchForm, setSearchForm] = useState({ q: '', categoryId: '', productName: '', description: '', unit: '', price: '', availableQuantity: '', minOrderQuantity: '1', brand: '', safetyInformation: '', pickupLocation: '', state: '', district: '', village: '', deliveryAvailable: true, pickupAvailable: true, images: [] });
  const [sellerForm, setSellerForm] = useState({ businessName: '', description: '', state: '', district: '', mandal: '', village: '', pinCode: '', licenseNumber: '' });
  const [reviewForm, setReviewForm] = useState({});
  const [enquiryText, setEnquiryText] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: async () => unwrapPayload(await api.get('/marketplace/categories')),
    retry: false,
  });
  const settingsQuery = useQuery({
    queryKey: ['marketplace', 'settings'],
    queryFn: async () => unwrapPayload(await api.get('/marketplace/settings')),
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ['marketplace', 'products', search, category, district, sort, page],
    queryFn: async () => getPage(api.get('/marketplace/products', {
      params: { q: search || undefined, categoryId: category || undefined, district: district || undefined, sort, page, limit: 24 },
    })),
    enabled: view === 'browse',
    retry: false,
  });
  const cartQuery = useQuery({
    queryKey: ['marketplace', 'cart'],
    queryFn: async () => unwrapPayload(await api.get('/marketplace/cart')),
    enabled: view === 'cart',
    retry: false,
  });
  const wishlistQuery = useQuery({
    queryKey: ['marketplace', 'wishlist'],
    queryFn: async () => unwrapPayload(await api.get('/marketplace/wishlist')),
    enabled: view === 'wishlist',
    retry: false,
  });
  const ordersQuery = useQuery({
    queryKey: ['marketplace', 'orders', page],
    queryFn: async () => getPage(api.get('/marketplace/orders', { params: { page, limit: 24 } })),
    enabled: view === 'orders',
    retry: false,
  });
  const sellerProfileQuery = useQuery({
    queryKey: ['marketplace', 'seller', 'profile'],
    queryFn: async () => unwrapPayload(await api.get('/marketplace/seller/profile')),
    enabled: ['sell', 'listings', 'sellerOrders', 'enquiries'].includes(view),
    retry: false,
  });
  const sellerProductsQuery = useQuery({
    queryKey: ['marketplace', 'seller', 'products', page],
    queryFn: async () => getPage(api.get('/marketplace/seller/products', { params: { page, limit: 24 } })),
    enabled: view === 'listings',
    retry: false,
  });
  const sellerOrdersQuery = useQuery({
    queryKey: ['marketplace', 'seller', 'orders', page],
    queryFn: async () => getPage(api.get('/marketplace/seller/orders', { params: { page, limit: 24 } })),
    enabled: view === 'sellerOrders',
    retry: false,
  });
  const enquiriesQuery = useQuery({
    queryKey: ['marketplace', 'seller', 'enquiries', page],
    queryFn: async () => getPage(api.get('/marketplace/seller/enquiries', { params: { page, limit: 24 } })),
    enabled: view === 'enquiries',
    retry: false,
  });
  const buyerEnquiriesQuery = useQuery({
    queryKey: ['marketplace', 'buyer', 'enquiries', page],
    queryFn: async () => getPage(api.get('/marketplace/enquiries', { params: { page, limit: 24 } })),
    enabled: view === 'myEnquiries',
    retry: false,
  });
  const sellerDashboardQuery = useQuery({
    queryKey: ['marketplace', 'seller', 'dashboard'],
    queryFn: async () => unwrapPayload(await api.get('/marketplace/seller/dashboard')),
    enabled: view === 'sellerOverview',
    retry: false,
  });

  const products = productsQuery.data?.items || [];
  const cartItems = cartQuery.data?.items || [];
  const wishlisted = wishlistQuery.data || [];
  const orders = ordersQuery.data?.items || [];
  const sellerProducts = sellerProductsQuery.data?.items || [];
  const sellerOrders = sellerOrdersQuery.data?.items || [];
  const enquiries = enquiriesQuery.data?.items || [];
  const buyerEnquiries = buyerEnquiriesQuery.data?.items || [];
  const categories = categoriesQuery.data || [];
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + (item.available ? Number(item.product?.price || 0) * Number(item.quantity || 0) : 0), 0), [cartItems]);
  const usesDelivery = cartItems.some((item) => item.available && (
    fulfillmentMethods[item.product.id] || (item.product.deliveryAvailable ? 'delivery' : 'pickup')
  ) === 'delivery');
  const isSeller = ['farmer', 'farmer_user', 'seller'].includes(user?.role);
  const isBuyer = ['farmer', 'farmer_user', 'buyer', 'seller'].includes(user?.role);
  const activeQuery = ({
    browse: productsQuery, cart: cartQuery, wishlist: wishlistQuery, orders: ordersQuery,
    myEnquiries: buyerEnquiriesQuery, sellerOverview: sellerDashboardQuery,
    listings: sellerProductsQuery, sellerOrders: sellerOrdersQuery, enquiries: enquiriesQuery,
  })[view];

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setPage(1);
  }, [search, category, district, sort]);

  useEffect(() => {
    const profile = sellerProfileQuery.data;
    if (!profile) return;
    setSellerForm({
      businessName: profile.businessName || '',
      description: profile.description || '',
      state: profile.state || '',
      district: profile.district || '',
      mandal: profile.mandal || '',
      village: profile.village || '',
      pinCode: profile.pinCode || '',
      licenseNumber: profile.licenseNumber || '',
    });
  }, [sellerProfileQuery.data]);

  async function refresh(keys = []) {
    const defaults = [['marketplace', 'products'], ['marketplace', 'cart'], ['marketplace', 'wishlist'], ['marketplace', 'orders'], ['marketplace', 'seller']];
    await Promise.all([...defaults, ...keys].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  }

  async function runAction(action, success) {
    setNotice('');
    setBusy(true);
    try {
      await action();
      if (success) setNotice(success);
      await refresh();
      return true;
    } catch (error) {
      setNotice(getError(error, labels.error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function setAddressField(key, value) {
    setAddress((current) => ({ ...current, [key]: value }));
  }

  async function submitListing(event) {
    event.preventDefault();
    const formData = new FormData();
    Object.entries(searchForm).forEach(([key, value]) => {
      if (key === 'images') value.forEach((image) => formData.append('images', image));
      else if (value !== '') formData.append(key, value);
    });
    await runAction(async () => {
      if (editingProduct) {
        await api.put(`/marketplace/seller/products/${editingProduct.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/marketplace/seller/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setEditingProduct(null);
      setSearchForm({ q: '', categoryId: '', productName: '', description: '', unit: '', price: '', availableQuantity: '', minOrderQuantity: '1', brand: '', safetyInformation: '', pickupLocation: '', state: '', district: '', village: '', deliveryAvailable: true, pickupAvailable: true, images: [] });
      setView('listings');
    }, labels.listingNote);
  }

  function editListing(product) {
    setEditingProduct(product);
    setSearchForm({
      q: '',
      categoryId: product.category?.id || '',
      productName: product.productName || '',
      description: product.description || '',
      unit: product.unit || '',
      price: product.price ?? '',
      availableQuantity: product.availableQuantity ?? '',
      minOrderQuantity: product.minOrderQuantity ?? '1',
      brand: product.brand || '',
      safetyInformation: product.safetyInformation || '',
      pickupLocation: product.pickupLocation || '',
      state: product.location?.state || '',
      district: product.location?.district || '',
      village: '',
      deliveryAvailable: Boolean(product.deliveryAvailable),
      pickupAvailable: Boolean(product.pickupAvailable),
      images: [],
    });
    setView('sell');
  }

  async function saveSellerProfile(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.put('/marketplace/seller/profile', sellerForm);
      await sellerProfileQuery.refetch();
    }, labels.saveProfile);
  }

  async function checkout(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.post('/marketplace/orders', {
        paymentMethod: 'cod',
        address: usesDelivery ? address : undefined,
        fulfillmentMethods: Object.fromEntries(cartItems.filter((item) => item.product).map((item) => [
          item.product.id,
          fulfillmentMethods[item.product.id] || (item.product.deliveryAvailable ? 'delivery' : 'pickup'),
        ])),
      });
      setAddress(emptyAddress);
      setFulfillmentMethods({});
      setView('orders');
    }, labels.orderSuccess);
  }

  async function submitReply(enquiryId) {
    await runAction(() => api.put(`/marketplace/seller/enquiries/${enquiryId}/reply`, { reply: reply[enquiryId] }), labels.update);
  }

  async function submitReview(item, orderId) {
    const form = reviewForm[item.id] || {};
    const submitted = await runAction(() => api.post(`/marketplace/products/${item.productId}/reviews`, {
      orderItemId: item.id,
      rating: Number(form.rating || 5),
      review: form.review || '',
    }), labels.submitReview);
    if (submitted) setReviewForm((current) => ({ ...current, [item.id]: { ...current[item.id], submitted: true, orderId } }));
  }

  const tabs = [
    ['browse', labels.browse, Search],
    ['cart', labels.cart, ShoppingCart],
    ['wishlist', labels.wishlist, Heart],
    ['orders', labels.orders, Truck],
    ...(isBuyer ? [['myEnquiries', labels.myEnquiries, BadgeCheck]] : []),
    ...(isSeller ? [['sellerOverview', labels.sellerOverview, Store], ['sell', labels.sell, Store], ['listings', labels.listings, Package], ['sellerOrders', labels.sellerOrders, Truck], ['enquiries', labels.enquiries, BadgeCheck]] : []),
  ];

  return (
    <main className="marketplace-page">
      <header className="marketplace-header">
        <div className="marketplace-header__brand"><Link to="/"><Logo size="small" /></Link><span><strong>{labels.title}</strong><small>{labels.subtitle}</small></span></div>
        <div className="marketplace-header__actions"><ModuleLanguageSelector /><Link to={user?.role === 'seller' ? '/seller/livestock' : user?.role === 'buyer' ? '/buyer/livestock' : '/farmer/livestock'} className="market-back"><PawPrint size={17} />{lang === 'te' ? 'పశువుల మార్కెట్' : lang === 'hi' ? 'पशुधन बाज़ार' : 'Livestock'}</Link><Link to={user?.role === 'seller' ? (location.pathname.startsWith('/seller/dashboard') ? '/seller/marketplace' : '/seller/dashboard') : user?.role === 'buyer' ? '/' : '/farmer/dashboard'} className="market-back"><ArrowLeft size={17} />{labels.back}</Link></div>
      </header>
      <section className="marketplace-main">
        <nav className="market-tabs" aria-label={labels.title}>
          {tabs.map(([id, label, Icon]) => <button key={id} type="button" className={view === id ? 'is-active' : ''} onClick={() => { setView(id); setNotice(''); }}><Icon size={18} />{label}{id === 'cart' && cartItems.length > 0 ? ` (${cartItems.length})` : ''}</button>)}
        </nav>

        {notice && <p className="market-notice" role="status">{notice}</p>}
        {categoriesQuery.isError && <p className="market-error" role="alert">{getError(categoriesQuery.error, labels.error)}</p>}
        {activeQuery?.isError && <div className="market-error" role="alert">{getError(activeQuery.error, labels.error)} <button type="button" onClick={() => activeQuery.refetch()}>{labels.retry}</button></div>}
        {sellerProfileQuery.isError && ['sell', 'listings', 'sellerOrders', 'enquiries'].includes(view) && <div className="market-error" role="alert">{getError(sellerProfileQuery.error, labels.error)} <button type="button" onClick={() => sellerProfileQuery.refetch()}>{labels.retry}</button></div>}
        {activeQuery?.isPending && <p className="market-loading" role="status"><LoaderCircle className="market-spinner" />{labels.loading}</p>}

        {view === 'browse' && (
          <>
            <div className="market-toolbar">
              <label className="market-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} /></label>
              <select aria-label={labels.category} value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{labels.allCategories}</option>{categories.map((item) => <option value={item.id} key={item.id}>{categoryName(item, lang)}</option>)}</select>
              <input aria-label={labels.allLocations} placeholder={labels.allLocations} value={district} onChange={(event) => setDistrict(event.target.value)} />
              <select aria-label={labels.sort} value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="popular">Popular</option><option value="rating">Rating</option>
              </select>
            </div>
            {!isBuyer && <p className="market-notice">{labels.loginNeeded}</p>}
            {!productsQuery.isPending && !productsQuery.isError && products.length === 0 && <p className="market-empty">{labels.empty}</p>}
            <div className="market-grid">
              {products.map((product) => <ProductCard key={product.id} product={product} labels={labels} lang={lang} busy={busy} onOpen={setSelected}
                onAdd={(item) => runAction(() => api.post('/marketplace/cart/items', { productId: item.id, quantity: Number(item.minOrderQuantity) }), labels.addCart)}
                onWish={(item) => runAction(() => item.isWishlisted ? api.delete(`/marketplace/wishlist/${item.id}`) : api.post(`/marketplace/wishlist/${item.id}`), labels.save)} />)}
            </div>
            <Pagination pagination={productsQuery.data?.pagination} page={page} onChange={setPage} labels={labels} />
          </>
        )}

        {view === 'cart' && <section className="market-panel">
          {cartItems.length === 0 ? <p className="market-empty">{labels.empty}</p> : <>
            <div className="market-cart-list">{cartItems.map((item) => <article className="market-cart-item" key={item.id}>
              {item.product?.images?.[0]?.imageUrl && <img src={item.product.images[0].imageUrl} alt="" />}
              <div className="market-cart-item__info"><strong>{item.product?.productName || labels.out}</strong><small>{item.available ? `₹${Number(item.product.price).toLocaleString()} / ${item.product.unit}` : labels.out}</small>
                <div className="market-cart-item__options">
                  {item.available && <label>{labels.delivery}<select value={fulfillmentMethods[item.product.id] || (item.product.deliveryAvailable ? 'delivery' : 'pickup')} onChange={(event) => setFulfillmentMethods((current) => ({ ...current, [item.product.id]: event.target.value }))}>
                    {item.product.deliveryAvailable && <option value="delivery">{labels.delivery}</option>}
                    {item.product.pickupAvailable && <option value="pickup">{labels.pickup}</option>}
                  </select></label>}
                  <label>{labels.quantity}<input type="number" min={item.product?.minOrderQuantity || 1} max={item.product?.availableQuantity || 1} step="0.001" defaultValue={item.quantity} disabled={!item.available} onBlur={(event) => {
                    if (Number(event.target.value) !== Number(item.quantity)) runAction(() => api.put(`/marketplace/cart/items/${item.id}`, { quantity: Number(event.target.value) }), labels.update);
                  }} /></label>
                </div>
              </div>
              <button type="button" className="market-icon-button" aria-label={labels.remove} onClick={() => runAction(() => api.delete(`/marketplace/cart/items/${item.id}`), labels.remove)}><Trash2 size={18} /></button>
            </article>)}</div>
            <p className="market-subtotal"><strong>{labels.subtotal}</strong><strong>₹{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
            <p className="market-warning">{labels.noOnline}</p>
            {settingsQuery.isError ? <p className="market-error" role="alert">{getError(settingsQuery.error, labels.settingsError)} <button type="button" onClick={() => settingsQuery.refetch()}>{labels.retry}</button></p>
              : settingsQuery.isPending ? <p className="market-loading" role="status">{labels.loading}</p>
                : settingsQuery.data?.cashOnDeliveryEnabled ? <form className="market-checkout" onSubmit={checkout}>
              <h2>{labels.checkout}</h2><div className="market-form-grid">
                {usesDelivery && [['recipientName', labels.recipient], ['phone', labels.phone], ['addressLine1', labels.address], ['village', labels.village], ['mandal', labels.mandal], ['district', labels.district], ['state', labels.state], ['pinCode', labels.pinCode]].map(([key, label]) => <label key={key}>{label}<input required={key !== 'mandal'} value={address[key] || ''} onChange={(event) => setAddressField(key, event.target.value)} /></label>)}
              </div><button className="market-button market-button--primary" type="submit" disabled={busy}>{labels.checkout}</button>
            </form> : <p className="market-warning">{labels.codOff}</p>}
          </>}
        </section>}

        {view === 'wishlist' && <div className="market-grid">{wishlisted.map((product) => <ProductCard key={product.id} product={product} labels={labels} lang={lang} busy={busy} onOpen={setSelected}
          onAdd={(item) => runAction(() => api.post('/marketplace/cart/items', { productId: item.id, quantity: Number(item.minOrderQuantity) }), labels.addCart)}
          onWish={(item) => runAction(() => api.delete(`/marketplace/wishlist/${item.id}`), labels.unsave)} />)}</div>}

        {view === 'orders' && <section className="market-order-list">
          {orders.length === 0 ? <p className="market-empty">{labels.noOrders}</p> : orders.map((order) => <article className="market-order" key={order.id}>
            <header><div><strong>#{order.id.slice(0, 8)}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></div><span className={`market-status market-status--${order.status}`}>{order.status}</span></header>
            <p>{order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod} · ₹{Number(order.total).toLocaleString()}</p>
            {(order.MarketplaceOrderItems || []).map((item) => <div className="market-order-line" key={item.id}>
              <span>{item.productName} · {item.quantity} {item.unit} · {item.fulfillmentMethod === 'pickup' ? `${labels.pickup}${item.pickupLocation ? `: ${item.pickupLocation}` : ''}` : labels.delivery}</span>
              {order.status === 'delivered' && !reviewForm[item.id]?.submitted && <form className="market-inline-review" onSubmit={(event) => { event.preventDefault(); submitReview(item, order.id); }}>
                <select aria-label={labels.rating} value={reviewForm[item.id]?.rating || 5} onChange={(event) => setReviewForm((current) => ({ ...current, [item.id]: { ...current[item.id], rating: event.target.value } }))}><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select>
                <input aria-label={labels.review} placeholder={labels.review} value={reviewForm[item.id]?.review || ''} onChange={(event) => setReviewForm((current) => ({ ...current, [item.id]: { ...current[item.id], review: event.target.value } }))} />
                <button type="submit" disabled={busy}>{labels.submitReview}</button>
              </form>}
            </div>)}
              {order.status === 'shipped' && <button className="market-button market-button--primary" type="button" onClick={() => runAction(() => api.post(`/marketplace/orders/${order.id}/confirm-delivery`), labels.delivered)}>{labels.delivered}</button>}
            {['pending', 'confirmed'].includes(order.status) && <button className="market-button market-button--quiet" type="button" onClick={() => runAction(() => api.put(`/marketplace/orders/${order.id}/cancel`, { reason: 'Cancelled by buyer' }), labels.remove)}>{labels.remove}</button>}
          </article>)}
        </section>}
        {view === 'orders' && <Pagination pagination={ordersQuery.data?.pagination} page={page} onChange={setPage} labels={labels} />}

        {view === 'myEnquiries' && <section className="market-order-list">
          {buyerEnquiries.length === 0 ? <p className="market-empty">{labels.noEnquiries}</p> : buyerEnquiries.map((enquiry) => <article className="market-order" key={enquiry.id}>
            <header><div><strong>{enquiry.MarketplaceProduct?.productName || labels.question}</strong><small>{new Date(enquiry.createdAt).toLocaleString()}</small></div><span className="market-status">{enquiry.status}</span></header>
            <p>{enquiry.question}</p>{enquiry.reply && <p className="market-notice">{enquiry.reply}</p>}
          </article>)}
        </section>}
        {view === 'myEnquiries' && <Pagination pagination={buyerEnquiriesQuery.data?.pagination} page={page} onChange={setPage} labels={labels} />}

        {view === 'sellerOverview' && <section className="market-admin-stats">
          {Object.entries(sellerDashboardQuery.data || {}).map(([key, value]) => <article key={key}><span>{labels[key] || key}</span><strong>{value}</strong></article>)}
        </section>}

        {view === 'sell' && <section className="market-panel">
          <h1>{labels.sellerProfile}</h1>
          <form className="market-form-grid" onSubmit={saveSellerProfile}>
                    {[['businessName', labels.businessName], ['description', labels.businessDescription], ['state', labels.state], ['district', labels.district], ['mandal', labels.mandal], ['village', labels.village], ['pinCode', labels.pinCode], ['licenseNumber', labels.license]].map(([key, label]) => <label key={key}>{label}<input required={['businessName', 'state', 'district'].includes(key)} value={sellerForm[key] || ''} onChange={(event) => setSellerForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
            <div className="market-form-wide"><button className="market-button market-button--primary" type="submit" disabled={busy}>{labels.saveProfile}</button>{sellerProfileQuery.data?.verificationStatus && <span className="market-status">{sellerProfileQuery.data.verificationStatus}</span>}</div>
          </form>
          <h2>{editingProduct ? labels.edit : labels.createListing}</h2><p className="market-muted">{labels.listingNote}</p>
          <form className="market-form-grid" onSubmit={submitListing}>
            <label>{labels.name}<input required value={searchForm.productName} onChange={(event) => setSearchForm((current) => ({ ...current, productName: event.target.value }))} /></label>
            <label>{labels.category}<select required value={searchForm.categoryId} onChange={(event) => setSearchForm((current) => ({ ...current, categoryId: event.target.value }))}><option value="">—</option>{categories.map((item) => <option value={item.id} key={item.id}>{categoryName(item, lang)}</option>)}</select></label>
            <label>{labels.price}<input required type="number" min="0.01" step="0.01" value={searchForm.price} onChange={(event) => setSearchForm((current) => ({ ...current, price: event.target.value }))} /></label>
            <label>{labels.unit}<input required value={searchForm.unit} onChange={(event) => setSearchForm((current) => ({ ...current, unit: event.target.value }))} placeholder="kg, bag, piece" /></label>
            <label>{labels.stock}<input required type="number" min="0" step="0.001" value={searchForm.availableQuantity} onChange={(event) => setSearchForm((current) => ({ ...current, availableQuantity: event.target.value }))} /></label>
            <label>{labels.minOrder}<input required type="number" min="0.001" step="0.001" value={searchForm.minOrderQuantity} onChange={(event) => setSearchForm((current) => ({ ...current, minOrderQuantity: event.target.value }))} /></label>
            <label>{labels.brand}<input value={searchForm.brand} onChange={(event) => setSearchForm((current) => ({ ...current, brand: event.target.value }))} /></label>
            <label>{labels.description}<textarea required value={searchForm.description} onChange={(event) => setSearchForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label>{labels.safety}<textarea value={searchForm.safetyInformation} onChange={(event) => setSearchForm((current) => ({ ...current, safetyInformation: event.target.value }))} /></label>
            <label>{labels.pickupLocation}<input value={searchForm.pickupLocation || ''} onChange={(event) => setSearchForm((current) => ({ ...current, pickupLocation: event.target.value }))} /></label>
            <label className="market-checkbox"><input type="checkbox" checked={searchForm.deliveryAvailable} onChange={(event) => setSearchForm((current) => ({ ...current, deliveryAvailable: event.target.checked }))} />{labels.delivery}</label>
            <label className="market-checkbox"><input type="checkbox" checked={searchForm.pickupAvailable} onChange={(event) => setSearchForm((current) => ({ ...current, pickupAvailable: event.target.checked }))} />{labels.pickup}</label>
            <label>{labels.images}<input required={!editingProduct} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setSearchForm((current) => ({ ...current, images: Array.from(event.target.files || []).slice(0, 5) }))} /></label>
            <div className="market-form-wide"><button className="market-button market-button--primary" type="submit" disabled={busy}>{editingProduct ? labels.saveChanges : labels.createListing}</button>{editingProduct && <button className="market-button market-button--quiet" type="button" onClick={() => { setEditingProduct(null); setView('listings'); }}>{labels.remove}</button>}</div>
          </form>
        </section>}

        {view === 'listings' && <section className="market-listings">{sellerProducts.length === 0 ? <p className="market-empty">{labels.noListings}</p> : sellerProducts.map((product) => <article className="market-order" key={product.id}>
          <header><div><strong>{product.productName}</strong><small>{categoryName(product.category, lang)} · ₹{Number(product.price).toLocaleString()} / {product.unit}</small></div><span className="market-status">{product.status === 'pending' ? labels.pending : product.status === 'rejected' ? labels.rejected : product.status}</span></header>
          {product.rejectionReason && <p className="market-warning">{product.rejectionReason}</p>}
          <div className="market-admin-actions">
            <button className="market-button market-button--quiet" type="button" onClick={() => editListing(product)}>{labels.edit}</button>
            {(product.images || []).map((image) => <button className="market-button market-button--quiet" type="button" key={image.id} onClick={() => runAction(() => api.delete(`/marketplace/seller/products/${product.id}/images/${image.id}`), labels.remove)}>{labels.remove} image</button>)}
          </div>
          <button className="market-button market-button--quiet" type="button" onClick={() => runAction(() => api.delete(`/marketplace/seller/products/${product.id}`), labels.remove)}>{labels.remove}</button>
        </article>)}</section>}
        {view === 'listings' && <Pagination pagination={sellerProductsQuery.data?.pagination} page={page} onChange={setPage} labels={labels} />}

        {view === 'sellerOrders' && <section className="market-order-list">{sellerOrders.length === 0 ? <p className="market-empty">{labels.noOrders}</p> : sellerOrders.map((order) => <article className="market-order" key={order.id}>
          <header><div><strong>#{order.id.slice(0, 8)}</strong><small>₹{Number(order.total).toLocaleString()} · {order.paymentMethod}</small></div><span className="market-status">{order.status}</span></header>
          <p>{order.MarketplaceAddress?.recipientName} · {order.MarketplaceAddress?.phone} · {order.MarketplaceAddress?.addressLine1}</p>
          {(order.MarketplaceOrderItems || []).map((item) => <p key={item.id}>{item.productName} · {item.quantity} {item.unit} · {item.fulfillmentMethod === 'pickup' ? `${labels.pickup}${item.pickupLocation ? `: ${item.pickupLocation}` : ''}` : labels.delivery}</p>)}
          {({ pending: ['confirmed', 'rejected'], confirmed: ['processing', 'rejected'], processing: ['packed'], packed: ['shipped'] }[order.status] || []).map((status) => <button key={status} className="market-button market-button--quiet" type="button" onClick={() => runAction(() => api.put(`/marketplace/seller/orders/${order.id}/status`, { status }), labels.update)}>{status}</button>)}
        </article>)}</section>}
        {view === 'sellerOrders' && <Pagination pagination={sellerOrdersQuery.data?.pagination} page={page} onChange={setPage} labels={labels} />}

        {view === 'enquiries' && <section className="market-order-list">{enquiries.length === 0 ? <p className="market-empty">{labels.noEnquiries}</p> : enquiries.map((enquiry) => <article className="market-order" key={enquiry.id}>
          <header><div><strong>{enquiry.MarketplaceProduct?.productName}</strong><small>{enquiry.status}</small></div></header>
          <p>{enquiry.question}</p>{enquiry.reply && <p className="market-notice">{enquiry.reply}</p>}
          {enquiry.status !== 'closed' && <div className="market-inline-reply"><input placeholder={labels.reply} value={reply[enquiry.id] || ''} onChange={(event) => setReply((current) => ({ ...current, [enquiry.id]: event.target.value }))} /><button type="button" onClick={() => submitReply(enquiry.id)}>{labels.update}</button></div>}
        </article>)}</section>}
        {view === 'enquiries' && <Pagination pagination={enquiriesQuery.data?.pagination} page={page} onChange={setPage} labels={labels} />}
      </section>

      {selected && <div className="market-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="market-modal" role="dialog" aria-modal="true" aria-labelledby="market-detail-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="market-modal__close" onClick={() => setSelected(null)} aria-label="Close">×</button>
        {selected.images?.[0]?.imageUrl && <img className="market-modal__image" src={selected.images[0].imageUrl} alt={selected.productName} />}
        <h2 id="market-detail-title">{selected.productName}</h2><p className="market-price">₹{Number(selected.price).toLocaleString()} / {selected.unit}</p><p>{selected.description}</p>
        <p className="market-muted">{selected.seller?.businessName} {selected.seller?.isVerified ? `· ${labels.verified}` : ''}</p>
        {selected.safetyInformation && <p className="market-warning">{selected.safetyInformation}</p>}
        <p className="market-muted">{labels.location}: {[selected.location?.village, selected.location?.district, selected.location?.state].filter(Boolean).join(', ')}</p>
        <button type="button" className="market-button market-button--primary" disabled={busy || selected.availability !== 'available'} onClick={() => runAction(() => api.post('/marketplace/cart/items', { productId: selected.id, quantity: Number(selected.minOrderQuantity) }), labels.addCart)}>{labels.addCart}</button>
        <form className="market-enquiry-form" onSubmit={(event) => { event.preventDefault(); runAction(async () => { await api.post('/marketplace/enquiries', { productId: selected.id, question: enquiryText }); setEnquiryText(''); }, labels.update); }}>
          <label>{labels.question}<textarea required maxLength={2000} value={enquiryText} onChange={(event) => setEnquiryText(event.target.value)} /></label><button className="market-button market-button--quiet" type="submit">{labels.update}</button>
        </form>
        <button type="button" className="market-link-button" onClick={() => runAction(() => api.post(`/marketplace/products/${selected.id}/report`, { reason: 'other', description: 'Reported by marketplace user' }), labels.report)}>{labels.report}</button>
      </section></div>}
    </main>
  );
}
