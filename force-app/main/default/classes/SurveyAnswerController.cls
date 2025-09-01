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

    @AuraEnabled(cacheable=true)
    public static List<Survey_Response__c> getSurveyResponses() {
        return [
            SELECT Id,
                Name,
                Respondent_Name__c,
                Respondent_Email__c,
                Respondent_Phone__c,
                Status__c,
                Sentiment__c,
                Completion_Date__c,
                Customer_Feedback__c,
                Survey__c,
                Survey__r.Survey_Name__c,
                Survey__r.Category__c,
                CreatedDate,
                CreatedBy.Name
            FROM Survey_Response__c
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getResponseDetail(Id responseId){
        Survey_Response__c resp = [
            SELECT Id, Name,
                Respondent_Name__c, Respondent_Email__c, Respondent_Phone__c,
                Status__c, Sentiment__c, Completion_Date__c, Customer_Feedback__c,
                Survey__c, Survey__r.Survey_Name__c, Survey__r.Category__c,
                CreatedBy.Name, CreatedDate
            FROM Survey_Response__c
            WHERE Id = :responseId
            LIMIT 1
        ];

        List<Survey_Answer__c> answers = [
            SELECT Id, Answer__c, Answer_Type__c,
                Survey_Question__r.Label__c,
                Survey_Question__r.Section__c,
                Survey_Question__r.Order__c
            FROM Survey_Answer__c
            WHERE Survey_Response__c = :responseId
            ORDER BY Survey_Question__r.Section__c NULLS FIRST, Survey_Question__r.Order__c ASC
        ];

        return new Map<String, Object>{
            'response' => resp,
            'answers'  => answers
        };
    }

    // --- Delete ONE response (and its answers) ---
    @AuraEnabled
    public static void deleteResponse(Id responseId) {
        if (responseId == null) {
            throw new AuraHandledException('No response Id provided.');
        }
        try {
            // Delete child answers first
            List<Survey_Answer__c> answers = [
                SELECT Id
                FROM Survey_Answer__c
                WHERE Survey_Response__c = :responseId
            ];
            if (!answers.isEmpty()) {
                delete answers;
            }

            // Then delete the response
            delete [SELECT Id FROM Survey_Response__c WHERE Id = :responseId LIMIT 1];
        } catch (Exception e) {
            throw new AuraHandledException('Failed to delete survey response: ' + e.getMessage());
        }
    }

    // --- Bulk delete (optional, used by future multi-select) ---
    @AuraEnabled
    public static void deleteResponses(List<Id> responseIds) {
        if (responseIds == null || responseIds.isEmpty()) {
            throw new AuraHandledException('No response Ids provided.');
        }
        try {
            // Delete child answers first
            List<Survey_Answer__c> answers = [
                SELECT Id
                FROM Survey_Answer__c
                WHERE Survey_Response__c IN :responseIds
            ];
            if (!answers.isEmpty()) {
                delete answers;
            }

            // Then delete the responses
            List<Survey_Response__c> responses = [
                SELECT Id
                FROM Survey_Response__c
                WHERE Id IN :responseIds
            ];
            if (!responses.isEmpty()) {
                delete responses;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Failed to delete survey responses: ' + e.getMessage());
        }
    }

}
