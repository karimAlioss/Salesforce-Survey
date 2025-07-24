import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateSurvey from '@salesforce/apex/SurveyController.updateSurvey';
import getSurveyForPreview from '@salesforce/apex/SurveyController.getSurveyForPreview';
import saveSurveyAndQuestions from '@salesforce/apex/SurveyController.saveSurveyAndQuestions';
import getPicklistValues from '@salesforce/apex/SurveyController.getPicklistValues';

export default class SurveyBuilder extends LightningElement {

    @api surveyId;
    @track surveyTitle = '';
    @track surveyDescription = '';
    @track category = '';
    @track sections = [];
    @track showSuccessScreen = false;

    @track categoryOptions = [];
    @track questionTypeOptions = [];

    connectedCallback() {
        if (this.surveyId) {
            this.loadSurvey();
        }
        this.loadPicklistOptions();
    }

    loadPicklistOptions() {
        getPicklistValues({ objectName: 'Survey__c', fieldName: 'Category__c' })
            .then(data => {
                this.categoryOptions = data.map(item => ({ label: item, value: item }));
            })
            .catch(error => {
                console.error('Error loading category picklist:', error);
            });

        getPicklistValues({ objectName: 'Survey_Question__c', fieldName: 'Question_Type__c' })
            .then(data => {
                this.questionTypeOptions = data.map(item => ({ label: item, value: item }));
            })
            .catch(error => {
                console.error('Error loading question type picklist:', error);
            });
    }

    loadSurvey() {
        getSurveyForPreview({ surveyId: this.surveyId })
            .then(result => {
                const { survey, questions } = result;
                this.surveyTitle = survey.Survey_Name__c;
                this.surveyDescription = survey.Description__c;
                this.category = survey.Category__c;
                this.sections = this.convertQuestionsToSections(questions);
            })
            .catch(error => {
                console.error('❌ Failed to load survey:', error);
            });
    }

    convertQuestionsToSections(questions) {
        const sectionMap = new Map();

        questions.forEach(q => {
            const sectionName = q.Section__c || 'Default Section';
            if (!sectionMap.has(sectionName)) {
                sectionMap.set(sectionName, {
                    id: this.generateId('section'),
                    name: sectionName,
                    questions: []
                });
            }

            const question = {
                id: q.Id,
                label: q.Label__c,
                type: q.Question_Type__c,
                required: q.Required__c,
                allowMultiple: q.Allow_Multiple__c,
                showToggle: q.Question_Type__c === 'Checkbox',

                isTextArea: q.Question_Type__c === 'Text Area',
                isNumber: q.Question_Type__c === 'Number',
                isDate: q.Question_Type__c === 'Date',
                isTime: q.Question_Type__c === 'Time',
                isEmail: q.Question_Type__c === 'Email',
                isPhone: q.Question_Type__c === 'Phone',
                isInstruction: q.Question_Type__c === 'Instruction',

                options: q.Options?.map(opt => ({
                    id: opt.Id,
                    label: opt.Label__c
                })) || []
            };

            sectionMap.get(sectionName).questions.push(question);
        });

        return Array.from(sectionMap.values());
    }

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

                        q.isTextArea = value === 'Text Area';
                        q.isNumber = value === 'Number';
                        q.isDate = value === 'Date';
                        q.isTime = value === 'Time';
                        q.isEmail = value === 'Email';
                        q.isPhone = value === 'Phone';
                        q.isInstruction = value === 'Instruction';
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
                            id: this.generateId('opt'),
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
                    Id: q.id && !q.id.startsWith('q_') ? q.id : null,
                    sectionName: section.name,
                    questionLabel: q.label,
                    questionType: q.type,
                    required: q.required,
                    allowMultiple: q.allowMultiple || false,
                    sectionOrder: sectionIndex + 1,
                    questionOrder: questionIndex + 1,
                    options: q.options ? q.options.map((opt, i) => ({
                        Id: opt.id && !opt.id.startsWith('opt_') ? opt.id : null,
                        label: opt.label,
                        order: i + 1
                    })) : []
                });
            });
        });

        const payload = {
            title: this.surveyTitle,
            description: this.surveyDescription,
            status: status,
            category: this.category,
            questionsJSON: JSON.stringify(flatQuestions)
        };

        const action = this.surveyId
            ? updateSurvey({ surveyId: this.surveyId, ...payload })
            : saveSurveyAndQuestions(payload);

        action
            .then((surveyId) => {
                this.showToast('Success', 'Survey saved successfully!', 'success');
                this.resetForm();
                this.showSuccessScreen = true;
            })
            .catch(err => {
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

    goToDashboard() {
        window.location.href = '/lightning/n/Survey_Manager';
    }

    handleDragStart(event) {
        const sectionId = event.currentTarget.dataset.sectionId;
        const questionId = event.currentTarget.dataset.questionId;
        event.dataTransfer.setData('text/plain', JSON.stringify({ sectionId, questionId }));
    }

    handleDragOver(event) {
        event.preventDefault();
    }

    handleDrop(event) {
        event.preventDefault();
        const from = JSON.parse(event.dataTransfer.getData('text/plain'));
        const toSectionId = event.currentTarget.dataset.sectionId;
        const toQuestionId = event.currentTarget.dataset.questionId;

        if (from.sectionId !== toSectionId) return;

        this.sections = this.sections.map(section => {
            if (section.id !== toSectionId) return section;

            const draggedIndex = section.questions.findIndex(q => q.id === from.questionId);
            const dropIndex = section.questions.findIndex(q => q.id === toQuestionId);

            if (draggedIndex === -1 || dropIndex === -1 || draggedIndex === dropIndex) return section;

            const updatedQuestions = [...section.questions];
            const [movedQuestion] = updatedQuestions.splice(draggedIndex, 1);
            updatedQuestions.splice(dropIndex, 0, movedQuestion);

            // Optionally update questionOrder right away
            updatedQuestions.forEach((q, i) => q.questionOrder = i + 1);

            return { ...section, questions: updatedQuestions };
        });
    }
}
