import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProfileApi } from '../api';
import { ProfileData, SocialLink } from '../types';
import { MapPin, Mail, Phone, Globe, Download, CheckCircle2, Target, Compass, Award, ArrowRight, ExternalLink } from 'lucide-react';

export const ProfileAbout: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [socials, setSocials] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'About Heritage & Profile — BSC Textiles';

    async function loadData() {
      try {
        const [profData, socData] = await Promise.all([
          ProfileApi.getProfile().catch(() => null),
          ProfileApi.getSocialLinks().catch(() => [])
        ]);
        if (profData) setProfile(profData);
        setSocials(socData || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-16">
          {/* Breadcrumb & Title */}
          <div className="space-y-2 border-b border-[var(--pf-border)] pb-8">
            <span className="pf-subheading">About the House & Leadership</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
              {profile?.full_name || 'BSC Textiles'}
            </h1>
            <p className="text-sm sm:text-base text-[var(--pf-gold)] font-medium">
              {profile?.professional_title || 'Master Silk Weavers & Bridal Trousseau Curators Since 1948'}
            </p>
          </div>

          {/* Clean Two-Column Layout on Desktop, Single-Column on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
            {/* Left Column: Visual, Stats, Contact Card, Socials */}
            <div className="lg:col-span-5 space-y-8">
              {/* Profile Portrait */}
              <div className="relative rounded-2xl overflow-hidden border border-[var(--pf-border)] shadow-[var(--pf-shadow-md)] bg-[var(--pf-bg-alt)] aspect-[4/5]">
                <img
                  src={profile?.profile_image || '/images/coll-bridal-1200.webp'}
                  alt={profile?.full_name || 'BSC Textiles'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-black/90 p-4 rounded-xl border border-[var(--pf-border)] shadow-md">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--pf-gold)] block">
                    Leadership & Lineage
                  </span>
                  <span className="font-serif text-sm font-bold text-[var(--pf-text-main)] block">
                    {profile?.founder || 'B. S. Chandrashekhar & Family'}
                  </span>
                  <span className="text-[11px] text-[var(--pf-text-muted)] block">
                    Three Generations of Handloom Stewardship
                  </span>
                </div>
              </div>

              {/* Status & Availability Card */}
              <div className="pf-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Current Availability
                  </span>
                </div>
                <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                  {profile?.availability || 'Open for Private Bridal & VIP Trousseau Consultations.'}
                </p>
                <div className="pt-2">
                  <Link to="/contact" className="w-full pf-btn-primary text-xs justify-center">
                    Reserve Private Consultation
                  </Link>
                </div>
              </div>

              {/* Quick Contact & Details */}
              <div className="pf-card p-5 space-y-3 text-xs">
                <h4 className="font-serif font-bold text-sm text-[var(--pf-text-main)]">Headquarters & Desk</h4>
                <div className="space-y-2 text-[var(--pf-text-muted)]">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0 mt-0.5" />
                    <span>{profile?.location || 'Belagavi · Davanagere · Shivamogga, Karnataka, India'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0" />
                    <a href={`tel:${profile?.phone}`} className="hover:underline font-mono">{profile?.phone || '+91 831 242 1948'}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0" />
                    <a href={`mailto:${profile?.email}`} className="hover:underline">{profile?.email || 'contact@bsctextiles.com'}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[var(--pf-gold)] shrink-0" />
                    <a href={profile?.website} target="_blank" rel="noreferrer" className="hover:underline">{profile?.website || 'https://bsctextiles.com'}</a>
                  </div>
                </div>

                {profile?.resume_url && (
                  <div className="pt-3 border-t border-[var(--pf-border-soft)]">
                    <a
                      href={profile.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full pf-btn-secondary text-xs justify-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Heritage Profile (PDF)</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Social Channels */}
              {socials.length > 0 && (
                <div className="pf-card p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Official Channels</h4>
                  <div className="flex flex-wrap gap-2">
                    {socials.map(soc => (
                      <a
                        key={soc.id}
                        href={soc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] hover:border-[var(--pf-gold)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span>{soc.label}</span>
                        <ExternalLink className="w-3 h-3 text-[var(--pf-text-subtle)]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Full Biography, Mission, Vision, Core Values, Highlights */}
            <div className="lg:col-span-7 space-y-10">
              {/* Comprehensive Biography */}
              <div className="space-y-4">
                <span className="pf-subheading">Career Summary & Lineage</span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--pf-text-main)]">
                  Over Seven Decades at the Counter
                </h2>
                <div className="text-xs sm:text-sm text-[var(--pf-text-muted)] space-y-3 leading-relaxed whitespace-pre-line">
                  {profile?.full_bio || profile?.short_bio}
                </div>
              </div>

              {/* Mission & Vision Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mission */}
                <div className="pf-card p-6 space-y-2 border-l-4 border-l-[var(--pf-burgundy)]">
                  <div className="flex items-center gap-2 text-[var(--pf-burgundy)]">
                    <Target className="w-5 h-5" />
                    <h3 className="font-serif font-bold text-base">Our Mission</h3>
                  </div>
                  <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                    {profile?.mission || 'To preserve and elevate authentic Indian handloom traditions by connecting master weaving communities directly with discerning families.'}
                  </p>
                </div>

                {/* Vision */}
                <div className="pf-card p-6 space-y-2 border-l-4 border-l-[var(--pf-gold)]">
                  <div className="flex items-center gap-2 text-[var(--pf-gold)]">
                    <Compass className="w-5 h-5" />
                    <h3 className="font-serif font-bold text-base">Our Vision</h3>
                  </div>
                  <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                    {profile?.vision || 'To be India’s most trusted bridal silk and heritage textile house, revered for generational integrity, certified pure silk authenticity, and timeless personal care.'}
                  </p>
                </div>
              </div>

              {/* Core Values */}
              <div className="space-y-4">
                <span className="pf-subheading">Guiding Principles</span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[var(--pf-text-main)]">
                  Core Values
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(profile?.core_values || [
                    { title: 'Cloth Opened on the Counter', description: 'You inspect the weave, weight, and luster before you decide — no deceptive packaging or rush.' },
                    { title: 'Silk Mark Certified Authenticity', description: '100% natural Mulberry silk with authentic zari testing and zero synthetic blending.' },
                    { title: 'Master Weavers Lineage', description: 'Direct partnerships with over 88 weaver families across Kanchipuram, Varanasi, and Dharmavaram.' },
                    { title: 'Generational Family Trust', description: 'Serving three generations of families with personalized trousseau records and dedicated private suites.' }
                  ]).map((val, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[var(--pf-bg-card)] border border-[var(--pf-border)] space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--pf-gold)] shrink-0" />
                        <h4 className="font-serif text-sm font-bold text-[var(--pf-text-main)]">{val.title}</h4>
                      </div>
                      <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed pl-6">
                        {val.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Professional Highlights */}
              <div className="space-y-4">
                <span className="pf-subheading">Key Accomplishments</span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[var(--pf-text-main)]">
                  Lineage Highlights
                </h2>
                <div className="p-6 rounded-2xl bg-[var(--pf-bg-alt)] border border-[var(--pf-border)] space-y-3">
                  {(profile?.highlights || [
                    'Founded in 1948 with over 78 continuous years of counter excellence',
                    'Over 14,000 satisfied bridal trousseaus curated across South India',
                    '99.8% customer satisfaction rating across three flagship city destinations',
                    'Official Silk Mark Organization of India certified partner',
                    'Exclusive private bridal consultation suites on upper showroom floors'
                  ]).map((hl, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-[var(--pf-text-main)]">
                      <Award className="w-4 h-4 text-[var(--pf-burgundy)] shrink-0 mt-0.5" />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Banner */}
              <div className="pt-4 flex items-center gap-4">
                <Link to="/experience" className="pf-btn-primary text-xs">
                  <span>Explore Experience Timeline</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/services" className="pf-btn-secondary text-xs">
                  <span>View Services</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ProfileFooter />
    </div>
  );
};

export default ProfileAbout;
