public with sharing class SurveyAnswerController {
    @AuraEnabled
    public static void submitAnswers(Id surveyId, String respondentName, String sentiment, String answersJSON) {
        List<AnswerDTO> answers;
        try {
            answers = (List<AnswerDTO>) JSON.deserialize(answersJSON, List<AnswerDTO>.class);
        } catch (Exception e) {
            throw new AuraHandledException('Failed to parse answers: ' + e.getMessage());
        }

        Survey_Response__c response = new Survey_Response__c(
            Survey__c = surveyId,
            Status__c = 'Completed',
            Completion_Date__c = System.now(),
            Respondent_Name__c = respondentName,
            Sentiment__c = sentiment
        );

        try {
            if (Schema.sObjectType.Survey_Response__c.isCreateable()) {
                insert response;
            } else {
                throw new AuraHandledException('You do not have permission to create Survey Response.');
            }
        } catch (Exception e) {
            throw new AuraHandledException('Failed to create Survey Response: ' + e.getMessage());
        }

        List<Survey_Answer__c> answersToInsert = new List<Survey_Answer__c>();
        for (AnswerDTO dto : answers) {
            Survey_Answer__c newAnswer = new Survey_Answer__c(
                Survey_Response__c = response.Id,
                Survey_Question__c = dto.questionId,
                Answer__c = dto.answer,
                Answer_Type__c = dto.type
            );
            answersToInsert.add(newAnswer);
        }

        try {
            if (Schema.sObjectType.Survey_Answer__c.isCreateable()) {
                insert answersToInsert;
            } else {
                throw new AuraHandledException('You do not have permission to create Survey Answers.');
            }
        } catch (Exception e) {
            throw new AuraHandledException('Failed to insert answers: ' + e.getMessage());
        }
    }

    public class AnswerDTO {
        @AuraEnabled public Id questionId;
        @AuraEnabled public String answer;
        @AuraEnabled public String type;
    }
}
