import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown, ArrowRight, ArrowUpRight, AudioLines, BadgeCheck, Beef,
  BookOpen, Bot, Check, CloudSun, Flower2, HandHeart,
  Landmark, Languages, Leaf, Map, Mic, Play, Sprout, Tractor, Users,
  WalletCards, Wheat, Wind, Wrench, Calculator, CalendarDays, ShoppingBasket,
  ShieldCheck, Smartphone, FlaskConical, HeartPulse, ScanLine, TrendingUp,
} from 'lucide-react';

const photos = (id, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

const farmerPhoto = (id, width = 1000) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;

const featureIcons = [
  Mic, ScanLine, CloudSun, TrendingUp, Landmark, ShoppingBasket,
  Map, Calculator, Tractor, CalendarDays, Beef, Users,
];

const serviceIcons = [Tractor, Wind, Wrench, FlaskConical, HeartPulse, Users];
const benefitIcons = [HandHeart, Mic, Languages, Sprout, BookOpen, BadgeCheck];
const easeIcons = [ArrowRight, Mic, BookOpen, Smartphone, Smartphone, AudioLines];
const marketIcons = [Sprout, Flower2, Tractor, Leaf, Wheat, Beef];

function Reveal({ children, className = '', delay = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, description, light = false }) {
  return (
    <div className={`home-section-heading${light ? ' home-section-heading--light' : ''}`}>
      <span className="home-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function HeroSection({ copy }) {
  return (
    <section className="home-hero" id="home">
      <div className="home-hero__glow home-hero__glow--one" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--two" aria-hidden="true" />
      <div className="home-container home-hero__grid">
        <Reveal className="home-hero__content">
          <div className="home-hero__eyebrow"><span />{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          {copy.teluguTitle && <p className="home-hero__telugu" lang="te">{copy.teluguTitle}</p>}
          <p className="home-hero__description">{copy.description}</p>
          <div className="home-actions">
            <Link className="home-button home-button--primary" to="/register">
              {copy.primary}<ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a className="home-button home-button--outline" href="#features">
              {copy.secondary}<ArrowDown size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="home-hero__languages">
            <Languages size={17} aria-hidden="true" />
            <span>తెలుగు</span><span aria-hidden="true">·</span><span>English</span><span aria-hidden="true">·</span><span>हिन्दी</span>
          </div>
        </Reveal>

        <Reveal className="home-hero__visual" delay={0.12}>
          <img
            src={farmerPhoto(20841297, 1200)}
            alt={copy.imageAlt}
            fetchPriority="high"
          />
          <div className="home-hero__image-shade" />
          <div className="home-hero__image-caption">
            <span className="home-hero__caption-icon"><Leaf size={19} aria-hidden="true" /></span>
            <span><strong>AGRISATHI</strong><small>{copy.preview}</small></span>
          </div>
          <div className="home-float-card home-float-card--weather">
            <span className="home-float-card__icon"><CloudSun size={21} aria-hidden="true" /></span>
            <span><strong>{copy.weather}</strong><small>{copy.note}</small></span>
          </div>
          <div className="home-float-card home-float-card--crop">
            <span className="home-float-card__icon"><ShieldCheck size={21} aria-hidden="true" /></span>
            <span><strong>{copy.crop}</strong><small>{copy.market}</small></span>
          </div>
        </Reveal>
      </div>
      <div className="home-hero__bottom" aria-hidden="true" />
    </section>
  );
}

export function TrustHighlights({ items }) {
  const icons = [Bot, Languages, Leaf, HandHeart];
  return (
    <section className="home-trust" aria-label="AGRISATHI highlights">
      <div className="home-container home-trust__grid">
        {items.map(([title, description], index) => {
          const Icon = icons[index];
          return (
            <Reveal className="home-trust__item" key={title} delay={index * 0.05}>
              <span className="home-icon-box"><Icon size={22} aria-hidden="true" /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function AboutSection({ copy }) {
  return (
    <section className="home-section home-about" id="about">
      <div className="home-container home-about__grid">
        <Reveal className="home-about__visual">
          <img src={farmerPhoto(29039800, 1000)} alt={copy.imageAlt} loading="lazy" />
          <div className="home-about__stamp"><Sprout size={24} aria-hidden="true" /><span>{copy.imageLabel}</span></div>
          <div className="home-about__shape" aria-hidden="true" />
        </Reveal>
        <Reveal className="home-about__content" delay={0.08}>
          <span className="home-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          {copy.teluguTitle && <p className="home-local-title" lang="te">{copy.teluguTitle}</p>}
          <p className="home-body-copy">{copy.description}</p>
          <ul className="home-check-list">
            {copy.benefits.map((benefit) => <li key={benefit}><Check size={17} aria-hidden="true" />{benefit}</li>)}
          </ul>
          <Link className="home-text-link" to="/about">{copy.button}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </Reveal>
      </div>
    </section>
  );
}

export function FeaturesSection({ copy, exploreLabel }) {
  return (
    <section className="home-section home-features" id="features">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-feature-grid">
          {copy.items.map(([title, description, action, route], index) => {
            const Icon = featureIcons[index];
            return (
              <Reveal className="home-feature-card" key={title} delay={(index % 4) * 0.04}>
                <span className={`home-feature-card__icon home-feature-card__icon--${index % 6}`}>
                  <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <Link className="home-feature-card__link" to={route}>
                  {action || exploreLabel}<ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Reveal>
            );
          })}
        </div>
        <div className="home-section-action">
          <Link className="home-button home-button--outline" to="/features">
            {copy.more}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function VoiceAssistantSection({ copy }) {
  const [active, setActive] = useState(false);
  return (
    <section className="home-voice" id="voice-assistant">
      <div className="home-voice__pattern" aria-hidden="true" />
      <div className="home-container home-voice__grid">
        <Reveal className="home-voice__content">
          <span className="home-eyebrow home-eyebrow--light">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          {copy.teluguTitle && <p className="home-local-title home-local-title--light" lang="te">{copy.teluguTitle}</p>}
          <p className="home-voice__description">{copy.description}</p>
          <div className="home-voice__commands">
            {copy.commands.map((command) => (
              <div className="home-voice__command" key={command}><Mic size={16} aria-hidden="true" /><span>{command}</span></div>
            ))}
          </div>
          <Link className="home-button home-button--lime" to="/farmer/ai-assistant">
            {copy.try}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </Reveal>
        <Reveal className="home-voice__preview" delay={0.1}>
          <div className={`home-voice-card${active ? ' is-listening' : ''}`}>
            <div className="home-voice-card__top"><span className="home-voice-card__status"><i />{active ? copy.listening : copy.idle}</span><AudioLines size={21} aria-hidden="true" /></div>
            <button
              className="home-mic-button"
              type="button"
              onClick={() => setActive((value) => !value)}
              aria-pressed={active}
              aria-label={active ? copy.stop : copy.start}
            >
              <span className="home-mic-button__ring home-mic-button__ring--one" />
              <span className="home-mic-button__ring home-mic-button__ring--two" />
              <span className="home-mic-button__core"><Mic size={36} aria-hidden="true" /></span>
            </button>
            <p className="home-voice-card__hint">{active ? copy.stop : copy.start}</p>
            <div className="home-waveform" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <i key={index} style={{ '--bar': `${10 + ((index * 17) % 29)}px` }} />)}</div>
            <p className="home-voice-card__note">{copy.demoNote}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HowItWorksSection({ copy }) {
  const icons = [Users, Smartphone, Sprout];
  return (
    <section className="home-section home-steps" id="how-it-works">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-steps__grid">
          {copy.items.map(([title, description], index) => {
            const Icon = icons[index];
            return (
              <Reveal className="home-step" key={title} delay={index * 0.08}>
                <div className="home-step__number">{`0${index + 1}`}</div>
                <div className="home-step__icon"><Icon size={27} aria-hidden="true" /></div>
                <h3>{title}</h3><p>{description}</p>
                {index < copy.items.length - 1 && <ArrowRight className="home-step__connector" size={24} aria-hidden="true" />}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function KnowledgeSection({ copy }) {
  return (
    <section className="home-section home-knowledge" id="knowledge">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-knowledge__grid">
          {copy.items.map(([title, description, image]) => (
            <Reveal className="home-knowledge-card" key={title}>
              <img src={photos(image, 600)} alt="" loading="lazy" />
              <div className="home-knowledge-card__content"><h3>{title}</h3><p>{description}</p><Link to="/farmer/crop-knowledge" aria-label={`${copy.button}: ${title}`}>{copy.button}<ArrowRight size={16} aria-hidden="true" /></Link></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AgriShortsSection({ copy }) {
  return (
    <section className="home-section home-shorts" id="agri-shorts">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-shorts__grid">
          {copy.items.map(([title, category, image], index) => (
            <Link className={`home-short-card home-short-card--${index + 1}`} to="/farmer/agri-shorts" key={title} aria-label={`${copy.play}: ${title}`}>
              <img src={photos(image, 650)} alt="" loading="lazy" />
              <span className="home-short-card__shade" />
              <span className="home-short-card__play"><Play size={19} fill="currentColor" aria-hidden="true" /></span>
              <span className="home-short-card__text"><small>{category}</small><strong>{title}</strong></span>
            </Link>
          ))}
        </div>
        <div className="home-section-action"><Link className="home-button home-button--outline" to="/farmer/agri-shorts">{copy.button}<ArrowRight size={18} aria-hidden="true" /></Link></div>
      </div>
    </section>
  );
}

export function SchemesSection({ copy }) {
  const icons = [Landmark, WalletCards, HandHeart, ShieldCheck, BadgeCheck];
  return (
    <section className="home-section home-schemes" id="schemes">
      <div className="home-container home-schemes__layout">
        <Reveal className="home-schemes__intro">
          <span className="home-eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p>
          <Link className="home-button home-button--primary" to="/farmer/schemes">{copy.button}<ArrowRight size={18} aria-hidden="true" /></Link>
        </Reveal>
        <Reveal className="home-schemes__list" delay={0.08}>
          {copy.items.map((item, index) => {
            const Icon = icons[index];
            return <Link className="home-scheme-item" to="/farmer/schemes" key={item}><span><Icon size={21} aria-hidden="true" /></span><strong>{item}</strong><ArrowUpRight size={18} aria-hidden="true" /></Link>;
          })}
          <p className="home-schemes__note"><ShieldCheck size={15} aria-hidden="true" />{copy.note}</p>
        </Reveal>
      </div>
    </section>
  );
}

export function MarketplaceSection({ copy }) {
  return (
    <section className="home-section home-marketplace" id="marketplace">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-market-grid">
          {copy.items.map((item, index) => {
            const Icon = marketIcons[index];
            return <Link className={`home-market-item home-market-item--${index + 1}`} to="/farmer/marketplace" key={item}><span className="home-market-item__icon"><Icon size={26} aria-hidden="true" /></span><strong>{item}</strong><ArrowUpRight size={17} className="home-market-item__arrow" aria-hidden="true" /></Link>;
          })}
        </div>
        <div className="home-marketplace__bottom"><p>{copy.note}</p><Link className="home-button home-button--primary" to="/farmer/marketplace">{copy.button}<ArrowRight size={18} aria-hidden="true" /></Link></div>
      </div>
    </section>
  );
}

export function ServicesSection({ copy }) {
  return (
    <section className="home-section home-services" id="services">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-service-grid">
          {copy.items.map(([title, description], index) => {
            const Icon = serviceIcons[index];
            return <Reveal className="home-service-card" key={title} delay={index * 0.035}><span className="home-service-card__icon"><Icon size={24} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p><Link to="/farmer/services">{copy.button}<ArrowRight size={16} aria-hidden="true" /></Link></Reveal>;
          })}
        </div>
        <div className="home-section-action"><Link className="home-button home-button--primary" to="/farmer/services">{copy.button}<ArrowRight size={18} aria-hidden="true" /></Link></div>
      </div>
    </section>
  );
}

export function WhyChooseSection({ copy }) {
  return (
    <section className="home-section home-why" id="why-agrisathi">
      <div className="home-container">
        <Reveal><SectionHeading {...copy} /></Reveal>
        <div className="home-why__grid">
          {copy.items.map(([title, description], index) => {
            const Icon = benefitIcons[index];
            return <Reveal className="home-why-card" key={title}><span><Icon size={23} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></Reveal>;
          })}
        </div>
      </div>
    </section>
  );
}

export function FarmerFriendlySection({ copy }) {
  const image = farmerPhoto(20841297, 1000);
  return (
    <section className="home-section home-friendly" id="farmer-friendly">
      <div className="home-container home-friendly__grid">
        <Reveal className="home-friendly__content">
          <span className="home-eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2>
          {copy.teluguTitle && <p className="home-local-title" lang="te">{copy.teluguTitle}</p>}
          <p className="home-body-copy">{copy.description}</p>
          <div className="home-friendly__list">{copy.items.map((item, index) => { const Icon = easeIcons[index]; return <div key={item}><span><Icon size={19} aria-hidden="true" /></span>{item}</div>; })}</div>
        </Reveal>
        <Reveal className="home-friendly__visual" delay={0.1}>
          <img src={image} alt={copy.imageAlt} loading="lazy" />
          <div className="home-friendly__phone" aria-hidden="true">
            <div className="home-friendly__phone-top"><span /><i /></div>
            <div className="home-friendly__phone-brand"><span><Leaf size={17} /></span><strong>AGRISATHI</strong></div>
            <div className="home-friendly__phone-greeting"><small>{copy.phoneWelcome}</small><strong>{copy.phoneQuestion}</strong></div>
            <div className="home-friendly__phone-services"><i><Mic size={16} /></i><i><CloudSun size={16} /></i><i><Wheat size={16} /></i><i><ShoppingBasket size={16} /></i></div>
            <span className="home-friendly__phone-nav"><span /><span /><span /></span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function CTASection({ copy }) {
  return (
    <section className="home-cta" id="contact">
      <div className="home-cta__orb home-cta__orb--one" aria-hidden="true" />
      <div className="home-cta__orb home-cta__orb--two" aria-hidden="true" />
      <Reveal className="home-container home-cta__content">
        <span className="home-cta__leaf"><Leaf size={28} aria-hidden="true" /></span>
        <h2>{copy.title}</h2><p>{copy.description}</p>
        <div className="home-actions home-actions--center">
          <Link className="home-button home-button--lime" to="/register">{copy.primary}<ArrowRight size={18} aria-hidden="true" /></Link>
          <a className="home-button home-button--glass" href="#features">{copy.secondary}<ArrowDown size={17} aria-hidden="true" /></a>
        </div>
      </Reveal>
    </section>
  );
}
