import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, ClipboardList, Flag, PackageCheck, Star, Store } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/marketplace.css';

const text = {
  en: { title: 'Marketplace administration', back: 'Admin dashboard', dashboard: 'Overview', products: 'Listings', sellers: 'Sellers', reports: 'Reports', reviews: 'Reviews', categories: 'Categories', orders: 'Orders', audit: 'Audit log', loadError: 'Could not load marketplace administration data.', retry: 'Try again', empty: 'Nothing requires review.', approve: 'Approve', reject: 'Reject', verify: 'Verify seller', dismiss: 'Dismiss report', hide: 'Review and hide listing', pending: 'Pending', verified: 'Verified', rejected: 'Rejected', all: 'All', business: 'Business', license: 'License', reason: 'Reason', name: 'Category name', slug: 'Slug', icon: 'Icon', add: 'Add category', update: 'Update', counts: 'Moderation queue', saleNote: 'Payment total includes only gateway payments with verified signatures. Delivered order value may include unpaid cash-on-delivery orders.', payment: 'Verified online payment total', delivered: 'Delivered order value' },
  te: { title: 'మార్కెట్ నిర్వహణ', back: 'అడ్మిన్ డాష్‌బోర్డ్', dashboard: 'సారాంశం', products: 'ప్రకటనలు', sellers: 'విక్రేతలు', reports: 'నివేదికలు', reviews: 'సమీక్షలు', categories: 'వర్గాలు', orders: 'ఆర్డర్లు', audit: 'ఆడిట్ లాగ్', loadError: 'మార్కెట్ నిర్వహణ సమాచారం లోడ్ కాలేదు.', retry: 'మళ్లీ ప్రయత్నించండి', empty: 'సమీక్షించాల్సినవి లేవు.', approve: 'ఆమోదించండి', reject: 'తిరస్కరించండి', verify: 'విక్రేతను ధృవీకరించండి', dismiss: 'నివేదికను మూసివేయండి', hide: 'సమీక్షించి ప్రకటనను దాచండి', pending: 'పెండింగ్', verified: 'ధృవీకరించారు', rejected: 'తిరస్కరించారు', all: 'అన్నీ', business: 'వ్యాపారం', license: 'లైసెన్స్', reason: 'కారణం', name: 'వర్గం పేరు', slug: 'స్లగ్', icon: 'ఐకాన్', add: 'వర్గాన్ని చేర్చండి', update: 'నవీకరించండి', counts: 'సమీక్షల జాబితా', saleNote: 'చెల్లింపు మొత్తంలో సంతకం ధృవీకరించిన గేట్‌వే చెల్లింపులే ఉంటాయి. చేరిన ఆర్డర్ విలువలో చెల్లించని COD ఉండవచ్చు.', payment: 'ధృవీకరించిన ఆన్‌లైన్ చెల్లింపు', delivered: 'చేరిన ఆర్డర్ విలువ' },
  hi: { title: 'बाज़ार प्रशासन', back: 'एडमिन डैशबोर्ड', dashboard: 'अवलोकन', products: 'लिस्टिंग', sellers: 'विक्रेता', reports: 'रिपोर्ट', reviews: 'समीक्षाएँ', categories: 'श्रेणियाँ', orders: 'ऑर्डर', audit: 'ऑडिट लॉग', loadError: 'बाज़ार प्रशासन डेटा लोड नहीं हुआ।', retry: 'फिर प्रयास करें', empty: 'समीक्षा के लिए कुछ नहीं है।', approve: 'स्वीकृत करें', reject: 'अस्वीकृत करें', verify: 'विक्रेता सत्यापित करें', dismiss: 'रिपोर्ट बंद करें', hide: 'समीक्षा कर लिस्टिंग छिपाएँ', pending: 'लंबित', verified: 'सत्यापित', rejected: 'अस्वीकृत', all: 'सभी', business: 'व्यवसाय', license: 'लाइसेंस', reason: 'कारण', name: 'श्रेणी का नाम', slug: 'स्लग', icon: 'आइकन', add: 'श्रेणी जोड़ें', update: 'अपडेट करें', counts: 'मॉडरेशन कतार', saleNote: 'भुगतान कुल में केवल हस्ताक्षर-सत्यापित गेटवे भुगतान शामिल हैं। डिलीवर ऑर्डर मूल्य में COD शामिल हो सकता है जिसका भुगतान अभी नहीं हुआ।', payment: 'सत्यापित ऑनलाइन भुगतान', delivered: 'डिलीवर ऑर्डर मूल्य' },
};

