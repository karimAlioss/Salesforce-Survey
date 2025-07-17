import { LightningElement, track } from 'lwc';
import saveSurveyAndQuestions from '@salesforce/apex/SurveyController.saveSurveyAndQuestions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SurveyBuilder extends LightningElement {

    @track surveyTitle = '';
    @track surveyDescription = '';
    @track category = '';
    @track sections = [];

    categoryOptions = [
        { label: 'Customer Feedback', value: 'Customer Feedback' },
        { label: 'Employee Feedback', value: 'Employee Feedback' },
        { label: 'Event', value: 'Event' },
        { label: 'Market', value: 'Market' },
        { label: 'Product', value: 'Product' },
        { label: 'Service Satisfaction', value: 'Service Satisfaction' }
    ];

    questionTypeOptions = [
        { label: 'Text', value: 'Text' },
        { label: 'Radio', value: 'Radio' },
        { label: 'Checkbox', value: 'Checkbox' },
        { label: 'Dropdown', value: 'Dropdown' }
    ];

    generateId(prefix) {
        return prefix + '_' + Math.random().toString(36).substring(2, 9);
    }

    handleTitleChange(e) {
        this.surveyTitle = e.target.value;
    }

    handleDescriptionChange(e) {
        this.surveyDescription = e.target.value;
    }

    handleCategoryChange(e) {
        this.category = e.detail.value;
    }

    addSection() {
        const newSection = {
            id: this.generateId('section'),
            name: '',
            questions: []
        };
        this.sections = [...this.sections, newSection];
    }

    deleteSection(event) {
        const sectionId = event.target.dataset.id;
        this.sections = this.sections.filter(sec => sec.id !== sectionId);
    }

    handleSectionNameChange(event) {
        const sectionId = event.target.dataset.id;
        const value = event.target.value;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) section.name = value;
            return section;
        });
    }

    addQuestion(event) {
        const sectionId = event.target.dataset.sectionId;
        const newQuestion = {
            id: this.generateId('q'),
            label: '',
            type: 'Text',
            required: false,
            options: undefined,
            allowMultiple: false,
            showToggle: false
        };

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = [...section.questions, newQuestion];
            }
            return section;
        });
    }

    deleteQuestion(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.filter(q => q.id !== questionId);
            }
            return section;
        });
    }

    handleQuestionLabelChange(event) {
        this.updateQuestionField(event, 'label', event.target.value);
    }

    handleQuestionTypeChange(event) {
        const value = event.detail.value;
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId) {
                        q.type = value;
                        q.options = this.isChoiceType(value) ? [] : undefined;
                        q.allowMultiple = false;
                        q.showToggle = value === 'Checkbox';
                    }
                    return q;
                });
            }
            return section;
        });
    }

    handleQuestionRequiredChange(event) {
        this.updateQuestionField(event, 'required', event.target.checked);
    }

    handleAllowMultipleChange(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;
        const value = event.target.checked;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId) q.allowMultiple = value;
                    return q;
                });
            }
            return section;
        });
    }

    updateQuestionField(event, field, value) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId) q[field] = value;
                    return q;
                });
            }
            return section;
        });
    }

    addOption(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId && q.options !== undefined) {
                        q.options.push({
                            id: this.generateId('opt'), // ✅ FIXED: ID is now generated
                            label: ''
                        });
                    }
                    return q;
                });
            }
            return section;
        });
    }

    updateOptionLabel(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;
        const optionId = event.target.dataset.optionId;
        const value = event.target.value;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId && q.options) {
                        q.options = q.options.map(o => {
                            if (o.id === optionId) o.label = value;
                            return o;
                        });
                    }
                    return q;
                });
            }
            return section;
        });
    }

    deleteOption(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;
        const optionId = event.target.dataset.optionId;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId && q.options) {
                        q.options = q.options.filter(o => o.id !== optionId);
                    }
                    return q;
                });
            }
            return section;
        });
    }

    isChoiceType(type) {
        return type === 'Radio' || type === 'Checkbox' || type === 'Dropdown';
    }

    validateBeforeSave() {
        let hasError = false;

        this.sections.forEach(section => {
            section.questions.forEach(q => {
                q.error = '';
                if (!q.label || q.label.trim() === '') {
                    q.error = 'Question label is required';
                    hasError = true;
                }

                if (this.isChoiceType(q.type)) {
                    if (!q.options || q.options.length === 0) {
                        q.error = 'At least one option is required';
                        hasError = true;
                    } else {
                        q.options.forEach(opt => {
                            opt.error = '';
                            if (!opt.label || opt.label.trim() === '') {
                                opt.error = 'Option label is required';
                                hasError = true;
                            }
                        });
                    }
                }
            });
        });

        return !hasError;
    }

    saveSurvey(status) {
        if (!this.surveyTitle || !this.category) {
            alert('Survey title and category are required.');
            return;
        }

        if (!this.validateBeforeSave()) {
            alert('Please fix validation errors before saving.');
            return;
        }

        const flatQuestions = [];

        this.sections.forEach((section, sectionIndex) => {
            if (!section.questions || section.questions.length === 0) return;

            section.questions.forEach((q, questionIndex) => {
                flatQuestions.push({
                    sectionName: section.name,
                    questionLabel: q.label,
                    questionType: q.type,
                    required: q.required,
                    allowMultiple: q.allowMultiple || false,
                    sectionOrder: sectionIndex + 1,
                    questionOrder: questionIndex + 1,
                    options: q.options ? q.options.map((opt, i) => ({
                        label: opt.label,
                        order: i + 1
                    })) : []
                });
            });
        });

        console.log('📦 FLATTENED QUESTIONS:', flatQuestions);

        saveSurveyAndQuestions({
            title: this.surveyTitle,
            description: this.surveyDescription,
            status: status,
            category: this.category,
            questionsJSON: JSON.stringify(flatQuestions)
        })
        .then((surveyId) => {
            console.log('✅ Survey saved with ID:', surveyId);
            this.showToast('Success', 'Survey saved successfully!', 'success');
            this.resetForm();
        })
        .catch(err => {
            console.error('❌ Save error:', err);
            this.showToast('Error', err?.body?.message || 'Unexpected error', 'error');
        });
    }

    handleSaveDraft() {
        this.saveSurvey('Draft');
    }

    handlePublish() {
        this.saveSurvey('Published');
    }

    resetForm() {
        this.surveyTitle = '';
        this.surveyDescription = '';
        this.category = '';
        this.sections = [];
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}
