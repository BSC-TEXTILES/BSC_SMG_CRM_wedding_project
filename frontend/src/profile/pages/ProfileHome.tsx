import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProjectDetailModal } from '../components/ProjectDetailModal';
import { ServiceInquiryModal } from '../components/ServiceInquiryModal';
import { ProfileApi } from '../api';
import {
  ProfileData,
  ServiceItem,
  ProjectItem,
  TestimonialItem,
  AchievementItem
} from '../types';
import { ArrowRight, ShieldCheck, Star, MapPin, Clock, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';

export const ProfileHome: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  useEffect(() => {
    document.title = 'BSC Textiles — Master Silk Weavers & Bridal Trousseau Curators Since 1948';

    async function loadData() {
      try {
        const [profData, servData, projData, testData, achData] = await Promise.all([
          ProfileApi.getProfile().catch(() => null),
          ProfileApi.getServices().catch(() => []),
          ProfileApi.getProjects().catch(() => []),
          ProfileApi.getTestimonials().catch(() => []),
          ProfileApi.getAchievements().catch(() => [])
        ]);

        if (profData) setProfile(profData);
        setServices(servData || []);
        setProjects(projData || []);
        setTestimonials(testData || []);
        setAchievements(achData || []);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 space-y-16 sm:space-y-24">
        {/* ── HERO SECTION ──────────────────────────────────────────────────────── */}
        <section className="relative pt-6 sm:pt-12 pb-12 overflow-hidden border-b border-[var(--pf-border-soft)]">
          <div className="pf-container">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Headline & Intro */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-widest text-[var(--pf-gold)] font-bold">
                    Cloth House · Belagavi · Davanagere · Shivamogga · Est. 1948
                  </span>
                </div>

                <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[var(--pf-text-main)] leading-[1.12]">
                  {profile?.full_name ? 'The cloth is still sold on the counter.' : 'The cloth is still sold on the counter.'}
                </h1>

                <p className="text-sm sm:text-base text-[var(--pf-text-muted)] leading-relaxed max-w-xl">
                  {profile?.short_bio ||
                    'BSC Textiles keeps pure Mulberry Kanjeevarams, bridal silks, bespoke menswear, jewellery, and heirloom home linens in one building. Wedding shopping is a booked hour, so a family list is never rushed.'}
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link to="/about" className="pf-btn-primary">
                    <span>View Profile & Heritage</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/contact" className="pf-btn-secondary">
                    <span>Contact Me & Book Suite</span>
                  </Link>
                </div>

                {/* Meta location strip */}
                <div className="pt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--pf-text-subtle)] border-t border-[var(--pf-border)]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                    <span>Belagavi · Davanagere · Shivamogga</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                    <span>10:30 AM to 8:30 PM · Seven Days</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual Frame */}
              <div className="lg:col-span-5 relative">
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-[var(--pf-border)] shadow-[var(--pf-shadow-lg)] aspect-[4/5] bg-[var(--pf-bg-alt)]">
                  <img
                    src={profile?.cover_image || '/images/floor.jpg'}
                    alt="BSC Textiles authentic showroom floor"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  {/* Overlay Tag */}
                  <div className="absolute top-4 left-4 bg-[var(--pf-burgundy)] text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full shadow-md">
                    Pure Mulberry Kanjeevaram
                  </div>

                  {/* Stamp */}
                  <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-black/90 p-3 rounded-xl border border-[var(--pf-gold-border)] shadow-md text-center">
                    <span className="text-[9px] uppercase tracking-wider text-[var(--pf-gold)] font-bold block">Est.</span>
                    <span className="font-serif text-lg font-bold text-[var(--pf-text-main)] block">1948</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Navigation Rail */}
            <div className="mt-12 pt-4 border-t border-[var(--pf-border)]">
              <ul className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-semibold text-[var(--pf-text-muted)]">
                {['Men', 'Women', 'Brands', 'Home Furnishing', 'Jewellery', 'Wedding Trousseau', 'Suits', 'Towels'].map(
                  (dept, idx) => (
                    <li key={idx} className="shrink-0">
                      <Link
                        to="/projects"
                        className="px-3.5 py-1.5 rounded-full border border-[var(--pf-border)] bg-[var(--pf-bg-card)] hover:border-[var(--pf-gold)] hover:text-[var(--pf-text-main)] transition-all"
                      >
                        {dept}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ── KEY STATISTICS STRIP ──────────────────────────────────────────────── */}
        <section className="pf-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-[var(--pf-bg-card)] border border-[var(--pf-border)] p-6 sm:p-8 rounded-2xl shadow-xs">
            {(profile?.stats || [
              { label: 'Years at Counter', value: '78+', suffix: 'Years' },
              { label: 'Master Weaver Looms', value: '88+', suffix: 'Looms' },
              { label: 'Pure Silk Mark', value: '100%', suffix: 'Certified' },
              { label: 'Bridal Trousseaus', value: '14,000+', suffix: 'Curated' }
            ]).map((stat, i) => (
              <div key={i} className="text-center md:text-left space-y-1">
                <span className="font-serif text-2xl sm:text-4xl font-bold text-[var(--pf-burgundy)]">
                  {stat.value}
                </span>
                <p className="text-xs font-bold text-[var(--pf-text-main)]">{stat.label}</p>
                <span className="text-[10px] text-[var(--pf-text-subtle)] uppercase tracking-wider block">
                  {stat.suffix}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── THE HOUSE / EDITORIAL PHILOSOPHY ──────────────────────────────────── */}
        <section className="pf-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 order-2 lg:order-1">
              <div className="rounded-2xl overflow-hidden border border-[var(--pf-border)] aspect-[4/3] bg-[var(--pf-bg-alt)]">
                <img
                  src="/images/about.jpg"
                  alt="Evening light on the rail in BSC showroom"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2 space-y-5">
              <span className="pf-subheading">The Heritage Philosophy</span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[var(--pf-text-main)]">
                Most of what we sell is chosen in person.
              </h2>
              <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                BSC Textiles is a premier textile and bridal house in Belagavi, Davanagere, and Shivamogga. The work is ordinary in the best sense. A bale is opened. A shoulder is marked. A chain is held to the light. A towel is unfolded so you can feel the weight.
              </p>
              <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
                Families come back because the same counter remembers them. A school shirt one year, a suit the next, then a wedding list with both sides written on facing pages.
              </p>
              <div className="pt-2">
                <Link to="/about" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--pf-burgundy)] hover:underline">
                  <span>Read our complete career biography & lineage</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── SERVICES SECTION ──────────────────────────────────────────────────── */}
        <section className="bg-[var(--pf-bg-alt)] py-16 border-y border-[var(--pf-border)]">
          <div className="pf-container space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="pf-subheading">Signature Offerings</span>
                <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[var(--pf-text-main)]">
                  Services & Consultations
                </h2>
              </div>
              <Link to="/services" className="text-xs font-bold text-[var(--pf-burgundy)] hover:underline flex items-center gap-1">
                <span>View all services & prices</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((service) => (
                <div
                  key={service.id}
                  className="pf-card p-6 flex flex-col justify-between space-y-4 hover:border-[var(--pf-gold-border)]"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--pf-gold-light)] border border-[var(--pf-gold-border)] text-[var(--pf-gold)] flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="font-serif text-lg font-bold text-[var(--pf-text-main)]">
                      {service.title}
                    </h3>
                    <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                      {service.short_description}
                    </p>
                    {service.features && (
                      <ul className="space-y-1 pt-2 border-t border-[var(--pf-border-soft)]">
                        {service.features.slice(0, 3).map((f, idx) => (
                          <li key={idx} className="flex items-center gap-1.5 text-[11px] text-[var(--pf-text-subtle)]">
                            <CheckCircle2 className="w-3 h-3 text-[var(--pf-gold)]" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[var(--pf-border-soft)] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Starting at</span>
                      <span className="font-serif text-xs font-bold text-[var(--pf-burgundy)]">{service.starting_price}</span>
                    </div>
                    <button
                      onClick={() => setSelectedService(service)}
                      className="pf-btn-secondary text-[11px] py-1.5 px-3"
                    >
                      Inquire / Reserve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURED PROJECTS / PORTFOLIO ─────────────────────────────────────── */}
        <section className="pf-container space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="pf-subheading">Curated Portfolio</span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[var(--pf-text-main)]">
                Featured Weaves & Projects
              </h2>
            </div>
            <Link to="/projects" className="text-xs font-bold text-[var(--pf-burgundy)] hover:underline flex items-center gap-1">
              <span>Explore all projects & archives</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {projects.slice(0, 4).map((project) => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="pf-card group overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--pf-bg-alt)]">
                    <img
                      src={project.cover_image}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full">
                      {project.category}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-serif text-sm font-bold text-[var(--pf-text-main)] group-hover:text-[var(--pf-burgundy)] transition-colors line-clamp-2">
                      {project.title}
                    </h3>
                    <p className="text-[11px] text-[var(--pf-text-muted)] line-clamp-2">
                      {project.short_description}
                    </p>
                  </div>
                </div>
                <div className="p-4 pt-0 border-t border-[var(--pf-border-soft)] mt-2 flex items-center justify-between text-[11px] text-[var(--pf-gold)] font-bold">
                  <span>View Case Study</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ACHIEVEMENTS / HONORS RIBBON ──────────────────────────────────────── */}
        <section className="bg-[var(--pf-bg-alt)] py-12 border-y border-[var(--pf-border)]">
          <div className="pf-container space-y-6">
            <div className="text-center space-y-1 max-w-xl mx-auto">
              <span className="pf-subheading">National Recognitions</span>
              <h2 className="font-serif text-2xl font-bold text-[var(--pf-text-main)]">
                Accreditations & Honors
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {achievements.map((ach) => (
                <div key={ach.id} className="p-4 rounded-xl bg-[var(--pf-bg-card)] border border-[var(--pf-border)] text-center space-y-2 shadow-xs">
                  <div className="w-8 h-8 rounded-full bg-[var(--pf-gold-light)] text-[var(--pf-gold)] mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="font-serif text-xs font-bold text-[var(--pf-text-main)]">{ach.title}</h4>
                  <p className="text-[11px] text-[var(--pf-text-subtle)]">{ach.organization} · {ach.issue_date}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ──────────────────────────────────────────────────────── */}
        <section className="pf-container space-y-10">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="pf-subheading">From the Families</span>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[var(--pf-text-main)]">
              What people say after the wedding.
            </h2>
            <div className="flex items-center justify-center gap-1 text-amber-500 pt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
              <span className="text-xs font-bold text-[var(--pf-text-muted)] ml-2">5.0 Star CSAT Rating</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="pf-card p-6 flex flex-col justify-between space-y-4 hover:border-[var(--pf-gold-border)]"
              >
                <div className="space-y-3">
                  <div className="flex gap-0.5 text-amber-500">
                    {[...Array(t.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] italic leading-relaxed">
                    "{t.testimonial_text}"
                  </p>
                </div>
                <div className="pt-4 border-t border-[var(--pf-border-soft)] flex items-center gap-3">
                  <img
                    src={t.avatar_url}
                    alt={t.client_name}
                    className="w-10 h-10 rounded-full object-cover border border-[var(--pf-border)]"
                  />
                  <div>
                    <h4 className="font-serif text-xs font-bold text-[var(--pf-text-main)]">{t.client_name}</h4>
                    <span className="text-[10px] text-[var(--pf-text-subtle)] block">{t.company}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SHOWROOM DESTINATIONS ────────────────────────────────────────────── */}
        <section className="pf-container space-y-8">
          <div className="text-center space-y-1 max-w-xl mx-auto">
            <span className="pf-subheading">Physical Counters</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--pf-text-main)]">
              Visit the counters in person.
            </h2>
            <p className="text-xs text-[var(--pf-text-muted)]">
              Every floor is open with natural daylight, customer mirrors, and master stylists.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Belagavi */}
            <div className="pf-card p-5 space-y-3 border-t-4 border-t-[var(--pf-burgundy)]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-base">Belagavi Flagship</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pf-gold)]">Main House</span>
              </div>
              <p className="text-xs text-[var(--pf-text-muted)]">
                Kirloskar Road & Khade Bazar intersection, Belagavi, Karnataka 590001
              </p>
              <div className="text-xs space-y-1 font-mono text-[var(--pf-text-subtle)]">
                <div>📞 +91 831 242 1948</div>
                <div>🕒 10:30 AM – 8:30 PM (Daily)</div>
              </div>
              <Link to="/contact" className="w-full pf-btn-secondary text-xs justify-center mt-2">
                Book Consultation
              </Link>
            </div>

            {/* Davanagere */}
            <div className="pf-card p-5 space-y-3 border-t-4 border-t-[var(--pf-gold)]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-base">Davanagere Central</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pf-gold)]">Silk Pavilion</span>
              </div>
              <p className="text-xs text-[var(--pf-text-muted)]">
                Coen Road Commercial Plaza, Davanagere, Karnataka 577002
              </p>
              <div className="text-xs space-y-1 font-mono text-[var(--pf-text-subtle)]">
                <div>📞 +91 8192 234 567</div>
                <div>🕒 10:30 AM – 8:30 PM (Daily)</div>
              </div>
              <Link to="/contact" className="w-full pf-btn-secondary text-xs justify-center mt-2">
                Book Consultation
              </Link>
            </div>

            {/* Shivamogga */}
            <div className="pf-card p-5 space-y-3 border-t-4 border-t-[var(--pf-burgundy)]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-base">Shivamogga Floor</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pf-gold)]">Bridal Floor</span>
              </div>
              <p className="text-xs text-[var(--pf-text-muted)]">
                Vidyanagar Main Complex, Shivamogga, Karnataka 577201
              </p>
              <div className="text-xs space-y-1 font-mono text-[var(--pf-text-subtle)]">
                <div>📞 +91 8182 278 910</div>
                <div>🕒 10:30 AM – 8:30 PM (Daily)</div>
              </div>
              <Link to="/contact" className="w-full pf-btn-secondary text-xs justify-center mt-2">
                Book Consultation
              </Link>
            </div>
          </div>
        </section>

        {/* ── CALL TO ACTION BANNER ─────────────────────────────────────────────── */}
        <section className="pf-container pb-12">
          <div className="rounded-3xl bg-[var(--pf-burgundy)] text-white p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
            <div className="max-w-2xl mx-auto space-y-3 relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--pf-gold)]">
                Private Consultation & Trousseau Planning
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight">
                Register your wedding list before the family arrives.
              </h2>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-lg mx-auto">
                Reserve an exclusive two-hour bridal suite with trial lighting and dedicated styling. We make sure both sides of the family enjoy a relaxed, unhurried counter experience.
              </p>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/contact"
                  className="bg-white text-[var(--pf-burgundy)] hover:bg-[var(--pf-bg-alt)] px-6 py-3 rounded-full text-xs font-bold transition-all shadow-md"
                >
                  Reserve Private Suite
                </Link>
                <Link
                  to="/about"
                  className="border border-white/30 text-white hover:bg-white/10 px-6 py-3 rounded-full text-xs font-bold transition-all"
                >
                  Read Heritage Story
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <ProfileFooter />

      {/* Interactive Modals */}
      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
      <ServiceInquiryModal
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
};

export default ProfileHome;
