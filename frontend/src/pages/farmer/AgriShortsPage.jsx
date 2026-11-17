import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Clock3, Eye, Heart, MessageCircle, Play, Search, Share2, ShieldAlert, Upload, Video, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Logo from '../../components/common/Logo';
import ModuleLanguageSelector from '../../components/common/ModuleLanguageSelector';
import api from '../../services/api';
import { unwrapPayload } from '../../services/authService';
import '../../styles/platform-modules.css';

const copy = {
  en: {
    title: 'Agri Shorts', subtitle: 'Short, practical farming videos from reviewed creators.',
    dashboard: 'Back to dashboard', search: 'Search videos, crops, or topics', all: 'All videos',
    trending: 'Trending', saved: 'Saved', categories: 'Topics', loading: 'Loading videos…',
    noVideos: 'No reviewed videos are available yet.', unavailable: 'Could not load videos.',
    retry: 'Try again', watch: 'Watch', views: 'views', likes: 'likes', save: 'Save video',
    removeSave: 'Remove saved video', share: 'Share', report: 'Report', comments: 'Comments',
    commentPlaceholder: 'Write a useful, respectful comment', postComment: 'Post comment',
    noComments: 'No comments yet.', reply: 'Reply', like: 'Like comment',
    reportReason: 'Report reason', submitReport: 'Submit report', reported: 'Report sent for review.',
    uploadTitle: 'Publish an agricultural short', creatorInfo: 'Creator uploads are reviewed before appearing publicly.',
    chooseVideo: 'Choose video (MP4, MOV, or WebM, up to 100 MB)', titleField: 'Video title',
    description: 'Description', category: 'Category', crop: 'Crop (optional)', language: 'Video language',
    tags: 'Tags (comma separated)', source: 'Source or reference (optional)', submit: 'Upload for review',
    uploading: 'Uploading…', uploadSuccess: 'Video submitted for administrator review.',
    myVideos: 'My uploads', pending: 'Pending review', approved: 'Published', rejected: 'Not approved',
    loginCreator: 'Sign in with an approved creator account to upload.',
    errors: 'Something went wrong. Please try again.', countError: 'Comment could not be posted.',
    shareCopied: 'Link copied.', play: 'Play video', details: 'Video details',
    videoError: 'This video could not be played. Try again later.', captions: 'Captions',
  },
  te: {
    title: 'అగ్రి షార్ట్స్', subtitle: 'సమీక్షించిన సృష్టికర్తల నుంచి చిన్న, ఉపయోగకరమైన వ్యవసాయ వీడియోలు.',
    dashboard: 'డాష్‌బోర్డ్‌కు తిరిగి', search: 'వీడియోలు, పంటలు లేదా అంశాలు వెతకండి', all: 'అన్ని వీడియోలు',
    trending: 'ప్రాచుర్యంలో', saved: 'భద్రపరచినవి', categories: 'విషయాలు', loading: 'వీడియోలు లోడ్ అవుతున్నాయి…',
    noVideos: 'ఇంకా సమీక్షించిన వీడియోలు అందుబాటులో లేవు.', unavailable: 'వీడియోలను లోడ్ చేయలేకపోయాం.',
    retry: 'మళ్లీ ప్రయత్నించండి', watch: 'చూడండి', views: 'వీక్షణలు', likes: 'ఇష్టాలు', save: 'వీడియోను భద్రపరచండి',
    removeSave: 'భద్రపరచిన వీడియో తొలగించండి', share: 'పంచుకోండి', report: 'నివేదించండి', comments: 'వ్యాఖ్యలు',
    commentPlaceholder: 'ఉపయోగకరమైన, గౌరవప్రదమైన వ్యాఖ్య రాయండి', postComment: 'వ్యాఖ్యను పంపండి',
    noComments: 'ఇంకా వ్యాఖ్యలు లేవు.', reply: 'ప్రత్యుత్తరం', like: 'వ్యాఖ్యను ఇష్టపడండి',
    reportReason: 'నివేదిక కారణం', submitReport: 'నివేదిక పంపండి', reported: 'సమీక్ష కోసం నివేదిక పంపబడింది.',
    uploadTitle: 'వ్యవసాయ షార్ట్‌ను ప్రచురించండి', creatorInfo: 'ప్రజలకు కనిపించే ముందు సృష్టికర్త వీడియోలు సమీక్షించబడతాయి.',
    chooseVideo: 'వీడియో ఎంచుకోండి (MP4, MOV లేదా WebM, గరిష్ఠం 100 MB)', titleField: 'వీడియో శీర్షిక',
    description: 'వివరణ', category: 'వర్గం', crop: 'పంట (ఐచ్ఛికం)', language: 'వీడియో భాష',
    tags: 'ట్యాగ్‌లు (కామాలతో వేరు చేయండి)', source: 'మూలం లేదా సూచన (ఐచ్ఛికం)', submit: 'సమీక్షకు అప్‌లోడ్ చేయండి',
    uploading: 'అప్‌లోడ్ అవుతోంది…', uploadSuccess: 'వీడియో నిర్వాహక సమీక్షకు పంపబడింది.',
    myVideos: 'నా అప్‌లోడ్‌లు', pending: 'సమీక్షలో ఉంది', approved: 'ప్రచురించబడింది', rejected: 'ఆమోదం పొందలేదు',
    loginCreator: 'అప్‌లోడ్ చేయడానికి ఆమోదిత సృష్టికర్త ఖాతాతో సైన్ ఇన్ చేయండి.',
    errors: 'ఏదో సమస్య వచ్చింది. మళ్లీ ప్రయత్నించండి.', countError: 'వ్యాఖ్యను పంపలేకపోయాం.',
    shareCopied: 'లింక్ కాపీ చేయబడింది.', play: 'వీడియో ప్లే చేయండి', details: 'వీడియో వివరాలు',
    videoError: 'వీడియో ప్లే కాలేదు. తర్వాత మళ్లీ ప్రయత్నించండి.', captions: 'శీర్షికలు',
  },
  hi: {
    title: 'एग्री शॉर्ट्स', subtitle: 'समीक्षित निर्माताओं के छोटे, उपयोगी खेती वीडियो।',
    dashboard: 'डैशबोर्ड पर वापस', search: 'वीडियो, फसल या विषय खोजें', all: 'सभी वीडियो',
    trending: 'लोकप्रिय', saved: 'सहेजे गए', categories: 'विषय', loading: 'वीडियो लोड हो रहे हैं…',
    noVideos: 'अभी कोई समीक्षित वीडियो उपलब्ध नहीं है।', unavailable: 'वीडियो लोड नहीं हो सके।',
    retry: 'फिर प्रयास करें', watch: 'देखें', views: 'व्यू', likes: 'पसंद', save: 'वीडियो सहेजें',
    removeSave: 'सहेजा वीडियो हटाएँ', share: 'साझा करें', report: 'रिपोर्ट करें', comments: 'टिप्पणियाँ',
    commentPlaceholder: 'उपयोगी और सम्मानजनक टिप्पणी लिखें', postComment: 'टिप्पणी भेजें',
    noComments: 'अभी कोई टिप्पणी नहीं है।', reply: 'जवाब दें', like: 'टिप्पणी पसंद करें',
    reportReason: 'रिपोर्ट का कारण', submitReport: 'रिपोर्ट भेजें', reported: 'रिपोर्ट समीक्षा के लिए भेजी गई।',
    uploadTitle: 'कृषि शॉर्ट प्रकाशित करें', creatorInfo: 'सार्वजनिक होने से पहले निर्माता के वीडियो की समीक्षा होती है।',
    chooseVideo: 'वीडियो चुनें (MP4, MOV या WebM, अधिकतम 100 MB)', titleField: 'वीडियो शीर्षक',
    description: 'विवरण', category: 'श्रेणी', crop: 'फसल (वैकल्पिक)', language: 'वीडियो भाषा',
    tags: 'टैग (अल्पविराम से अलग करें)', source: 'स्रोत या संदर्भ (वैकल्पिक)', submit: 'समीक्षा के लिए अपलोड करें',
    uploading: 'अपलोड हो रहा है…', uploadSuccess: 'वीडियो व्यवस्थापक समीक्षा के लिए भेजा गया।',
    myVideos: 'मेरे अपलोड', pending: 'समीक्षा में', approved: 'प्रकाशित', rejected: 'स्वीकृत नहीं',
    loginCreator: 'अपलोड करने के लिए स्वीकृत निर्माता खाते से साइन इन करें।',
    errors: 'कुछ गलत हुआ। कृपया फिर प्रयास करें।', countError: 'टिप्पणी नहीं भेजी जा सकी।',
    shareCopied: 'लिंक कॉपी किया गया।', play: 'वीडियो चलाएँ', details: 'वीडियो विवरण',
    videoError: 'वीडियो नहीं चल सका। बाद में फिर प्रयास करें।', captions: 'कैप्शन',
  },
};

