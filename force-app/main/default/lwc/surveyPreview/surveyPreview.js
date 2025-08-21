import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSurveyForPreview from '@salesforce/apex/SurveyController.getSurveyForPreview';
import submitSurveyAnswers from '@salesforce/apex/SurveyAnswerController.submitAnswers';

export default class SurveyPreview extends LightningElement {
    @track surveyId;
    @track surveyTitle = '';
    @track surveyDescription = '';
    @track questions = [];
    @track showSuccessScreen = false;
    @track isSubmitting = false;
    
    answersMap = new Map();

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.surveyId = currentPageReference.state?.c__surveyid;
            if (this.surveyId) {
                this.loadSurvey();
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
                        isTextArea: type === 'Text Area',
                        isNumber: type === 'Number',
                        isDate: type === 'Date',
                        isTime: type === 'Time',
                        isEmail: type === 'Email',
                        isPhone: type === 'Phone',
                        isInstruction: type === 'Instruction',
                        isRadio: type === 'Radio',
                        isCheckbox: type === 'Checkbox',
                        isDropdown: type === 'Dropdown'
                    };
                });
            })
            .catch(error => {
                console.error('Failed to load survey:', error);
            });
    }

    handleInputChange(event) {
        const questionId = event.target.dataset.questionId;
        const value = event.detail.value || event.target.value;
        this.answersMap.set(questionId, value);
    }

    handleCheckboxChange(event) {
        const questionId = event.target.dataset.questionId;
        const optionValue = event.target.dataset.optionValue;
        let existing = this.answersMap.get(questionId) || [];

        if (event.target.checked) {
            existing.push(optionValue);
        } else {
            existing = existing.filter(v => v !== optionValue);
        }

        this.answersMap.set(questionId, existing);
    }

    handleSubmit() {
        this.isSubmitting = true;

        let respondentName = '';
        let respondentEmail = '';
        const sentiment = null;
        const filteredAnswers = [];

        for (const q of this.questions) {
            const value = this.answersMap.get(q.id);

            if (q.label.toLowerCase().includes('name')) {
                respondentName = value || '';
                continue;
            }

            if (q.type === 'Email') {
                respondentEmail = value || '';
                continue;
            }

            if ((value !== undefined && value !== null && value !== '') || q.isCheckbox) {
                filteredAnswers.push({
                    questionId: q.id,
                    answer: Array.isArray(value) ? value.join('; ') : value,
                    type: q.type
                });
            } else if (q.required) {
                this.isSubmitting = false;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Missing Required Field',
                        message: `Please answer required question`,
                        variant: 'error',
                        mode: 'dismissable'
                    })
                );
                return;
            }
        }

        submitSurveyAnswers({
            surveyId: this.surveyId,
            respondentName: respondentName,
            respondentEmail: respondentEmail,
            sentiment,
            answersJSON: JSON.stringify(filteredAnswers)
        })
            .then(() => {
                this.isSubmitting = false;
                this.showSuccessScreen = true;
            })
            .catch(error => {
                this.isSubmitting = false;
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error?.body?.message || 'Error submitting survey.',
                    variant: 'error'
                }));
                console.error('Failed to submit answers:', error);
            });
    }
    goToHome() {
        window.location.href = '/lightning/n/Survey_Manager';
    }
}
