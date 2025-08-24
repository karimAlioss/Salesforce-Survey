public with sharing class SurveyAnswerController {
    @AuraEnabled
    public static void submitAnswers(Id surveyId, String respondentName, String respondentEmail, String respondentPhone, String sentiment, String answersJSON) {

        if (String.isBlank(answersJSON)) {
            throw new AuraHandledException('No answers provided.');
        }

        List<SurveyAnswerWrapper> answerWrappers;
        try {
            answerWrappers = (List<SurveyAnswerWrapper>) JSON.deserialize(answersJSON, List<SurveyAnswerWrapper>.class);
        } catch (Exception e) {
            throw new AuraHandledException('Invalid answers format.');
        }

        if (answerWrappers.isEmpty()) {
            throw new AuraHandledException('At least one answer must be provided.');
        }

        Survey_Response__c response = new Survey_Response__c();
        response.Survey__c = surveyId;
        response.Respondent_Name__c = respondentName;
        response.Respondent_Email__c = respondentEmail;
        response.Respondent_Phone__c = respondentPhone;
        response.Sentiment__c = sentiment;
        response.Status__c = 'Submitted';
        response.Completion_Date__c = Datetime.now();
        insert response;

        List<Survey_Answer__c> answersToInsert = new List<Survey_Answer__c>();
        List<String> feedbackLines = new List<String>();

        for (SurveyAnswerWrapper wrapper : answerWrappers) {
            if (String.isBlank(wrapper.questionId)) continue;

            Survey_Answer__c answer = new Survey_Answer__c();
            answer.Survey_Response__c = response.Id;
            answer.Survey_Question__c = wrapper.questionId;
            answer.Answer__c = wrapper.answer;
            answer.Answer_Type__c = wrapper.type;

            answersToInsert.add(answer);
            if (wrapper.type != 'Phone' && wrapper.type != 'Email') {
                feedbackLines.add(wrapper.answer);
            }
        }

        if (!answersToInsert.isEmpty()) {
            insert answersToInsert;
        }

        // ✅ Save to Customer Feedback
        response.Customer_Feedback__c = String.join(feedbackLines, '\n');
        update response;
    }

    public class SurveyAnswerWrapper {
        @AuraEnabled public String questionId;
        @AuraEnabled public String answer;
        @AuraEnabled public String type;
    }
}