const reportReasons = ['misinformation', 'unsafe_advice', 'spam', 'copyright', 'other'];

export default function AgriShortsPage({ creatorOnly = false }) {
  const { lang } = useLanguage();
  const labels = copy[lang] || copy.en;
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canCreate = ['expert', 'approved_creator', 'admin'].includes(user?.role);
  const [view, setView] = useState(creatorOnly ? 'creator' : 'all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState('');
  const [replyText, setReplyText] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const watched = useRef(new Set());
  const [captionsUrl, setCaptionsUrl] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['agri-shorts-categories'],
    queryFn: async () => unwrapPayload(await api.get('/agri-shorts/categories')),
    retry: false,
  });
  const cropsQuery = useQuery({
    queryKey: ['agri-shorts-crops'],
    queryFn: async () => unwrapPayload(await api.get('/agri-shorts/crops')),
    enabled: creatorOnly,
    retry: false,
  });
  const videosQuery = useQuery({
    queryKey: ['agri-shorts-videos', view, search, category, lang],
    queryFn: async () => {
      if (view === 'creator') return unwrapPayload(await api.get('/agri-shorts/my-videos'));
      if (view === 'saved') return unwrapPayload(await api.get('/agri-shorts/saved'));
      if (view === 'trending') return unwrapPayload(await api.get('/agri-shorts/trending', { params: { language: lang, q: search || undefined, category: category || undefined } }));
      return unwrapPayload(await api.get('/agri-shorts/videos', { params: { language: lang, q: search || undefined, category: category || undefined } }));
    },
    enabled: !id,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ['agri-shorts-video', id],
    queryFn: async () => unwrapPayload(await api.get(`/agri-shorts/videos/${id}`)),
    enabled: Boolean(id),
    retry: false,
  });
  const commentsQuery = useQuery({
    queryKey: ['agri-shorts-comments', id],
    queryFn: async () => unwrapPayload(await api.get(`/agri-shorts/videos/${id}/comments`)),
    enabled: Boolean(id),
    retry: false,
  });

  const videos = useMemo(() => {
    const data = videosQuery.data;
    return Array.isArray(data) ? data : data?.items || [];
  }, [videosQuery.data]);
  const categories = categoriesQuery.data || [];

  async function interaction(url, method, data) {
    setNotice('');
    try {
      await api.request({ url, method, data });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agri-shorts-videos'] }),
        queryClient.invalidateQueries({ queryKey: ['agri-shorts-video', id] }),
        queryClient.invalidateQueries({ queryKey: ['agri-shorts-comments', id] }),
      ]);
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.errors);
    }
  }

  async function postComment(event) {
    event.preventDefault();
    if (!commentText.trim() || !id) return;
    try {
      await api.post(`/agri-shorts/videos/${id}/comments`, { comment: commentText.trim() });
      setCommentText('');
      await queryClient.invalidateQueries({ queryKey: ['agri-shorts-comments', id] });
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.countError);
    }
  }

  async function postReply(event, commentId) {
    event.preventDefault();
    if (!replyText.trim()) return;
    try {
      await api.post(`/agri-shorts/comments/${commentId}/replies`, { comment: replyText.trim() });
      setReplyText('');
      setReplyTarget('');
      await queryClient.invalidateQueries({ queryKey: ['agri-shorts-comments', id] });
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.countError);
    }
  }

  async function shareVideo(videoId) {
    try {
      const { url } = unwrapPayload(await api.post(`/agri-shorts/videos/${videoId}/share`));
      if (navigator.share) await navigator.share({ title: labels.title, url });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice(labels.shareCopied);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(error?.response?.data?.message || labels.errors);
    }
  }

  async function reportVideo(videoId) {
    const reason = window.prompt(`${labels.reportReason}: ${reportReasons.join(', ')}`, 'other');
    if (!reason) return;
    try {
      await api.post(`/agri-shorts/videos/${videoId}/report`, { reason });
      setNotice(labels.reported);
    } catch (error) {
      setNotice(error?.response?.data?.message || labels.errors);
    }
  }

  async function uploadVideo(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.video.files[0];
    if (!file || file.size > 100 * 1024 * 1024) {
      setNotice(labels.chooseVideo);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const signature = unwrapPayload(await api.post('/agri-shorts/upload/signature'));
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', signature.apiKey);
      body.append('timestamp', signature.timestamp);
      body.append('signature', signature.signature);
      body.append('folder', signature.folder);
      body.append('context', signature.context);
      body.append('allowed_formats', signature.allowed_formats);
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/video/upload`, { method: 'POST', body });
      const media = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(media.error?.message || labels.errors);
      const values = new FormData(form);
      await api.post('/agri-shorts/upload', {
        publicId: media.public_id,
        title: values.get('title'),
        description: values.get('description'),
        categoryId: values.get('categoryId'),
        cropId: values.get('cropId') || undefined,
        language: values.get('language'),
        tags: String(values.get('tags') || '').split(',').map((item) => item.trim()).filter(Boolean),
        sourceReference: values.get('sourceReference') || undefined,
      });
      form.reset();
      setNotice(labels.uploadSuccess);
      await queryClient.invalidateQueries({ queryKey: ['agri-shorts-videos', 'creator'] });
    } catch (error) {
      setNotice(error?.response?.data?.message || error.message || labels.errors);
    } finally {
      setBusy(false);
    }
  }

  const videoCard = (video) => {
    const preview = (
      <>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <span><Play size={34} /></span>}
        <span className="platform-video-card__duration"><Clock3 size={13} /> {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}</span>
      </>
    );
    return (
    <article className="platform-video-card" key={video.id}>
      {creatorOnly ? <div className="platform-video-card__media">{preview}</div> : <Link to={`/farmer/agri-shorts/${video.id}`} className="platform-video-card__media" aria-label={`${labels.play}: ${video.title}`}>{preview}</Link>}
      <div className="platform-video-card__body">
        <small>{video.category?.name || video.crop?.name || labels.title}</small>
        <h2>{creatorOnly ? video.title : <Link to={`/farmer/agri-shorts/${video.id}`}>{video.title}</Link>}</h2>
        <p>{video.description}</p>
        {view === 'creator' && <strong className={`platform-status platform-status--${video.status}`}>{labels[video.status] || video.status}</strong>}
        <div className="platform-card-stats"><span><Eye size={15} />{video.viewCount} {labels.views}</span><span><Heart size={15} />{video.likeCount} {labels.likes}</span></div>
      </div>
    </article>
    );
  };

  const detail = detailQuery.data;
  const video = id ? detail : null;
  useEffect(() => {
    if (!video?.captionsVtt) {
      setCaptionsUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(new Blob([video.captionsVtt], { type: 'text/vtt' }));
    setCaptionsUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video?.captionsVtt]);
  const onVideoTime = (event) => {
    if (!video || watched.current.has(video.id)) return;
    const node = event.currentTarget;
    const threshold = Math.min(video.duration, Math.max(3, Math.ceil(video.duration * 0.25)));
    if (node.currentTime < threshold) return;
    watched.current.add(video.id);
    api.post(`/agri-shorts/videos/${video.id}/view`, { watchedDuration: Math.floor(node.currentTime) })
      .then(() => queryClient.invalidateQueries({ queryKey: ['agri-shorts-video', video.id] }))
      .catch(() => watched.current.delete(video.id));
  };

  return (
    <main className="farming-tools platform-module">
      <header className="farming-tools__header">
        <Link to="/farmer/dashboard"><Logo size="small" /></Link>
        <div className="farming-tools__header-actions"><ModuleLanguageSelector label={labels.language} /><Link className="farming-tools__back" to="/farmer/dashboard">{labels.dashboard}</Link></div>
      </header>
      <div className="farming-tools__container">
        <div className="farming-tools__intro">
          <span className="farming-tools__intro-icon"><Video size={27} /></span>
          <div><p className="farming-tools__eyebrow">AGRISATHI</p><h1>{creatorOnly ? labels.uploadTitle : labels.title}</h1><p>{creatorOnly ? labels.creatorInfo : labels.subtitle}</p></div>
        </div>
        {notice && <p className="platform-notice" role="status">{notice}</p>}

        {creatorOnly ? (
          <div className="platform-layout">
            <section className="platform-panel">
              <h2>{labels.uploadTitle}</h2><p>{labels.creatorInfo}</p>
              <form className="platform-form" onSubmit={uploadVideo}>
                <label>{labels.chooseVideo}<input type="file" name="video" accept="video/mp4,video/quicktime,video/webm" required /></label>
                <label>{labels.titleField}<input name="title" maxLength="180" required /></label>
                <label>{labels.description}<textarea name="description" rows="4" maxLength="5000" required /></label>
                <label>{labels.category}<select name="categoryId" required><option value="">—</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label>{labels.crop}<select name="cropId" defaultValue=""><option value="">—</option>{(cropsQuery.data || []).map((crop) => <option key={crop.id} value={crop.id}>{crop.displayName || crop.name}</option>)}</select></label>
                <label>{labels.language}<select name="language" defaultValue={lang}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
                <label>{labels.tags}<input name="tags" maxLength="500" /></label>
                <label>{labels.source}<input name="sourceReference" maxLength="1000" /></label>
                <button className="platform-primary" type="submit" disabled={busy}><Upload size={18} />{busy ? labels.uploading : labels.submit}</button>
              </form>
            </section>
            <section className="platform-panel"><h2>{labels.myVideos}</h2><div className="platform-video-grid">{videos.map(videoCard)}</div></section>
          </div>
        ) : id ? (
          detailQuery.isPending ? <p className="farming-tools__loading" role="status">{labels.loading}</p>
            : detailQuery.isError ? <div className="platform-notice" role="alert">{labels.unavailable}<button type="button" onClick={() => detailQuery.refetch()}>{labels.retry}</button></div>
              : video && (
                <div className="platform-layout platform-layout--detail">
                  <section className="platform-panel platform-video-detail">
                    <button className="platform-text-button" type="button" onClick={() => navigate('/farmer/agri-shorts')}><ArrowLeft size={17} />{labels.all}</button>
                    <video controls playsInline poster={video.thumbnailUrl || undefined} onTimeUpdate={onVideoTime} onError={() => setNotice(labels.videoError)}>
                      <source src={video.videoUrl} />
                      {captionsUrl && <track kind="captions" src={captionsUrl} srcLang={video.language} label={labels.captions} default />}
                    </video>
                    <h2>{video.title}</h2><p>{video.description}</p>
                    <div className="platform-actions">
                      <button type="button" onClick={() => interaction(`/agri-shorts/videos/${video.id}/like`, video.isLiked ? 'delete' : 'post')}><Heart size={18} fill={video.isLiked ? 'currentColor' : 'none'} />{video.likeCount}</button>
                      <button type="button" onClick={() => interaction(`/agri-shorts/videos/${video.id}/save`, video.isSaved ? 'delete' : 'post')}><Bookmark size={18} fill={video.isSaved ? 'currentColor' : 'none'} />{video.isSaved ? labels.removeSave : labels.save}</button>
                      <button type="button" onClick={() => shareVideo(video.id)}><Share2 size={18} />{labels.share}</button>
                      <button type="button" onClick={() => reportVideo(video.id)}><ShieldAlert size={18} />{labels.report}</button>
                    </div>
                  </section>
                  <section className="platform-panel">
                    <h2><MessageCircle size={20} />{labels.comments}</h2>
                    <form className="platform-comment-form" onSubmit={postComment}><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={labels.commentPlaceholder} maxLength="1200" required /><button className="platform-primary" type="submit">{labels.postComment}</button></form>
                    {commentsQuery.isError && <p className="platform-notice" role="alert">{labels.unavailable}</p>}
                    {!commentsQuery.isPending && !(commentsQuery.data || []).length && <p className="platform-empty">{labels.noComments}</p>}
                    <div className="platform-comments">{(commentsQuery.data || []).map((comment) => (
                      <article key={comment.id} className="platform-comment"><p>{comment.comment}</p><small>{new Date(comment.createdAt).toLocaleString()}</small>
                        <button className="platform-text-button" type="button" onClick={() => interaction(`/agri-shorts/comments/${comment.id}/like`, comment.isLiked ? 'delete' : 'post')} aria-label={labels.like}><Heart size={15} fill={comment.isLiked ? 'currentColor' : 'none'} />{comment.likeCount}</button>
                        <button className="platform-text-button" type="button" onClick={() => { setReplyTarget(replyTarget === comment.id ? '' : comment.id); setReplyText(''); }}><MessageCircle size={15} />{labels.reply}</button>
                        <button className="platform-text-button" type="button" onClick={async () => {
                          const reason = window.prompt(`${labels.reportReason}: ${reportReasons.join(', ')}`, 'other');
                          if (!reason) return;
                          try {
                            await api.post(`/agri-shorts/comments/${comment.id}/report`, { reason });
                            setNotice(labels.reported);
                          } catch (error) { setNotice(error?.response?.data?.message || labels.errors); }
                        }}><ShieldAlert size={15} />{labels.report}</button>
                        {comment.isMine && <button className="platform-text-button" type="button" onClick={() => interaction(`/agri-shorts/comments/${comment.id}`, 'delete')} aria-label="Delete comment"><X size={15} /></button>}
                        {replyTarget === comment.id && <form className="platform-comment-form" onSubmit={(event) => postReply(event, comment.id)}><textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={labels.commentPlaceholder} maxLength="1200" required /><button className="platform-primary" type="submit">{labels.reply}</button></form>}
                        {(comment.replies || []).map((reply) => <div className="platform-comment__reply" key={reply.id}><p>{reply.comment}</p><button className="platform-text-button" type="button" onClick={() => interaction(`/agri-shorts/comments/${reply.id}/like`, reply.isLiked ? 'delete' : 'post')} aria-label={labels.like}><Heart size={15} fill={reply.isLiked ? 'currentColor' : 'none'} />{reply.likeCount}</button>{reply.isMine && <button className="platform-text-button" type="button" onClick={() => interaction(`/agri-shorts/comments/${reply.id}`, 'delete')} aria-label="Delete reply"><X size={15} /></button>}</div>)}
                      </article>
                    ))}</div>
                  </section>
                </div>
              )
        ) : (
          <>
            <div className="platform-toolbar">
              <label className="platform-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} /></label>
              <div className="platform-tabs">
                {[[ 'all', labels.all ], ['trending', labels.trending], ['saved', labels.saved]].map(([key, title]) => <button type="button" key={key} className={view === key ? 'is-active' : ''} onClick={() => setView(key)}>{title}</button>)}
              </div>
              {canCreate && <Link className="platform-primary platform-upload-link" to="/creator/agri-shorts"><Upload size={17} />{labels.uploadTitle}</Link>}
            </div>
            <div className="platform-category-row"><strong>{labels.categories}</strong><button type="button" className={!category ? 'is-active' : ''} onClick={() => { setView('all'); setCategory(''); }}>{labels.all}</button>{categories.map((item) => <button key={item.id} type="button" className={category === item.slug ? 'is-active' : ''} onClick={() => { setView('all'); setCategory(item.slug); }}>{item.name}</button>)}</div>
            {videosQuery.isPending ? <p className="farming-tools__loading" role="status">{labels.loading}</p>
              : videosQuery.isError ? <div className="platform-notice" role="alert">{labels.unavailable}<button type="button" onClick={() => videosQuery.refetch()}>{labels.retry}</button></div>
                : videos.length ? <div className="platform-video-grid">{videos.map(videoCard)}</div> : <p className="platform-empty">{labels.noVideos}</p>}
          </>
        )}
      </div>
    </main>
  );
}
