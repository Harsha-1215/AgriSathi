import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, ShieldAlert, ShieldCheck } from 'lucide-react';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/livestock.css';

function getError(error) {
  return error?.response?.data?.message || 'The livestock administration request failed.';
}

function pageData(response) {
  const body = response?.data || {};
  return { items: Array.isArray(body.data) ? body.data : [], pagination: body.pagination };
}

export default function LivestockAdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('listings');
  const [listingStatus, setListingStatus] = useState('pending');
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', icon: 'beef', te: '', hi: '' });
  const [breedForm, setBreedForm] = useState({ categoryId: '', name: '', slug: '', te: '', hi: '' });
  const [rejectNotes, setRejectNotes] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const dashboard = useQuery({ queryKey: ['livestock-admin', 'dashboard'], queryFn: async () => unwrapPayload(await api.get('/admin/livestock/dashboard')), retry: false });
  const listings = useQuery({ queryKey: ['livestock-admin', 'listings', listingStatus], queryFn: async () => pageData(await api.get('/admin/livestock', { params: { status: listingStatus, limit: 50 } })), enabled: tab === 'listings', retry: false });
  const categories = useQuery({ queryKey: ['livestock-admin', 'categories'], queryFn: async () => unwrapPayload(await api.get('/admin/livestock/categories')), enabled: tab === 'categories', retry: false });
  const breeds = useQuery({ queryKey: ['livestock-admin', 'breeds'], queryFn: async () => unwrapPayload(await api.get('/admin/livestock/breeds')), enabled: tab === 'categories', retry: false });
  const sellers = useQuery({ queryKey: ['livestock-admin', 'sellers'], queryFn: async () => pageData(await api.get('/admin/livestock/sellers', { params: { limit: 50 } })), enabled: tab === 'sellers', retry: false });
  const reports = useQuery({ queryKey: ['livestock-admin', 'reports'], queryFn: async () => pageData(await api.get('/admin/livestock/reports', { params: { status: 'open', limit: 50 } })), enabled: tab === 'reports', retry: false });
  const audit = useQuery({ queryKey: ['livestock-admin', 'audit'], queryFn: async () => pageData(await api.get('/admin/livestock/audit', { params: { limit: 50 } })), enabled: tab === 'audit', retry: false });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['livestock-admin'] });
    setNotice('Livestock marketplace settings updated.');
    setError('');
  };
  const action = useMutation({
    mutationFn: ({ method, path, data }) => api[method](path, data),
    onSuccess: invalidate,
    onError: (reason) => setError(getError(reason)),
  });
  const submitCategory = (event) => {
    event.preventDefault();
    action.mutate({
      method: 'post',
      path: '/admin/livestock/categories',
      data: { name: categoryForm.name, slug: categoryForm.slug, icon: categoryForm.icon, translations: { en: categoryForm.name, te: categoryForm.te, hi: categoryForm.hi } },
    });
    setCategoryForm({ name: '', slug: '', icon: 'beef', te: '', hi: '' });
  };
  const submitBreed = (event) => {
    event.preventDefault();
    action.mutate({
      method: 'post',
      path: '/admin/livestock/breeds',
      data: { categoryId: breedForm.categoryId, name: breedForm.name, slug: breedForm.slug, translations: { en: breedForm.name, te: breedForm.te, hi: breedForm.hi } },
    });
    setBreedForm({ categoryId: '', name: '', slug: '', te: '', hi: '' });
  };
  const toggleCatalog = (type, item) => {
    const path = type === 'category' ? `/admin/livestock/categories/${item.id}` : `/admin/livestock/breeds/${item.id}`;
    action.mutate({ method: 'put', path, data: { isActive: !item.isActive } });
  };
  const updateSeller = (seller, updates) => action.mutate({
    method: 'put',
    path: `/admin/livestock/sellers/${encodeURIComponent(seller.userId)}/status`,
    data: updates,
  });

  return (
    <div className="livestock-page">
      <header className="livestock-header">
        <div className="livestock-brand"><Link to="/admin"><Logo size="small" /></Link><span><strong>Livestock Marketplace Admin</strong><small>Listings, seller verification, and safety reports</small></span></div>
        <Link className="livestock-header__back" to="/admin"><ArrowLeft size={17} />Admin dashboard</Link>
      </header>
      <main className="livestock-main">
        <div className="livestock-hero">
          <div><p className="livestock-eyebrow"><ShieldCheck size={17} />AGRISATHI ADMIN</p><h1>Livestock marketplace</h1><p>Review seller-provided information and manage listing safety.</p></div>
        </div>
        {error && <p className="livestock-alert livestock-alert--error" role="alert">{error}<button type="button" onClick={() => setError('')}>×</button></p>}
        {notice && <p className="livestock-alert livestock-alert--success" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></p>}
        {dashboard.isPending ? <p className="livestock-state" role="status">Loading administration dashboard…</p>
          : dashboard.isError ? <p className="livestock-state livestock-state--error" role="alert">{getError(dashboard.error)}</p>
            : <div className="livestock-stats">
              <article><span>Pending listings</span><strong>{dashboard.data.pendingListings}</strong></article>
              <article><span>Active listings</span><strong>{dashboard.data.activeListings}</strong></article>
              <article><span>Open reports</span><strong>{dashboard.data.openReports}</strong></article>
              <article><span>Pending sellers</span><strong>{dashboard.data.pendingSellers}</strong></article>
              <article><span>Total listings</span><strong>{dashboard.data.totalListings}</strong></article>
              <article><span>Enquiries</span><strong>{dashboard.data.enquiries}</strong></article>
            </div>}
        <nav className="livestock-tabs" aria-label="Livestock administration">
          {['listings', 'categories', 'sellers', 'reports', 'audit'].map((item) => <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </nav>

        {tab === 'listings' && (
          <section className="livestock-admin-section">
            <label className="livestock-admin-field">Listing status
              <select value={listingStatus} onChange={(event) => setListingStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select>
            </label>
            {listings.isPending ? <p className="livestock-state">Loading listings…</p>
              : listings.isError ? <p className="livestock-state livestock-state--error">{getError(listings.error)}</p>
                : listings.data.items.length ? <div className="livestock-admin-list">{listings.data.items.map((listing) => (
                  <article className="livestock-admin-card" key={listing.id}>
                    <div className="livestock-admin-card__media">{listing.images?.[0]?.url ? <img src={listing.images[0].url} alt={listing.listingName} /> : <span>Photo unavailable</span>}</div>
                    <div className="livestock-admin-card__content">
                      <p className="livestock-eyebrow">{listing.category?.name}{listing.breed ? ` · ${listing.breed.name}` : ''}</p>
                      <h2>{listing.listingName} · ₹{Number(listing.price).toLocaleString()}</h2>
                      <p>{listing.ageMonths} months · {listing.gender} · {listing.location?.district}, {listing.location?.state}</p>
                      <p><strong>Seller-reported health:</strong> {listing.healthCondition}; vaccination: {listing.vaccinationStatus}</p>
                      <p><strong>Seller:</strong> {listing.seller?.name} · {listing.seller?.verificationStatus} {listing.seller?.isVerified && <BadgeCheck size={16} />}</p>
                      <p>{listing.description}</p>
                      {listing.rejectionReason && <p className="livestock-alert livestock-alert--error">{listing.rejectionReason}</p>}
                      {listing.status === 'pending' && <div className="livestock-admin-actions">
                        <button type="button" className="livestock-button livestock-button--primary" disabled={action.isPending} onClick={() => action.mutate({ method: 'put', path: `/admin/livestock/${listing.id}/approve`, data: {} })}>Approve</button>
                        <input aria-label="Rejection reason" placeholder="Reason required to reject" value={rejectNotes[listing.id] || ''} onChange={(event) => setRejectNotes({ ...rejectNotes, [listing.id]: event.target.value })} />
                        <button type="button" className="livestock-button" disabled={action.isPending || !rejectNotes[listing.id]?.trim()} onClick={() => action.mutate({ method: 'put', path: `/admin/livestock/${listing.id}/reject`, data: { reason: rejectNotes[listing.id] } })}>Reject</button>
                      </div>}
                    </div>
                  </article>
                ))}</div> : <p className="livestock-state">No listings match this status.</p>}
          </section>
        )}

        {tab === 'categories' && (
          <section className="livestock-admin-catalog">
            <form className="livestock-panel livestock-admin-form" onSubmit={submitCategory}>
              <h2>Add livestock category</h2>
              <label className="livestock-admin-field">English name<input required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
              <label className="livestock-admin-field">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} /></label>
              <label className="livestock-admin-field">Icon key<input value={categoryForm.icon} onChange={(event) => setCategoryForm({ ...categoryForm, icon: event.target.value })} /></label>
              <label className="livestock-admin-field">Telugu<input value={categoryForm.te} onChange={(event) => setCategoryForm({ ...categoryForm, te: event.target.value })} /></label>
              <label className="livestock-admin-field">Hindi<input value={categoryForm.hi} onChange={(event) => setCategoryForm({ ...categoryForm, hi: event.target.value })} /></label>
              <button className="livestock-button livestock-button--primary" disabled={action.isPending}>Add category</button>
            </form>
            <form className="livestock-panel livestock-admin-form" onSubmit={submitBreed}>
              <h2>Add breed</h2>
              <label className="livestock-admin-field">Category<select required value={breedForm.categoryId} onChange={(event) => setBreedForm({ ...breedForm, categoryId: event.target.value })}><option value="">Choose category</option>{(categories.data || []).filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="livestock-admin-field">English name<input required value={breedForm.name} onChange={(event) => setBreedForm({ ...breedForm, name: event.target.value })} /></label>
              <label className="livestock-admin-field">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={breedForm.slug} onChange={(event) => setBreedForm({ ...breedForm, slug: event.target.value })} /></label>
              <label className="livestock-admin-field">Telugu<input value={breedForm.te} onChange={(event) => setBreedForm({ ...breedForm, te: event.target.value })} /></label>
              <label className="livestock-admin-field">Hindi<input value={breedForm.hi} onChange={(event) => setBreedForm({ ...breedForm, hi: event.target.value })} /></label>
              <button className="livestock-button livestock-button--primary" disabled={action.isPending}>Add breed</button>
            </form>
            {categories.isPending || breeds.isPending ? <p className="livestock-state">Loading categories…</p>
              : categories.isError || breeds.isError ? <p className="livestock-state livestock-state--error">{getError(categories.error || breeds.error)}</p>
                : <div className="livestock-admin-list">{(categories.data || []).map((category) => (
                  <article className="livestock-admin-card livestock-admin-card--catalog" key={category.id}>
                    <div><h2>{category.name}</h2><p>{category.slug} · {category.isActive ? 'Active' : 'Inactive'}</p><p>{category.translations?.te} · {category.translations?.hi}</p></div>
                    <button className="livestock-button" type="button" onClick={() => toggleCatalog('category', category)}>{category.isActive ? 'Deactivate' : 'Activate'}</button>
                    <div className="livestock-admin-breeds">{(breeds.data || []).filter((breed) => breed.categoryId === category.id).map((breed) => <span key={breed.id}>{breed.name} · {breed.isActive ? 'Active' : 'Inactive'} <button type="button" onClick={() => toggleCatalog('breed', breed)}>{breed.isActive ? 'Deactivate' : 'Activate'}</button></span>)}</div>
                  </article>
                ))}</div>}
          </section>
        )}

        {tab === 'sellers' && (sellers.isPending ? <p className="livestock-state">Loading sellers…</p>
          : sellers.isError ? <p className="livestock-state livestock-state--error">{getError(sellers.error)}</p>
            : sellers.data.items.map((seller) => (
              <article className="livestock-panel livestock-admin-seller" key={seller.userId}>
                <div><h2>{seller.sellerName} {seller.verificationStatus === 'verified' && <BadgeCheck size={17} />}</h2><p>{seller.district}, {seller.state} · {seller.contactPhone || 'No contact number'}</p><p>{seller.verificationStatus} · {seller.isSuspended ? 'Suspended' : 'Active'}</p>{seller.verificationNote && <p>{seller.verificationNote}</p>}</div>
                <div className="livestock-admin-actions">
                  <button type="button" className="livestock-button livestock-button--primary" onClick={() => updateSeller(seller, { verificationStatus: 'verified', verificationNote: '' })}>Verify</button>
                  <button type="button" className="livestock-button" onClick={() => updateSeller(seller, { verificationStatus: 'rejected', verificationNote: 'Seller verification was not approved.' })}>Reject verification</button>
                  <button type="button" className="livestock-button" onClick={() => updateSeller(seller, { isSuspended: !seller.isSuspended })}><ShieldAlert size={16} />{seller.isSuspended ? 'Unsuspend' : 'Suspend'}</button>
                </div>
              </article>
            )))}

        {tab === 'reports' && (reports.isPending ? <p className="livestock-state">Loading reports…</p>
          : reports.isError ? <p className="livestock-state livestock-state--error">{getError(reports.error)}</p>
            : reports.data.items.length ? reports.data.items.map((report) => (
              <article className="livestock-panel livestock-admin-report" key={report.id}>
                <h2>{report.reason} · {report.LivestockListing?.listingName || 'Listing removed'}</h2>
                <p>{report.description || 'No additional details.'}</p>
                <div className="livestock-admin-actions">
                  <button type="button" className="livestock-button" onClick={() => action.mutate({ method: 'put', path: `/admin/livestock/reports/${report.id}`, data: { status: 'dismissed', adminNote: 'Reviewed; no action required.' } })}>Dismiss</button>
                  <button type="button" className="livestock-button livestock-button--primary" onClick={() => action.mutate({ method: 'put', path: `/admin/livestock/reports/${report.id}`, data: { status: 'action_taken', adminNote: 'Listing removed after report review.' } })}>Remove listing</button>
                </div>
              </article>
            )) : <p className="livestock-state">No open reports.</p>)}

        {tab === 'audit' && (audit.isPending ? <p className="livestock-state">Loading audit log…</p>
          : audit.isError ? <p className="livestock-state livestock-state--error">{getError(audit.error)}</p>
            : audit.data.items.length ? <div className="livestock-admin-list">{audit.data.items.map((entry) => <article className="livestock-panel" key={entry.id}><strong>{entry.action} · {entry.entityType}</strong><p>{entry.entityId} · {new Date(entry.createdAt).toLocaleString()}</p><pre>{JSON.stringify(entry.details, null, 2)}</pre></article>)}</div>
              : <p className="livestock-state">No administrative actions recorded yet.</p>)}
      </main>
    </div>
  );
}
