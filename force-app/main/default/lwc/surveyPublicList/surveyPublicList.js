import { LightningElement, wire, track } from 'lwc';
import getPublishedSurveys from '@salesforce/apex/SurveyController.getPublishedSurveys';
import { NavigationMixin } from 'lightning/navigation';

export default class SurveyPublicList extends NavigationMixin(LightningElement) {
    @track surveys = [];

    @wire(getPublishedSurveys)
    wiredSurveys({ error, data }) {
        if (data) {
            this.surveys = data.map(s => ({
                ...s,
                Published_Date__c: s.Published_Date__c
                    ? new Date(s.Published_Date__c).toLocaleDateString()
                    : 'Not Set'
            }));
        } else {
            console.error('Error fetching surveys', error);
        }
    }

    handleTakeSurvey(event) {
        const surveyId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: {
                name: 'Survey_Preview__c'
            },
            state: {
                c__surveyid: surveyId
            }
        });
    }
}
