import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getSurveyForPreview from '@salesforce/apex/SurveyController.getSurveyForPreview';

export default class SurveyPreview extends LightningElement {
    @track surveyId;
    @track surveyTitle = '';
    @track surveyDescription = '';
    @track questions = [];

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.surveyId = currentPageReference.state?.c__surveyid;
            console.log('📦 Loaded c__surveyid from URL:', this.surveyId);

            if (this.surveyId) {
                this.loadSurvey();
            } else {
                console.warn('⚠️ No c__surveyid in Lightning URL.');
            }
        }
    }

    loadSurvey() {
        getSurveyForPreview({ surveyId: this.surveyId })
            .then(result => {
                this.surveyTitle = result.survey.Survey_Name__c;
                this.surveyDescription = result.survey.Description__c;

                this.questions = result.questions.map(q => {
                    const type = q.Question_Type__c;
                    const options = q.Options || [];
                    return {
                        id: q.Id,
                        label: q.Label__c,
                        type: type,
                        required: q.Required__c,
                        allowMultiple: q.Allow_Multiple__c,
                        order: q.Order__c,
                        options: options,
                        dropdownOptions: options.map(o => ({
                            label: o.Label__c,
                            value: o.Label__c
                        })),
                        isText: type === 'Text',
                        isRadio: type === 'Radio',
                        isCheckbox: type === 'Checkbox',
                        isDropdown: type === 'Dropdown'
                    };
                });
            })
            .catch(error => {
                console.error('❌ Failed to load survey preview:', error);
            });
    }
}
