import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getSurveyForPreview from '@salesforce/apex/SurveyController.getSurveyForPreview';
import submitSurveyAnswers from '@salesforce/apex/SurveyAnswerController.submitAnswers';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

export default class SurveyPublicPreview extends LightningElement {
    @track surveyId;
    @track surveyTitle = '';
    @track surveyDescription = '';
    @track surveyCategory = '';
    @track isSubmitting = false;
    @track showSuccessScreen = false;
    @track sectionedQuestions = [];

    answersMap = new Map();

    isPhoneLabel(label) {
        if (!label) return false;
        return /(?:^|\b)(phone|mobile|tel|téléphone|portable)(?:\b|:)/i.test(label);
    }
    looksLikePhone(val) {
        if (val === undefined || val === null) return false;
        const s = String(val).trim();
        return PHONE_REGEX.test(s);
    }
    reportTargetValidity = (evt) => evt?.target?.reportValidity?.();
    validatePhoneInput(input) {
        if (!input) return true;
        const val = (input.value || '').trim();
        if (!val) { input.setCustomValidity(''); input.reportValidity(); return true; }
        const ok = PHONE_REGEX.test(val);
        input.setCustomValidity(ok ? '' : 'Enter a valid phone number (e.g., +33 6 12 34 56 78).');
        input.reportValidity();
        return ok;
    }

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.surveyId = currentPageReference.state?.c__surveyid;
            if (this.surveyId) this.loadSurvey();
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
                const sectionFirstIndex = new Map();

                for (let idx = 0; idx < questions.length; idx++) {
                    const q = questions[idx];
                    const section = q.Section__c || 'General';
                    if (!sectionsMap.has(section)) {
                        sectionsMap.set(section, []);
                        sectionFirstIndex.set(section, idx);
                    }

                    const qType = q.Question_Type__c;
                    const sortedOptions = (q.Options || [])
                        .slice()
                        .sort((a, b) => Number(a.Order__c || 0) - Number(b.Order__c || 0));

                    sectionsMap.get(section).push({
                        id: q.Id,
                        label: q.Label__c,
                        type: qType,
                        required: q.Required__c,
                        allowMultiple: q.Allow_Multiple__c,
                        order: Number(q.Order__c || 0),
                        options: sortedOptions,
                        dropdownOptions: sortedOptions.map(o => ({ label: o.Label__c, value: o.Label__c })),
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

                const sectionArray = Array.from(sectionsMap, ([sectionName, qs]) => ({
                    sectionName,
                    questions: qs.slice().sort((a, b) => a.order - b.order),
                    _firstIndex: sectionFirstIndex.get(sectionName)
                }));
                sectionArray.sort((a, b) => a._firstIndex - b._firstIndex);

                this.sectionedQuestions = sectionArray.map(s => ({
                    sectionName: s.sectionName,
                    questions: s.questions
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

    handlePhoneInputChange = (event) => {
        const input = event.target;
        const questionId = input.dataset.questionId;
        const value = input.value;
        this.validatePhoneInput(input);
        this.answersMap.set(questionId, value);
    };

    handleCheckboxChange(event) {
        const questionId = event.target.dataset.questionId;
        const optionValue = event.target.dataset.optionValue;
        let existing = this.answersMap.get(questionId) || [];
        if (event.target.checked) existing.push(optionValue);
        else existing = existing.filter(v => v !== optionValue);
        this.answersMap.set(questionId, existing);
    }

    handleSubmit() {
        this.isSubmitting = true;

        const phoneInputs = this.template.querySelectorAll('lightning-input[data-input="phone"]');
        for (const el of phoneInputs) {
            if (!this.validatePhoneInput(el)) {
                this.isSubmitting = false;
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Invalid phone number',
                    message: 'Please fix the phone number format.',
                    variant: 'error'
                }));
                return;
            }
        }

        let respondentName = '';
        let respondentEmail = '';
        let respondentPhone = '';
        const sentiment = null;
        const filteredAnswers = [];

        for (const section of this.sectionedQuestions) {
            for (const q of section.questions) {
                const value = this.answersMap.get(q.id);

                if (q.label && q.label.toLowerCase().includes('name')) {
                    respondentName = value || respondentName;
                }
                if (q.type === 'Email') {
                    respondentEmail = value || respondentEmail;
                }
                if (!respondentPhone) {
                    if (q.type === 'Phone' && value) {
                        respondentPhone = value;
                    } else if (this.isPhoneLabel(q.label) && this.looksLikePhone(value)) {
                        respondentPhone = value;
                    }
                }

                if (q.isCheckbox) {
                    const arr = Array.isArray(value) ? value : [];
                    if (arr.length > 0) {
                        filteredAnswers.push({ questionId: q.id, answer: arr.join('; '), type: q.type });
                    } else if (q.required) {
                        this.isSubmitting = false;
                        this.dispatchEvent(new ShowToastEvent({
                            title: 'Missing Required Field',
                            message: `Please answer all required questions`,
                            variant: 'error'
                        }));
                        return;
                    }
                    continue;
                }

                const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
                if (hasValue) {
                    filteredAnswers.push({ questionId: q.id, answer: Array.isArray(value) ? value.join('; ') : value, type: q.type });
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
            respondentPhone,
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

    goToHome() { window.location.href = '/survey360'; }
}
