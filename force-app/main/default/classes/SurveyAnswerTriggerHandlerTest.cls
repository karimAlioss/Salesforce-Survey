@isTest
public class SurveyAnswerTriggerHandlerTest {
    @isTest
    static void testAnswerAggregationOnInsert() {
        // Step 1 – Create Survey
        Survey__c survey = new Survey__c(
            Survey_Name__c = 'Test Survey',
            Description__c = 'Test Description',
            Status__c = 'Draft',
            Category__c = 'Event'
        );
        insert survey;

        // Step 2 – Create Survey Response
        Survey_Response__c response = new Survey_Response__c(
            Survey__c = survey.Id,
            Status__c = 'Completed'
        );
        insert response;

        // Step 3 – Create Survey Questions
        Survey_Question__c question1 = new Survey_Question__c(
            Survey__c = survey.Id,
            Label__c = 'What do you think?',
            Question_Type__c = 'Text'
        );

        Survey_Question__c question2 = new Survey_Question__c(
            Survey__c = survey.Id,
            Label__c = 'Do you agree?',
            Question_Type__c = 'Radio'
        );

        insert new List<Survey_Question__c>{ question1, question2 };

        // Step 4 – Insert Answers (this should trigger our logic)
        Survey_Answer__c answer1 = new Survey_Answer__c(
            Survey_Response__c = response.Id,
            Survey_Question__c = question1.Id,
            Answer__c = 'I like it',
            Answer_Type__c = 'Text'
        );

        Survey_Answer__c answer2 = new Survey_Answer__c(
            Survey_Response__c = response.Id,
            Survey_Question__c = question2.Id,
            Answer__c = 'Yes',
            Answer_Type__c = 'Radio'
        );

        insert new List<Survey_Answer__c>{ answer1, answer2 };

        // Step 5 – Re-query response and assert
        Survey_Response__c updatedResponse = [
            SELECT Id, AI_Summary__c FROM Survey_Response__c WHERE Id = :response.Id
        ];

        System.assertEquals(
            'I like it | Yes',
            updatedResponse.AI_Summary__c,
            'AI Summary should be populated by trigger'
        );
    }
}
