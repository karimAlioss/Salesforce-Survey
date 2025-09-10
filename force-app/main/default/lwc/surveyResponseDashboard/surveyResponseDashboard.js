import { LightningElement, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import LightningConfirm from 'lightning/confirm';

import getSurveyResponses from '@salesforce/apex/SurveyAnswerController.getSurveyResponses';
import deleteResponse from '@salesforce/apex/SurveyAnswerController.deleteResponse';

export default class SurveyResponseDashboard extends LightningElement {
  isLoading = true;

  // data
  responses = [];
  displayed = [];
  wiredResult; // for refresh

  _didForceFirstRefresh = false;

  // filters
  searchText = '';
  selectedSurvey = 'ALL';
  selectedStatus = 'ALL';
  selectedSentiment = 'ALL';

  // options
  surveyOptions = [{ label: 'All surveys', value: 'ALL' }];
  statusOptions = [
    { label: 'Any status', value: 'ALL' },
    { label: 'Submitted', value: 'Submitted' },
    { label: 'Draft', value: 'Draft' }
  ];
  sentimentOptions = [
    { label: 'Any sentiment', value: 'ALL' },
    { label: 'Positive', value: 'Positive' },
    { label: 'Neutral', value: 'Neutral' },
    { label: 'Negative', value: 'Negative' }
  ];

  // sort
  sortBy = '';
  sortDir = 'desc';
  sortOptions = [
    { label: 'Date', value: 'date' },
    { label: 'Respondent', value: 'name' },
    { label: 'Survey', value: 'survey' },
    { label: 'Sentiment', value: 'sentiment' },
    { label: 'Status', value: 'status' }
  ];
  get sortDirIcon() {
    return this.sortDir === 'asc' ? 'utility:arrowup' : 'utility:arrowdown';
  }

  // chip labels
  selectedSurveyName = '';
  get selectedSurveyLabel()   { return this.selectedSurveyName || ''; }
  get selectedStatusLabel()   { return this.selectedStatus !== 'ALL' ? this.selectedStatus : ''; }
  get selectedSentimentLabel(){ return this.selectedSentiment !== 'ALL' ? this.selectedSentiment : ''; }
  get hasActiveFilters()      { return !!(this.searchText || this.selectedSurveyLabel || this.selectedStatusLabel || this.selectedSentimentLabel); }
  get displayedCount()        { return this.displayed.length || 0; }

  @wire(getSurveyResponses)
  wired(res) {
    this.wiredResult = res;
    const { data, error } = res;
    if (data) {
      this.responses = data.map(r => {
        const dt = r.Completion_Date__c ? new Date(r.Completion_Date__c)
                 : r.CreatedDate ? new Date(r.CreatedDate) : null;
        const dd = dt ? String(dt.getDate()).padStart(2, '0') : '';
        const mm = dt ? String(dt.getMonth() + 1).padStart(2, '0') : '';
        const yyyy = dt ? dt.getFullYear() : '';
        const hh = dt ? String(dt.getHours()).padStart(2, '0') : '';
        const mn = dt ? String(dt.getMinutes()).padStart(2, '0') : '';
        const completion = dt ? `${dd}/${mm}/${yyyy} ${hh}:${mn}` : '';

        const fb = (r.Customer_Feedback__c || '').trim();
        const short = fb.length > 160 ? fb.slice(0, 157) + '…' : fb;

        const statusCls = `status-badge ${String(r.Status__c).toLowerCase() === 'submitted' ? 'published' : 'draft'}`;
        const sent = (r.Sentiment__c || '').toLowerCase();
        const sentCls =
          sent === 'positive' ? 'sentiment-badge positive' :
          sent === 'neutral'  ? 'sentiment-badge neutral'  :
          sent === 'negative' ? 'sentiment-badge negative' : 'sentiment-badge';

        const category = (r.Survey__r && r.Survey__r.Category__c) ? r.Survey__r.Category__c : '';

        return {
          ...r,
          _completionDate: completion,
          _feedbackShort: short,
          _statusClass: statusCls,
          _sentimentClass: sentCls,
          _category: category
        };
      });

      const uniq = new Map();
      this.responses.forEach(r => { if (r.Survey__c && r.Survey__r) uniq.set(r.Survey__c, r.Survey__r.Survey_Name__c); });
      this.surveyOptions = [{ label: 'All surveys', value: 'ALL' }, ...Array.from(uniq).map(([id, name]) => ({ label: name, value: id }))];

      this.applyFiltersSort();
      this.isLoading = false;

      if (!this._didForceFirstRefresh && this.wiredResult) {
        this._didForceFirstRefresh = true;
        setTimeout(() => refreshApex(this.wiredResult), 0);
      }

    } else if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load responses:', error);
      this.isLoading = false;
    }
  }

  // utils
  normalize(v){ return (v || '').toString().trim().toLowerCase(); }

  applyFiltersSort() {
    const text = this.normalize(this.searchText);
    const key  = this.sortBy || 'date';
    const dir  = this.sortDir === 'asc' ? 1 : -1;

    let list = this.responses.filter(r => {
      const matchesText = !text ||
        this.normalize(r.Respondent_Name__c).includes(text) ||
        this.normalize(r.Respondent_Email__c).includes(text) ||
        this.normalize(r.Respondent_Phone__c).includes(text) ||
        this.normalize(r.Customer_Feedback__c).includes(text) ||
        this.normalize(r.Survey__r ? r.Survey__r.Survey_Name__c : '').includes(text);

      const matchesSurvey    = this.selectedSurvey === 'ALL' || r.Survey__c === this.selectedSurvey;
      const matchesStatus    = this.selectedStatus === 'ALL' || r.Status__c === this.selectedStatus;
      const matchesSentiment = this.selectedSentiment === 'ALL' || r.Sentiment__c === this.selectedSentiment;

      return matchesText && matchesSurvey && matchesStatus && matchesSentiment;
    });

    list.sort((a, b) => {
      let va, vb;
      switch (key) {
        case 'name':
          va = a.Respondent_Name__c || ''; vb = b.Respondent_Name__c || '';
          return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
        case 'survey':
          va = (a.Survey__r ? a.Survey__r.Survey_Name__c : '') || '';
          vb = (b.Survey__r ? b.Survey__r.Survey_Name__c : '') || '';
          return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
        case 'sentiment':
          va = a.Sentiment__c || ''; vb = b.Sentiment__c || '';
          return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
        case 'status':
          va = a.Status__c || ''; vb = b.Status__c || '';
          return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
        case 'date':
        default:
          va = a.Completion_Date__c ? new Date(a.Completion_Date__c).getTime() : new Date(a.CreatedDate).getTime();
          vb = b.Completion_Date__c ? new Date(b.Completion_Date__c).getTime() : new Date(b.CreatedDate).getTime();
          return (va - vb) * dir;
      }
    });

    this.displayed = list;

    if (this.selectedSurvey === 'ALL') {
      this.selectedSurveyName = '';
    } else {
      const opt = this.surveyOptions.find(o => o.value === this.selectedSurvey);
      this.selectedSurveyName = opt ? opt.label : '';
    }
  }

  // handlers
  handleSearch(e){ this.searchText = e.target.value || ''; this.applyFiltersSort(); }
  handleSurveyChange(e){ this.selectedSurvey = e.detail.value; this.applyFiltersSort(); }
  handleStatusChange(e){ this.selectedStatus = e.detail.value; this.applyFiltersSort(); }
  handleSentimentChange(e){ this.selectedSentiment = e.detail.value; this.applyFiltersSort(); }
  handleSortChange(e){ this.sortBy = e.detail.value; this.applyFiltersSort(); }
  toggleSortDir(){ this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'; this.applyFiltersSort(); }
  clearSurvey = () => { this.selectedSurvey = 'ALL'; this.applyFiltersSort(); }
  clearStatus = () => { this.selectedStatus = 'ALL'; this.applyFiltersSort(); }
  clearSentiment = () => { this.selectedSentiment = 'ALL'; this.applyFiltersSort(); }
  clearAll = () => { this.selectedSurvey = 'ALL'; this.selectedStatus = 'ALL'; this.selectedSentiment = 'ALL'; this.searchText = ''; this.applyFiltersSort(); }

  // actions
  openPreview(e){
    const id = e.currentTarget.dataset.id;
    const modal = this.template.querySelector('c-survey-response-preview');
    modal && modal.show(id);
  }
  handlePreviewClose(){ /* no-op */ }

  // when deletion happens from preview modal
  async handlePreviewDeleted() {
    await refreshApex(this.wiredResult);
  }

  // delete from a card
  async handleDelete(e){
    const responseId = e.currentTarget.dataset.id;
    const confirmed = await LightningConfirm.open({
      message: 'Delete this survey response? This will also delete all of its answers.',
      theme: 'warning',
      label: 'Confirm Deletion'
    });
    if (!confirmed) return;

    this.isLoading = true;
    try {
      await deleteResponse({ responseId });
      this.dispatchEvent(new ShowToastEvent({ title: 'Deleted', message: 'Survey response deleted', variant: 'success' }));
      await refreshApex(this.wiredResult);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: err?.body?.message || 'Failed to delete response', variant: 'error' }));
    } finally {
      this.isLoading = false;
    }
  }

  refreshResponses() {
    if (this.wiredResult) {
      refreshApex(this.wiredResult);
    }
  }
}
