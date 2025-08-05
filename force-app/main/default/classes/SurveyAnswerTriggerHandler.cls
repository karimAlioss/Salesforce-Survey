public class SurveyAnswerTriggerHandler {
    public static void onAfterInsert(List<Survey_Answer__c> newAnswers) {
        // Group answers by Survey_Response__c
        Map<Id, List<String>> responseToAnswersMap = new Map<Id, List<String>>();

        for (Survey_Answer__c answer : newAnswers) {
            if (
                answer.Survey_Response__c != null &&
                String.isNotBlank(answer.Answer__c)
            ) {
                if (!responseToAnswersMap.containsKey(answer.Survey_Response__c)) {
                    responseToAnswersMap.put(answer.Survey_Response__c, new List<String>());
                }
                responseToAnswersMap.get(answer.Survey_Response__c).add(answer.Answer__c);
            }
        }

        List<Survey_Response__c> responsesToUpdate = new List<Survey_Response__c>();

        for (Id responseId : responseToAnswersMap.keySet()) {
            List<String> answers = responseToAnswersMap.get(responseId);
            String summary = String.join(answers, ' | '); // separator
            responsesToUpdate.add(new Survey_Response__c(
                Id = responseId,
                AI_Summary__c = summary
            ));
        }

        if (!responsesToUpdate.isEmpty()) {
            update responsesToUpdate;
        }
    }
}
