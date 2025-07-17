public class QuestionDTO {
    @AuraEnabled public String sectionName;
    @AuraEnabled public String questionLabel;
    @AuraEnabled public String questionType;
    @AuraEnabled public Boolean required;
    @AuraEnabled public Boolean allowMultiple;
    @AuraEnabled public Integer sectionOrder;
    @AuraEnabled public Integer questionOrder;
    @AuraEnabled public List<OptionDTO> options;
}
