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

    draggedSectionId = null;

    connectedCallback() {
        if (this.surveyId) this.loadSurvey();
        this.loadPicklistOptions();
    }

    loadPicklistOptions() {
        getPicklistValues({ objectName: 'Survey__c', fieldName: 'Category__c' })
            .then(data => { this.categoryOptions = data.map(item => ({ label: item, value: item })); })
            .catch(error => console.error('Error loading category picklist:', error));

        getPicklistValues({ objectName: 'Survey_Question__c', fieldName: 'Question_Type__c' })
            .then(data => { this.questionTypeOptions = data.map(item => ({ label: item, value: item })); })
            .catch(error => console.error('Error loading question type picklist:', error));
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
            .catch(error => console.error('❌ Failed to load survey:', error));
    }

    convertQuestionsToSections(questions) {
        const sectionMap = new Map();
        const firstIndex = new Map();

        questions.forEach((q, idx) => {
            const sectionName = q.Section__c || 'Default Section';
            if (!sectionMap.has(sectionName)) {
                sectionMap.set(sectionName, {
                    id: this.generateId('section'),
                    name: sectionName,
                    questions: [],
                    collapsed: false,
                    iconName: 'utility:chevronup'
                });
                firstIndex.set(sectionName, idx);
            }

            const isChoice = this.isChoiceType(q.Question_Type__c);
            const mappedOptions = isChoice && q.Options
                ? q.Options.map(opt => ({ id: opt.Id, label: opt.Label__c }))
                : undefined;

            const question = {
                id: q.Id,
                label: q.Label__c,
                type: q.Question_Type__c,
                required: q.Required__c,
                allowMultiple: q.Allow_Multiple__c,
                showToggle: q.Question_Type__c === 'Checkbox',

                isTextArea: q.Question_Type__c === 'Text Area',
                isNumber:   q.Question_Type__c === 'Number',
                isDate:     q.Question_Type__c === 'Date',
                isTime:     q.Question_Type__c === 'Time',
                isEmail:    q.Question_Type__c === 'Email',
                isPhone:    q.Question_Type__c === 'Phone',
                isInstruction: q.Question_Type__c === 'Instruction',

                isChoice,
                options: mappedOptions
            };

            sectionMap.get(sectionName).questions.push(question);
        });

        const sectionsArr = Array.from(sectionMap.values());
        sectionsArr.sort((a, b) => firstIndex.get(a.name) - firstIndex.get(b.name));
        return sectionsArr;
    }

    generateId(prefix) {
        return prefix + '_' + Math.random().toString(36).substring(2, 9);
    }

    // Header
    handleTitleChange(e) { this.surveyTitle = e.target.value; }
    handleDescriptionChange(e) { this.surveyDescription = e.target.value; }
    handleCategoryChange(e) { this.category = e.detail.value; }

    // Section CRUD
    addSection() {
        const newSection = {
            id: this.generateId('section'),
            name: '',
            questions: [],
            collapsed: false,
            iconName: 'utility:chevronup'
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

    toggleSectionCollapse(event) {
        const sectionId = event.target.dataset.id;
        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.collapsed = !section.collapsed;
                section.iconName = section.collapsed ? 'utility:chevrondown' : 'utility:chevronup';
            }
            return section;
        });
    }

    // Section DnD (handle-only)
    handleSectionDragStart(event) {
        if (!event.target.closest || !event.target.closest('.drag-handle-section')) {
            event.preventDefault();
            return;
        }
        this.draggedSectionId = event.currentTarget.dataset.sectionId;
        try {
            event.dataTransfer.setData('text/section', this.draggedSectionId);
            event.dataTransfer.effectAllowed = 'move';
        } catch (e) {}
    }
    handleSectionDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
    handleSectionDrop(event) {
        event.preventDefault();
        const targetSectionId = event.currentTarget.dataset.sectionId;
        let draggedId;
        try { draggedId = event.dataTransfer.getData('text/section'); } catch (e) { draggedId = this.draggedSectionId; }
        if (!draggedId || draggedId === targetSectionId) return;

        const fromIndex = this.sections.findIndex(s => s.id === draggedId);
        const toIndex = this.sections.findIndex(s => s.id === targetSectionId);
        if (fromIndex === -1 || toIndex === -1) return;

        const newSections = [...this.sections];
        const [moved] = newSections.splice(fromIndex, 1);
        newSections.splice(toIndex, 0, moved);
        this.sections = newSections;
        this.draggedSectionId = null;
    }

    // Question CRUD
    addQuestion(event) {
        const sectionId = event.target.dataset.sectionId;
        const newQuestion = {
            id: this.generateId('q'),
            label: '',
            type: 'Text',
            required: false,
            options: undefined,
            allowMultiple: false,
            showToggle: false,
            isChoice: false,
            isTextArea: false,
            isNumber: false,
            isDate: false,
            isTime: false,
            isEmail: false,
            isPhone: false,
            isInstruction: false
        };
        this.sections = this.sections.map(section => {
            if (section.id === sectionId) section.questions = [...section.questions, newQuestion];
            return section;
        });
    }
    deleteQuestion(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;
        this.sections = this.sections.map(section => {
            if (section.id === sectionId) section.questions = section.questions.filter(q => q.id !== questionId);
            return section;
        });
    }
    handleQuestionLabelChange(event) { this.updateQuestionField(event, 'label', event.target.value); }
    handleQuestionTypeChange(event) {
        const value = event.detail.value;
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;

        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId) {
                        q.type = value;
                        const nowChoice = this.isChoiceType(value);
                        q.isChoice = nowChoice;
                        q.options = nowChoice ? (q.options ?? []) : undefined;
                        q.allowMultiple = false;
                        q.showToggle = value === 'Checkbox';
                        q.isTextArea = value === 'Text Area';
                        q.isNumber   = value === 'Number';
                        q.isDate     = value === 'Date';
                        q.isTime     = value === 'Time';
                        q.isEmail    = value === 'Email';
                        q.isPhone    = value === 'Phone';
                        q.isInstruction = value === 'Instruction';
                    }
                    return q;
                });
            }
            return section;
        });
    }
    handleQuestionRequiredChange(event) { this.updateQuestionField(event, 'required', event.target.checked); }
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

    // Options
    addOption(event) {
        const sectionId = event.target.dataset.sectionId;
        const questionId = event.target.dataset.questionId;
        this.sections = this.sections.map(section => {
            if (section.id === sectionId) {
                section.questions = section.questions.map(q => {
                    if (q.id === questionId && q.isChoice) {
                        if (!q.options) q.options = [];
                        q.options.push({ id: this.generateId('opt'), label: '' });
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
                    if (q.id === questionId && q.isChoice && q.options) {
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
                    if (q.id === questionId && q.isChoice && q.options) {
                        q.options = q.options.filter(o => o.id !== optionId);
                    }
                    return q;
                });
            }
            return section;
        });
    }

    // Question DnD (handle-only)
    handleQuestionDragStart(event) {
        if (!event.target.closest || !event.target.closest('.drag-handle')) {
            event.preventDefault();
            return;
        }
        const sectionId = event.currentTarget.dataset.sectionId;
        const questionId = event.currentTarget.dataset.questionId;
        event.dataTransfer.setData('text/plain', JSON.stringify({ sectionId, questionId }));
        event.dataTransfer.effectAllowed = 'move';
    }
    handleQuestionDragOver(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
    handleQuestionDrop(event) {
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
            updatedQuestions.forEach((q, i) => q.questionOrder = i + 1);
            return { ...section, questions: updatedQuestions };
        });
    }

    isChoiceType(type) { return type === 'Radio' || type === 'Checkbox' || type === 'Dropdown'; }

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
        let globalOrder = 0;

        this.sections.forEach((section, sectionIndex) => {
            if (!section.questions || section.questions.length === 0) return;
            section.questions.forEach(q => {
                globalOrder += 1;
                flatQuestions.push({
                    Id: q.id && !String(q.id).startsWith('q_') ? q.id : null,
                    sectionName: section.name,
                    questionLabel: q.label,
                    questionType: q.type,
                    required: q.required,
                    allowMultiple: q.allowMultiple || false,
                    sectionOrder: sectionIndex + 1,
                    questionOrder: globalOrder,
                    options: this.isChoiceType(q.type) && q.options ? q.options.map((opt, i) => ({
                        Id: opt.id && !String(opt.id).startsWith('opt_') ? opt.id : null,
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
            .then(() => {
                this.showToast('Success', 'Survey saved successfully!', 'success');
                this.resetForm();
                this.showSuccessScreen = true;
            })
            .catch(err => this.showToast('Error', err?.body?.message || 'Unexpected error', 'error'));
    }

    handleSaveDraft() { this.saveSurvey('Draft'); }
    handlePublish()   { this.saveSurvey('Published'); }

    resetForm() { this.surveyTitle = ''; this.surveyDescription = ''; this.category = ''; this.sections = []; }

    showToast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }

    goToDashboard() { window.location.href = '/lightning/n/Survey_Manager'; }
}
