import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';

import getResponseDetail from '@salesforce/apex/SurveyAnswerController.getResponseDetail';
import deleteResponse from '@salesforce/apex/SurveyAnswerController.deleteResponse';

export default class SurveyResponsePreview extends LightningElement {
  @api responseId;
  @track open = false;
  @track loading = false;

  // loaded data
  resp;
  answers = [];

  /** Public API */
  @api show(id){
    this.responseId = id;
    this.open = true;
    this.fetch();
  }
  @api hide(){
    this.open = false;
  }

  fetch(){
    if(!this.responseId) return;
    this.loading = true;
    getResponseDetail({ responseId: this.responseId })
      .then(({ response, answers }) => {
        this.resp = response;
        this.answers = answers || [];
        this.loading = false;
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('Preview load error', err);
        this.loading = false;
      });
  }

  // ---------- derived getters ----------
  get headerName(){ return this.resp?.Respondent_Name__c || this.resp?.Name || 'Survey Response'; }
  get respondentName(){ return this.resp?.Respondent_Name__c || '—'; }
  get email(){ return this.resp?.Respondent_Email__c || '—'; }
  get phone(){ return this.resp?.Respondent_Phone__c || '—'; }
  get status(){ return this.resp?.Status__c; }
  get sentiment(){ return this.resp?.Sentiment__c; }
  get surveyName(){ return this.resp?.Survey__r?.Survey_Name__c; }
  get category(){ return this.resp?.Survey__r?.Category__c; }
  get createdBy(){ return this.resp?.CreatedBy?.Name || '—'; }

  get completion(){
    const v = this.resp?.Completion_Date__c || this.resp?.CreatedDate;
    if(!v) return '—';
    const d = new Date(v);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  get feedback(){ return this.resp?.Customer_Feedback__c; }

  get statusClass(){
    const st = (this.status || '').toLowerCase();
    return `status-badge ${st === 'submitted' ? 'published' : 'draft'}`;
  }
  get sentimentClass(){
    const s = (this.sentiment || '').toLowerCase();
    return s === 'positive' ? 'sentiment-badge positive'
         : s === 'neutral'  ? 'sentiment-badge neutral'
         : s === 'negative' ? 'sentiment-badge negative'
         : 'sentiment-badge';
  }

  get sectioned(){
    const map = new Map();
    (this.answers || []).forEach(a => {
      const sec = a?.Survey_Question__r?.Section__c || 'Default Section';
      if(!map.has(sec)) map.set(sec, []);
      map.get(sec).push({
        id: a.Id,
        label: a?.Survey_Question__r?.Label__c || '(Question)',
        order: Number(a?.Survey_Question__r?.Order__c || 0),
        answer: a?.Answer__c || ''
      });
    });
    return Array.from(map, ([name, items]) => ({
      name,
      items: items.sort((x,y)=>x.order - y.order)
    }));
  }

  get responseUrl(){ return this.resp ? `/lightning/r/Survey_Response__c/${this.resp.Id}/view` : '#'; }

  emitClose(){ this.hide(); this.dispatchEvent(new CustomEvent('close')); }
  closeByBackdrop(e){ if(e.target.classList.contains('backdrop')) this.emitClose(); }

  // Delete from within the modal
  async deleteCurrent(){
    if (!this.resp?.Id) return;

    const confirmed = await LightningConfirm.open({
      message: 'Delete this survey response? This will also delete all of its answers.',
      theme: 'warning',
      label: 'Confirm Deletion'
    });
    if (!confirmed) return;

    this.loading = true;
    try {
      await deleteResponse({ responseId: this.resp.Id });
      this.dispatchEvent(new ShowToastEvent({ title: 'Deleted', message: 'Survey response deleted', variant: 'success' }));
      this.emitClose();
      // notify parent to refresh
      this.dispatchEvent(new CustomEvent('deleted'));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: err?.body?.message || 'Failed to delete response', variant: 'error' }));
    } finally {
      this.loading = false;
    }
  }
}
