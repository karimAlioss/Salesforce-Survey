import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getSurveyForPreview from '@salesforce/apex/SurveyController.getSurveyForPreview';
import submitSurveyAnswers from '@salesforce/apex/SurveyAnswerController.submitAnswers';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SurveyPublicPreview extends LightningElement {
    @track surveyId;
    @track surveyTitle = '';
    @track surveyDescription = '';
    @track surveyCategory = '';
    @track isSubmitting = false;
    @track showSuccessScreen = false;
    @track sectionedQuestions = [];

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
                const { survey, questions } = result;
                this.surveyTitle = survey.Survey_Name__c;
                this.surveyDescription = survey.Description__c;
                this.surveyCategory = survey.Category__c;

                const sectionsMap = new Map();
                for (let q of questions) {
                    const section = q.Section__c || 'General';
                    if (!sectionsMap.has(section)) {
                        sectionsMap.set(section, []);
                    }

                    const qType = q.Question_Type__c;
                    const qOptions = q.Options || [];

                    sectionsMap.get(section).push({
                        id: q.Id,
                        label: q.Label__c,
                        type: qType,
                        required: q.Required__c,
                        allowMultiple: q.Allow_Multiple__c,
                        order: q.Order__c,
                        options: qOptions,
                        dropdownOptions: qOptions.map(o => ({ label: o.Label__c, value: o.Label__c })),
                        isText: qType === 'Text',
                        isTextArea: qType === 'Text Area',
                        isNumber: qType === 'Number',
                        isDate: qType === 'Date',
                        isTime: qType === 'Time',
                        isEmail: qType === 'Email',
                        isPhone: qType === 'Phone',
                        isInstruction: qType === 'Instruction',
                        isRadio: qType === 'Radio',
                        isCheckbox: qType === 'Checkbox',
                        isDropdown: qType === 'Dropdown'
                    });
                }

                this.sectionedQuestions = Array.from(sectionsMap, ([sectionName, questions]) => ({
                    sectionName,
                    questions
                }));
            })
            .catch(error => {
                console.error('Failed to load survey for preview:', error);
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

        for (const section of this.sectionedQuestions) {
            for (const q of section.questions) {
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
                    this.dispatchEvent(new ShowToastEvent({
                        title: 'Missing Required Field',
                        message: `Please answer all required questions`,
                        variant: 'error'
                    }));
                    return;
                }
            }
        }

        submitSurveyAnswers({
            surveyId: this.surveyId,
            respondentName,
            respondentEmail,
            sentiment,
            answersJSON: JSON.stringify(filteredAnswers)
        })
            .then(() => {
                this.isSubmitting = false;
                this.showSuccessScreen = true;
            })
            .catch(error => {
                this.isSubmitting = false;
                console.error('Failed to submit answers:', error);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Submission Error',
                    message: error.body?.message || 'An error occurred.',
                    variant: 'error'
                }));
            });
    }

    goToHome() {
        window.location.href = '/survey360/s/success';
    }
}
