import { LightningElement, wire } from 'lwc';
import getSurveys from '@salesforce/apex/SurveyController.getAllSurveys';
import deleteSurvey from '@salesforce/apex/SurveyController.deleteSurvey';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import deleteSurveyAndData from '@salesforce/apex/SurveyController.deleteSurveyAndData';
import { refreshApex } from '@salesforce/apex';

export default class SurveyDashboard extends LightningElement {
    // data
    surveys = [];
    displayed = [];
    isLoading = true;
    wiredSurveysResult;
    // Modal state for 3-option delete
    showDeletePrompt = false;
    isDeleting = false;
    pendingSurveyId = null;

    // filters
    searchText = '';
    selectedCategory = 'ALL';
    selectedStatus = 'ALL';

    categoryOptions = [{ label: 'Any category', value: 'ALL' }];
    statusOptions = [
        { label: 'Any status', value: 'ALL' },
        { label: 'Published', value: 'Published' },
        { label: 'Draft', value: 'Draft' }
    ];

    // sort
    sortBy = ''; // empty → placeholder shows; default to date in code
    sortDir = 'desc';
    sortOptions = [
        { label: 'Date', value: 'date' },
        { label: 'Name', value: 'name' },
        { label: 'Category', value: 'category' },
        { label: 'Status', value: 'status' }
    ];
    get sortDirIcon() {
        return this.sortDir === 'asc' ? 'utility:arrowup' : 'utility:arrowdown';
    }

    // chips + count
    get selectedCategoryLabel() {
        return this.selectedCategory !== 'ALL' ? this.selectedCategory : '';
    }
    get selectedStatusLabel() {
        return this.selectedStatus !== 'ALL' ? this.selectedStatus : '';
    }
    get hasActiveFilters() {
        return !!(this.selectedCategoryLabel || this.selectedStatusLabel || this.searchText);
    }
    get filteredCount() {
        return this.displayed.length || 0;
    }
    get noSurveys() {
        return !this.displayed || this.displayed.length === 0;
    }

    // wire
    @wire(getSurveys)
    wiredSurveys(result) {
        this.wiredSurveysResult = result;
        const { data, error } = result;

        if (data) {
            // enrich rows
            this.surveys = data.map(s => {
                const created = new Date(s.CreatedDate);
                const dd = String(created.getDate()).padStart(2, '0');
                const mm = String(created.getMonth() + 1).padStart(2, '0');
                const yyyy = created.getFullYear();
                const createdDate = `${dd}/${mm}/${yyyy}`;

                const statusClass = `status-badge ${String(s.Status__c).toLowerCase() === 'published' ? 'published' : 'draft'}`;

                return {
                    ...s,
                    _createdByName: s.CreatedBy ? s.CreatedBy.Name : '',
                    _createdDate: createdDate,
                    _statusClass: statusClass
                };
            });

            this.buildCategoryOptions();
            this.applyFiltersSort();
            this.isLoading = false;
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Error loading surveys:', error);
            this.isLoading = false;
        }
    }

    // utils
    normalize(v) {
        return (v || '').toString().trim().toLowerCase();
    }

    buildCategoryOptions() {
        const uniq = Array.from(new Set(this.surveys.map(s => s.Category__c).filter(Boolean)));
        this.categoryOptions = [{ label: 'Any category', value: 'ALL' }, ...uniq.map(x => ({ label: x, value: x }))];
    }

    applyFiltersSort() {
        const text = this.normalize(this.searchText);
        const key = this.sortBy || 'date';
        const dir = this.sortDir === 'asc' ? 1 : -1;

        let list = this.surveys.filter(s => {
            const matchesText =
                !text ||
                this.normalize(s.Survey_Name__c).includes(text) ||
                this.normalize(s._createdByName || '').includes(text);

            const matchesCat = this.selectedCategory === 'ALL' || s.Category__c === this.selectedCategory;
            const matchesStatus = this.selectedStatus === 'ALL' || s.Status__c === this.selectedStatus;

            return matchesText && matchesCat && matchesStatus;
        });

        list.sort((a, b) => {
            let va, vb;
            switch (key) {
                case 'name':
                    va = a.Survey_Name__c || ''; vb = b.Survey_Name__c || '';
                    return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
                case 'status':
                    va = a.Status__c || ''; vb = b.Status__c || '';
                    return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
                case 'category':
                    va = a.Category__c || ''; vb = b.Category__c || '';
                    return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * dir;
                case 'date':
                default:
                    va = new Date(a.CreatedDate).getTime();
                    vb = new Date(b.CreatedDate).getTime();
                    return (va - vb) * dir;
            }
        });

        this.displayed = list;
    }