function payload(response) {
  return unwrapPayload(response);
}

export default function MarketplaceAdminPage() {
  const { lang } = useLanguage();
  const labels = text[lang] || text.en;
  const client = useQueryClient();
  const [view, setView] = useState('dashboard');
  const [sellerStatus, setSellerStatus] = useState('pending');
  const [notice, setNotice] = useState('');
  const [category, setCategory] = useState({ name: '', slug: '', icon: 'package' });
  const queueQuery = useQuery({
    queryKey: ['marketplace-admin', view, sellerStatus],
    queryFn: async () => {
      if (view === 'dashboard') return payload(await api.get('/admin/marketplace/dashboard'));
      if (view === 'products') return payload(await api.get('/admin/marketplace/products', { params: { status: 'pending' } }));
      if (view === 'sellers') return payload(await api.get('/admin/marketplace/sellers', { params: { status: sellerStatus || undefined } }));
      if (view === 'reports') return payload(await api.get('/admin/marketplace/reports', { params: { status: 'open' } }));
      if (view === 'reviews') return payload(await api.get('/admin/marketplace/reviews', { params: { status: 'pending' } }));
      if (view === 'orders') return payload(await api.get('/admin/marketplace/orders'));
      if (view === 'audit') return payload(await api.get('/admin/marketplace/audit-logs'));
      return payload(await api.get('/admin/marketplace/categories'));
    },
    retry: false,
  });

  async function act(action, message) {
    setNotice('');
    try {
      await action();
      setNotice(message);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['marketplace-admin'] }),
        client.invalidateQueries({ queryKey: ['marketplace'] }),
      ]);
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.loadError);
    }
  }

  const rows = queueQuery.data?.items || queueQuery.data || [];

  return (
    <main className="marketplace-page">
      <header className="marketplace-header">
        <div className="marketplace-header__brand"><Link to="/"><Logo size="small" /></Link><span><strong>{labels.title}</strong></span></div>
        <div className="marketplace-header__actions"><ModuleLanguageSelector /><Link to="/admin/crop-knowledge" className="market-back"><ArrowLeft size={17} />{labels.back}</Link></div>
      </header>
      <section className="marketplace-main">
        <nav className="market-tabs" aria-label={labels.title}>
          {[['dashboard', labels.dashboard, ClipboardList], ['products', labels.products, PackageCheck], ['sellers', labels.sellers, Store], ['reports', labels.reports, Flag], ['reviews', labels.reviews, Star], ['orders', labels.orders, PackageCheck], ['audit', labels.audit, ClipboardList], ['categories', labels.categories, BadgeCheck]].map(([key, title, Icon]) => <button type="button" className={view === key ? 'is-active' : ''} key={key} onClick={() => setView(key)}><Icon size={18} />{title}</button>)}
        </nav>
        {notice && <p className="market-notice" role="status">{notice}</p>}
        {queueQuery.isError && <p className="market-error" role="alert">{labels.loadError} <button type="button" onClick={() => queueQuery.refetch()}>{labels.retry}</button></p>}
        {queueQuery.isPending && <p className="market-loading" role="status">{labels.pending}…</p>}
        {!queueQuery.isPending && !queueQuery.isError && view === 'dashboard' && <section className="market-admin-stats">
          {Object.entries({ [labels.products]: rows.pendingListings, [labels.reports]: rows.openReports, [labels.reviews]: rows.pendingReviews, [labels.sellers]: rows.pendingSellers, [labels.orders]: rows.orders, [labels.payment]: `₹${Number(rows.verifiedOnlinePaymentTotal || 0).toLocaleString()}`, [labels.delivered]: `₹${Number(rows.deliveredOrderValue || 0).toLocaleString()}` }).map(([label, value]) => <article key={label}><span>{label}</span><strong>{value ?? 0}</strong></article>)}
          <p className="market-warning">{labels.saleNote}</p>
        </section>}
        {!queueQuery.isPending && !queueQuery.isError && ['products', 'sellers', 'reports', 'reviews'].includes(view) && rows.length === 0 && <p className="market-empty">{labels.empty}</p>}
        {!queueQuery.isPending && view === 'products' && <section className="market-admin-list">{rows.map((product) => <article className="market-order" key={product.id}>
          <header><div><strong>{product.productName}</strong><small>{product.category?.name} · ₹{Number(product.price).toLocaleString()} / {product.unit}</small></div><span className="market-status">{product.status}</span></header>
          <p>{product.description}</p><p>{product.seller?.businessName} · {product.seller?.verificationStatus}</p>
          {product.regulatedProduct && <p className="market-warning">{labels.license}: {product.seller?.licenseNumber || '—'} · {product.safetyInformation || 'Safety information missing'}</p>}
          <div className="market-admin-actions">
            <button type="button" className="market-button market-button--primary" onClick={() => act(() => api.put(`/admin/marketplace/products/${product.id}/moderation`, { status: 'approved' }), labels.approve)}>{labels.approve}</button>
            <button type="button" className="market-button market-button--quiet" onClick={() => act(() => api.put(`/admin/marketplace/products/${product.id}/moderation`, { status: 'rejected', reason: 'Please update the listing to meet marketplace requirements.' }), labels.reject)}>{labels.reject}</button>
          </div>
        </article>)}</section>}
        {!queueQuery.isPending && view === 'sellers' && <section className="market-admin-list">
          <label className="market-admin-filter">{labels.sellers}<select value={sellerStatus} onChange={(event) => setSellerStatus(event.target.value)}><option value="">{labels.all}</option><option value="pending">{labels.pending}</option><option value="verified">{labels.verified}</option><option value="rejected">{labels.rejected}</option></select></label>
          {rows.map((seller) => <article className="market-order" key={seller.userId}>
          <header><div><strong>{seller.businessName}</strong><small>{seller.state}, {seller.district}</small></div><span className="market-status">{seller.verificationStatus}</span></header>
          <p>{seller.description}</p><p>{labels.license}: {seller.licenseNumber || '—'}</p>
          <div className="market-admin-actions">
            <button type="button" className="market-button market-button--primary" disabled={!seller.licenseNumber} onClick={() => act(() => api.put(`/admin/marketplace/sellers/${seller.userId}/verification`, { status: 'verified', note: 'Reviewed by marketplace administrator.' }), labels.verify)}>{labels.verify}</button>
            <button type="button" className="market-button market-button--quiet" onClick={() => act(() => api.put(`/admin/marketplace/sellers/${seller.userId}/verification`, { status: 'rejected', note: 'Seller verification was not approved.' }), labels.reject)}>{labels.reject}</button>
            <button type="button" className="market-button market-button--quiet" onClick={() => act(() => api.put(`/admin/marketplace/sellers/${seller.userId}/verification`, { status: 'pending', note: 'Seller verification requires another review.' }), labels.pending)}>{labels.pending}</button>
          </div>
        </article>)}
        </section>}
        {!queueQuery.isPending && view === 'reports' && <section className="market-admin-list">{rows.map((report) => <article className="market-order" key={report.id}>
          <header><div><strong>{report.MarketplaceProduct?.productName}</strong><small>{report.reason}</small></div><span className="market-status">{report.status}</span></header>
          <p>{report.description}</p><div className="market-admin-actions">
            <button type="button" className="market-button market-button--primary" onClick={() => act(() => api.put(`/admin/marketplace/reports/${report.id}`, { status: 'reviewed', hideProduct: true }), labels.hide)}>{labels.hide}</button>
            <button type="button" className="market-button market-button--quiet" onClick={() => act(() => api.put(`/admin/marketplace/reports/${report.id}`, { status: 'dismissed' }), labels.dismiss)}>{labels.dismiss}</button>
          </div>
        </article>)}</section>}
        {!queueQuery.isPending && view === 'reviews' && <section className="market-admin-list">{rows.map((review) => <article className="market-order" key={review.id}>
          <header><div><strong>{review.MarketplaceProduct?.productName}</strong><small>{review.rating} ★ · verified purchase: {String(review.verifiedPurchase)}</small></div><span className="market-status">{review.status}</span></header>
          <p>{review.review}</p>
          <div className="market-admin-actions"><button type="button" className="market-button market-button--primary" onClick={() => act(() => api.put(`/admin/marketplace/reviews/${review.id}/moderation`, { status: 'approved' }), labels.approve)}>{labels.approve}</button><button type="button" className="market-button market-button--quiet" onClick={() => act(() => api.put(`/admin/marketplace/reviews/${review.id}/moderation`, { status: 'hidden', note: 'Hidden by administrator.' }), labels.reject)}>{labels.reject}</button></div>
        </article>)}</section>}
        {!queueQuery.isPending && view === 'orders' && <section className="market-admin-list">{rows.length === 0 ? <p className="market-empty">{labels.empty}</p> : rows.map((order) => <article className="market-order" key={order.id}>
          <header><div><strong>#{order.id.slice(0, 8)}</strong><small>{order.paymentMethod} · {order.paymentStatus}</small></div><span className="market-status">{order.status}</span></header>
          <p>₹{Number(order.total).toLocaleString()} · Buyer {order.buyerId} · Seller {order.sellerId}</p>
          {(order.MarketplaceOrderItems || []).map((item) => <p key={item.id}>{item.productName} · {item.quantity} {item.unit}</p>)}
        </article>)}</section>}
        {!queueQuery.isPending && view === 'audit' && <section className="market-admin-list">{rows.length === 0 ? <p className="market-empty">{labels.empty}</p> : rows.map((entry) => <article className="market-order" key={entry.id}>
          <header><div><strong>{entry.action} · {entry.entityType}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></div><span className="market-status">{entry.adminId}</span></header>
          <p>{entry.entityId}</p><pre>{JSON.stringify(entry.details, null, 2)}</pre>
        </article>)}</section>}
        {!queueQuery.isPending && view === 'categories' && <section className="market-panel">
          <form className="market-form-grid" onSubmit={(event) => { event.preventDefault(); act(async () => { await api.post('/admin/marketplace/categories', category); setCategory({ name: '', slug: '', icon: 'package' }); }, labels.add); }}>
            <label>{labels.name}<input required value={category.name} onChange={(event) => setCategory((value) => ({ ...value, name: event.target.value }))} /></label>
            <label>{labels.slug}<input required value={category.slug} onChange={(event) => setCategory((value) => ({ ...value, slug: event.target.value }))} /></label>
            <label>{labels.icon}<input value={category.icon} onChange={(event) => setCategory((value) => ({ ...value, icon: event.target.value }))} /></label>
            <div className="market-form-wide"><button className="market-button market-button--primary" type="submit">{labels.add}</button></div>
          </form>
          {(rows || []).map((item) => <div className="market-category-row" key={item.id}><strong>{item.name}</strong><code>{item.slug}</code><span>{item.isActive ? 'Active' : 'Inactive'}</span><button type="button" onClick={() => act(() => api.put(`/admin/marketplace/categories/${item.id}`, { isActive: !item.isActive }), labels.update)}>{item.isActive ? 'Disable' : 'Enable'}</button></div>)}
        </section>}
      </section>
    </main>
  );
}
