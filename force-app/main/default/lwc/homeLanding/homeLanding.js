import { LightningElement } from 'lwc';

export default class HomeLanding extends LightningElement {
  logoUrl = '/sfsites/c/resource/LogoSurvey';
  heroUrl = '/sfsites/c/resource/HeroSurvey';
  collabUrl = '/sfsites/c/resource/CollabSurvey';
  aiTechUrl = '/sfsites/c/resource/AITechSurvey';

  observer;

  renderedCallback() {
    // Run once
    if (this._wired) return;
    this._wired = true;

    // Targets (no HTML changes – we select existing elements)
    const targets = [
      '.hero__title',
      '.hero__subtitle',
      '.hero__actions .btn',
      '.hero__image img',
      '.ai-features__title',
      '.ai-features__subtitle',
      '.ai-feature',
      '.cta-boost__title',
      '.cta-boost__subtitle',
      '.btn--cta-boost',
      '.split .split__title',
      '.split .split__lead',
      '.split .k-bullets',
      '.split .btn--ghost',
      '.split .split__image img',
      '.testimonials__title',
      '.testimonials__subtitle',
      '.testimonial'
    ].map(sel => Array.from(this.template.querySelectorAll(sel))).flat();

    // Prime elements with "reveal" class
    targets.forEach(el => el && el.classList.add('reveal'));

    // Intersection Observer to add .show when in view
    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
            // Optional: unobserve once animated
            this.observer.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.20 }
    );

    // Observe
    targets.forEach(el => el && this.observer.observe(el));
  }

  disconnectedCallback() {
    if (this.observer) this.observer.disconnect();
  }

  handleHeroError() {
    this.heroUrl =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" font-family="Arial" font-size="32" fill="%239ca3af" text-anchor="middle" dominant-baseline="middle">Hero image not available</text></svg>';
  }
}