    // handlers: filters & sort
    handleSearch(e) {
        this.searchText = e.target.value || '';
        this.applyFiltersSort();
    }
    handleCategoryChange(e) {
        this.selectedCategory = e.detail.value;
        this.applyFiltersSort();
    }
    handleStatusChange(e) {
        this.selectedStatus = e.detail.value;
        this.applyFiltersSort();
    }
    handleSortChange(e) {
        this.sortBy = e.detail.value;
        this.applyFiltersSort();
    }
    toggleSortDir() {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        this.applyFiltersSort();
    }
    clearCategory = () => { this.selectedCategory = 'ALL'; this.applyFiltersSort(); }
    clearStatus   = () => { this.selectedStatus = 'ALL'; this.applyFiltersSort(); }
    clearAll      = () => { this.selectedCategory = 'ALL'; this.selectedStatus = 'ALL'; this.searchText = ''; this.applyFiltersSort(); }

    // actions
    handleEdit(event) {
        const surveyId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('editsurvey', { detail: { surveyId } }));
    }
    handleCreateNew() {
        this.dispatchEvent(new CustomEvent('createnew'));
    }
    handleTogglePreview(event) {
        const surveyId = event.currentTarget.dataset.id;
        window.open('/lightning/n/Survey_Preview?c__surveyid=' + surveyId, '_blank');
    }
    handleDeleteSurvey(event) {
        const surveyId = event.currentTarget.dataset.id;
        if (!confirm('Are you sure you want to delete this survey?')) return;
        this.isLoading = true;

        deleteSurvey({ surveyId })
            .then(() => {
                this.surveys = this.surveys.filter(s => s.Id !== surveyId);
                this.showToast('Deleted', 'Survey deleted successfully', 'success');
                return refreshApex(this.wiredSurveysResult);
            })
            .then(() => {
                this.applyFiltersSort();
                this.isLoading = false;
            })
            .catch(err => {
                // eslint-disable-next-line no-console
                console.error('Delete error:', err);
                this.isLoading = false;
                this.showToast('Error', err?.body?.message || 'Failed to delete survey', 'error');
            });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Open the 3-choice delete modal
    openDeletePrompt(event) {
        const id = event?.currentTarget?.dataset?.id;
        if (!id) return;
        this.pendingSurveyId = id;
        this.showDeletePrompt = true;
    }

    // Close the modal (prevent closing during deletion)
    closeDeletePrompt() {
        if (this.isDeleting) return;
        this.showDeletePrompt = false;
        this.pendingSurveyId = null;
    }

    // Backdrop click closes the modal
    onBackdropClick() {
        this.closeDeletePrompt();
    }

    // Option 1: Delete Survey (Survey + Questions + Options) using your existing Apex method
    async confirmDeleteSurveyOnly() {
        if (!this.pendingSurveyId) return;

        this.isDeleting = true;
        try {
            await deleteSurvey({ surveyId: this.pendingSurveyId });

            // Refresh server data → keep your wire-based refresh
            await refreshApex(this.wiredSurveysResult);

            // Local UI list update (optional safety)
            this.surveys = this.surveys.filter(s => s.Id !== this.pendingSurveyId);
            this.applyFiltersSort();

            this.showToast('Survey deleted', 'Survey, Questions, and Options have been deleted.', 'success');
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Delete survey only error:', err);
            this.showToast('Delete blocked', err?.body?.message || 'This survey cannot be deleted.', 'warning');
        } finally {
            this.isDeleting = false;
            this.closeDeletePrompt();
        }
    }

    // Option 2: Delete Survey + ALL data (Responses + Answers too) using the new Apex method
    async confirmDeleteAll() {
        if (!this.pendingSurveyId) return;

        this.isDeleting = true;
        try {
            await deleteSurveyAndData({ surveyId: this.pendingSurveyId });

            // Refresh server data
            await refreshApex(this.wiredSurveysResult);

            // Local UI list update (optional safety)
            this.surveys = this.surveys.filter(s => s.Id !== this.pendingSurveyId);
            this.applyFiltersSort();

            this.showToast('Survey and related data deleted', 'Survey, Questions, Options, Responses, and Answers have been deleted.', 'success');
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Delete all data error:', err);
            this.showToast('Error', err?.body?.message || 'Failed to delete survey and related data', 'error');
        } finally {
            this.isDeleting = false;
            this.closeDeletePrompt();
        }
    }

}
