import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

/**
 * Carousel component to showcase QR code application projects.
 * Displays one project at a time with navigation arrows.
 * Props:
 *   - projects: array of objects { name, description, tags }
 */
export default function QrProjectsCarousel({ projects }) {
  const [current, setCurrent] = useState(0);
  if (!projects || projects.length === 0) return null;

  const next = () => setCurrent((current + 1) % projects.length);
  const prev = () => setCurrent((current - 1 + projects.length) % projects.length);

  const { name, description, tags } = projects[current];

  return (
    <section className="qr-projects-carousel">
      <h3 className="carousel-title">QR Projects</h3>
      <div className="carousel-content">
        <button className="carousel-nav left" onClick={prev} aria-label="Previous project">
          <ArrowLeft size={20} />
        </button>
        <div className="project-card">
          <h4 className="project-name">{name}</h4>
          <p className="project-description">{description}</p>
          <div className="project-tags">
            {tags.map((t) => (
              <span key={t} className="tag">
                <Check size={12} /> {t}
              </span>
            ))}
          </div>
        </div>
        <button className="carousel-nav right" onClick={next} aria-label="Next project">
          <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}

/* Minimal CSS (can be moved to a dedicated stylesheet) */
const style = `
.qr-projects-carousel { text-align:center; margin-top:2rem; }
.carousel-title { font-size:1.5rem; margin-bottom:1rem; color:#061934; }
.carousel-content { display:flex; align-items:center; justify-content:center; gap:1rem; }
.carousel-nav { background:none; border:none; cursor:pointer; color:#061934; }
.project-card { background:#f9f9f9; padding:1rem; border-radius:8px; max-width:300px; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
.project-name { font-weight:600; margin-bottom:0.5rem; }
.project-description { font-size:0.9rem; margin-bottom:0.5rem; }
.project-tags { display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:center; }
.tag { background:#e0e7ff; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.8rem; display:flex; align-items:center; gap:0.2rem; }
`;

// Inject style into document head when component mounts
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = style;
  document.head.appendChild(styleEl);
}
