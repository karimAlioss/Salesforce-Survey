import { LightningElement, track } from 'lwc';

export default class SurveyHome extends LightningElement {

   @track selectedSurveyId;
   @track showDashboard = true;
   @track showBuilder = false;

   handleCreateNew() {
      this.showDashboard = false;
      this.showBuilder = true;
      this.selectedSurveyId = null;
   }

   handleEditSurvey(event) {
      this.selectedSurveyId = event.detail.surveyId;
      this.showDashboard = false;
      this.showBuilder = true;
   }

   handleBackToDashboard() {
      this.selectedSurveyId = null;
      this.showBuilder = false;
      this.showDashboard = true;
   }
}
