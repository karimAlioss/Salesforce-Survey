import { LightningElement, wire, track } from 'lwc';
import getPublishedSurveys from '@salesforce/apex/SurveyController.getPublishedSurveys';
import { NavigationMixin } from 'lightning/navigation';

const DESC_CHAR_LIMIT = 180;
const DESC_WORD_LIMIT = 36;

// how many to show initially and per click
const INITIAL_VISIBLE = 6;
const LOAD_STEP = 3;

function truncateSmart(text) {
    if (!text) return '';
    const t = text.trim();
    if (t.length <= DESC_CHAR_LIMIT) {
        const words = t.split(/\s+/);
        if (words.length <= DESC_WORD_LIMIT) return t;
    }
    let cut = t.slice(0, DESC_CHAR_LIMIT);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    return `${cut}…`;
}

export default class SurveyPublicList extends NavigationMixin(LightningElement) {
    @track surveys = [];
    visibleCount = INITIAL_VISIBLE;
    logoUrl = '/sfsites/c/resource/LogoSurvey';
    _io;

    @wire(getPublishedSurveys)
    wiredSurveys({ error, data }) {
        if (data) {
            this.surveys = data.map(s => ({
                ...s,
                Published_Date__c: s.Published_Date__c
                    ? new Date(s.Published_Date__c).toLocaleDateString()
                    : 'Not Set',
                shortDesc: truncateSmart(s.Description__c),
                Response_Count__c: s.Response_Count__c ?? 0,
                Duration_Minutes__c: s.Duration_Minutes__c ?? '--',
                Is_Hot__c: s.Is_Hot__c ?? false
            }));
        } else {
            // eslint-disable-next-line no-console
            console.error('Error fetching surveys', error);
        }
    }

    // visible slice
    get visibleSurveys() {
        return (this.surveys || []).slice(0, this.visibleCount);
    }

    // show the button while more items remain
    get showLoadMore() {
        return (this.surveys?.length || 0) > this.visibleCount;
    }

    // reveal +3 items (or remaining)
    handleLoadMore() {
        const total = this.surveys?.length || 0;
        const next = Math.min(this.visibleCount + LOAD_STEP, total);
        this.visibleCount = next;

        // re-observe newly revealed cards for WOW effect
        this.queueMicrotask(() => {
            this.template
                .querySelectorAll('.reveal:not(.show)')
                .forEach(el => this._io && this._io.observe(el));
        });
    }

    // dynamic columns based on VISIBLE count (1→1, 2→2, ≥3→3)
    get gridClass() {
        const count = this.visibleSurveys.length || 0;
        const n = Math.max(1, Math.min(count, 3));
        return `card-grid cols-${n}`;
    }

    // metrics
    get activeCount() {
        return this.surveys ? this.surveys.length : 0;
    }
    get totalResponses() {
        return (this.surveys || []).reduce((sum, s) => {
            const v = Number(s.Response_Count__c);
            return sum + (isNaN(v) ? 0 : v);
        }, 0);
    }
    get avgEngagement() {
        const vals = (this.surveys || [])
            .map(s => Number(s.Engagement_Score__c))
            .filter(v => !isNaN(v));
        if (!vals.length) return 0;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    handleTakeSurvey(event) {
        const surveyId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'Survey_Preview__c' },
            state: { c__surveyid: surveyId }
        });
    }

    handleFilterClick(event) {
        const type = event.currentTarget.dataset.type;
        // plug your real filtering/sorting later
        // eslint-disable-next-line no-console
        console.log('Filter click:', type);
    }

    // WOW animation
    renderedCallback() {
        if (!this._io) {
            this._io = new IntersectionObserver(
                entries => entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('show');
                        this._io.unobserve(e.target);
                    }
                }),
                { threshold: 0.20 }
            );
        }
        this.template.querySelectorAll('.reveal:not(.show)').forEach(el => this._io.observe(el));
    }

    disconnectedCallback() {
        if (this._io) {
            this._io.disconnect();
            this._io = null;
        }
    }
}
