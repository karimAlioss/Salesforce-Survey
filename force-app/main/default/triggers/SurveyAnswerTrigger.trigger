trigger SurveyAnswerTrigger on Survey_Answer__c (after insert) {
    if (Trigger.isAfter && Trigger.isInsert) {
        SurveyAnswerTriggerHandler.onAfterInsert(Trigger.new);
    }
}
