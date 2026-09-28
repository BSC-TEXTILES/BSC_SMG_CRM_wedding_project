import React, { useState } from 'react';
import { ProjectItem } from '../types';
import { X, ExternalLink, CheckCircle2 } from 'lucide-react';

interface ProjectDetailModalProps {
  project: ProjectItem | null;
  onClose: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, onClose }) => {
  const [activeImg, setActiveImg] = useState<string>('');

  if (!project) return null;

  const currentImage = activeImg || project.cover_image;
  const galleryImages = [project.cover_image, ...(project.gallery || [])].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--pf-border)] bg-[var(--pf-bg-alt)]">
          <div>
            <span className="pf-badge-gold text-[10px] mb-1 inline-block">{project.category}</span>
            <h2 className="font-serif text-lg sm:text-2xl font-bold text-[var(--pf-text-main)]">
              {project.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg)] hover:text-[var(--pf-text-main)] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Main Visual */}
          <div className="space-y-3">
            <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/10 border border-[var(--pf-border)]">
              <img
                src={currentImage}
                alt={project.title}
                className="w-full h-full object-cover transition-all duration-300"
              />
            </div>
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImg(img)}
                    className={`relative w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      currentImage === img ? 'border-[var(--pf-gold)] scale-95 shadow-xs' : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Gallery thumbnail ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--pf-bg-alt)] p-4 rounded-xl text-xs border border-[var(--pf-border-soft)]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Client / Family</span>
              <span className="font-semibold text-[var(--pf-text-main)]">{project.client_name || 'BSC Signature Patron'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Role / Craft</span>
              <span className="font-semibold text-[var(--pf-text-main)]">{project.role || 'Curator'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Completion</span>
              <span className="font-semibold text-[var(--pf-text-main)]">{project.completion_date}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--pf-text-subtle)] block">Certification</span>
              <span className="font-semibold text-[var(--pf-gold)]">Silk Mark Guaranteed</span>
            </div>
          </div>

          {/* Narrative */}
          <div className="space-y-2">
            <h4 className="font-serif text-base font-bold text-[var(--pf-text-main)]">Project Narrative & Craftsmanship</h4>
            <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed whitespace-pre-line">
              {project.full_description || project.short_description}
            </p>
          </div>

          {/* Technologies / Craft Weaving elements */}
          {project.technologies && project.technologies.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Materials & Techniques</h4>
              <div className="flex flex-wrap gap-1.5">
                {project.technologies.map((tech, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-md bg-[var(--pf-bg-alt)] text-[var(--pf-text-main)] text-xs font-semibold border border-[var(--pf-border)]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results / Achievements */}
          {project.results && project.results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--pf-gold)]">Key Highlights & Results</h4>
              <ul className="space-y-1.5">
                {project.results.map((res, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--pf-text-muted)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{res}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[var(--pf-border)] bg-[var(--pf-bg-alt)] flex items-center justify-between">
          <div className="text-xs text-[var(--pf-text-subtle)]">
            Heritage Archive ID: #{project.id}
          </div>
          <div className="flex items-center gap-3">
            {project.project_url && (
              <a
                href={project.project_url}
                target="_blank"
                rel="noreferrer"
                className="pf-btn-secondary text-xs"
              >
                <span>View Live Reference</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onClose} className="pf-btn-primary text-xs">
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailModal;
