import { LightningElement, wire } from 'lwc';
import getPublishedSurveys from '@salesforce/apex/SurveyController.getPublishedSurveys';
import { NavigationMixin } from 'lightning/navigation';

export default class SurveyPublicList extends NavigationMixin(LightningElement) {
    surveys = [];
    error;

    @wire(getPublishedSurveys)
    wiredSurveys({ data, error }) {
        if (data) {
            this.surveys = data;
        } else if (error) {
            this.error = error;
            console.error('Error fetching surveys:', error);
        }
    }

    handleSurveyClick(event) {
        const surveyId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: `/survey-preview?c__surveyid=${surveyId}`
            }
        });
    }
}
