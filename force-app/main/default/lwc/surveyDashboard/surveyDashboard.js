import { LightningElement, wire } from 'lwc';
import getSurveys from '@salesforce/apex/SurveyController.getAllSurveys';
import deleteSurvey from '@salesforce/apex/SurveyController.deleteSurvey';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class SurveyDashboard extends LightningElement {
    surveys = [];
    isLoading = true;
    wiredSurveysResult;

    get noSurveys() {
        return !this.surveys || this.surveys.length === 0;
    }

    @wire(getSurveys)
    wiredSurveys(result) {
        this.wiredSurveysResult = result;

        const { data, error } = result;
        if (data) {
            this.surveys = data;
            this.isLoading = false;
        } else if (error) {
            console.error('Error loading surveys:', error);
            this.isLoading = false;
        }
    }

    handleEdit(event) {
        const surveyId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('editsurvey', {
            detail: { surveyId }
        }));
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
                this.showToast('Deleted', 'Survey deleted successfully', 'success');
                return refreshApex(this.wiredSurveysResult);
            })
            .then(() => {
                this.isLoading = false;
            })
            .catch(err => {
                console.error('Delete error:', err);
                this.isLoading = false;
                this.showToast('Error', err?.body?.message || 'Failed to delete survey', 'error');
            });
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