public with sharing class SurveyUtils {
    @AuraEnabled(cacheable=true)
    public static List<String> getSentimentPicklistValues() {
        List<String> values = new List<String>();
        Schema.DescribeFieldResult fieldResult = Survey_Response__c.Sentiment__c.getDescribe();
        for (Schema.PicklistEntry entry : fieldResult.getPicklistValues()) {
            if (entry.isActive()) values.add(entry.getLabel());
        }
        return values;
    }
}
