public with sharing class SurveyController {

    @AuraEnabled
    public static Id saveSurveyAndQuestions(String title, String description, String status, String category, String questionsJSON) {
        try {
            List<QuestionDTO> questions = (List<QuestionDTO>) JSON.deserialize(questionsJSON, List<QuestionDTO>.class);
            if (String.isBlank(title)) {
                throw new AuraHandledException('Survey title is required.');
            }

            if (String.isBlank(category)) {
                throw new AuraHandledException('Survey category is required.');
            }

            Survey__c survey;
            try {
                survey = new Survey__c(
                    Name = title,
                    Survey_Name__c = title,
                    Description__c = description,
                    Status__c = status,
                    Category__c = category
                );
                insert survey;
            } catch (Exception e) {
                throw new AuraHandledException('Failed to insert Survey: ' + e.getMessage());
            }

            List<Survey_Question__c> questionRecords = new List<Survey_Question__c>();
            List<QuestionDTO> validQuestions = new List<QuestionDTO>();

            try {
                for (QuestionDTO q : questions) {
                    if (String.isBlank(q.questionLabel)) {
                        continue;
                    }

                    Survey_Question__c sq = new Survey_Question__c(
                        Label__c = q.questionLabel,
                        Question_Type__c = q.questionType,
                        Required__c = q.required,
                        Order__c = q.questionOrder,
                        Section__c = q.sectionName,
                        Survey__c = survey.Id,
                        Allow_Multiple__c = q.questionType == 'Checkbox' ? q.allowMultiple : false
                    );

                    questionRecords.add(sq);
                    validQuestions.add(q);
                }

                if (!questionRecords.isEmpty()) {
                    insert questionRecords;
                }

            } catch (Exception e) {
                throw new AuraHandledException('Failed to process questions: ' + e.getMessage());
            }

            try {
                List<Survey_Option__c> optionRecords = new List<Survey_Option__c>();

                for (Integer i = 0; i < validQuestions.size(); i++) {
                    QuestionDTO q = validQuestions[i];
                    Survey_Question__c createdQ = questionRecords[i];

                    if (q.options != null && !q.options.isEmpty()) {
                        Integer order = 1;
                        for (OptionDTO opt : q.options) {
                            if (String.isBlank(opt.label)) {
                                continue;
                            }

                            Survey_Option__c so = new Survey_Option__c(
                                Label__c = opt.label,
                                Order__c = order++,
                                Survey_Question__c = createdQ.Id
                            );
                            optionRecords.add(so);
                        }
                    }
                }

                if (!optionRecords.isEmpty()) {
                    insert optionRecords;
                }

            } catch (Exception e) {
                throw new AuraHandledException('Failed to process options: ' + e.getMessage());
            }

            return survey.Id;

        } catch (Exception e) {
            throw new AuraHandledException('Unexpected error: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Id updateSurvey(Id surveyId, String title, String description, String status, String category, String questionsJSON) {
        if (String.isBlank(title)) throw new AuraHandledException('Survey title is required.');
        if (String.isBlank(category)) throw new AuraHandledException('Survey category is required.');

        List<QuestionDTO> questionDTOs = (List<QuestionDTO>) JSON.deserialize(questionsJSON, List<QuestionDTO>.class);

        Survey__c survey = [SELECT Id FROM Survey__c WHERE Id = :surveyId];
        survey.Name = title;
        survey.Survey_Name__c = title;
        survey.Description__c = description;
        survey.Status__c = status;
        survey.Category__c = category;
        update survey;

        Map<Id, Survey_Question__c> existingQuestions = new Map<Id, Survey_Question__c>([
            SELECT Id FROM Survey_Question__c WHERE Survey__c = :surveyId
        ]);

        Map<Id, Survey_Option__c> existingOptions = new Map<Id, Survey_Option__c>();
        if (!existingQuestions.isEmpty()) {
            for (Survey_Option__c opt : [
                SELECT Id, Survey_Question__c FROM Survey_Option__c
                WHERE Survey_Question__c IN :existingQuestions.keySet()
            ]) {
                existingOptions.put(opt.Id, opt);
            }
        }

        List<Survey_Question__c> questionsToInsert = new List<Survey_Question__c>();
        List<Survey_Question__c> questionsToUpdate = new List<Survey_Question__c>();

        for (QuestionDTO q : questionDTOs) {
            if (String.isBlank(q.questionLabel)) continue;

            if (q.Id != null && existingQuestions.containsKey(q.Id)) {
                Survey_Question__c existing = existingQuestions.get(q.Id);
                existing.Label__c = q.questionLabel;
                existing.Question_Type__c = q.questionType;
                existing.Required__c = q.required;
                existing.Order__c = q.questionOrder;
                existing.Section__c = q.sectionName;
                existing.Allow_Multiple__c = q.questionType == 'Checkbox' ? q.allowMultiple : false;
                questionsToUpdate.add(existing);
            } else {
                Survey_Question__c newQ = new Survey_Question__c(
                    Label__c = q.questionLabel,
                    Question_Type__c = q.questionType,
                    Required__c = q.required,
                    Order__c = q.questionOrder,
                    Section__c = q.sectionName,
                    Survey__c = survey.Id,
                    Allow_Multiple__c = q.questionType == 'Checkbox' ? q.allowMultiple : false
                );
                questionsToInsert.add(newQ);
            }
        }

        if (!questionsToInsert.isEmpty()) insert questionsToInsert;
        if (!questionsToUpdate.isEmpty()) update questionsToUpdate;

        List<Survey_Option__c> optionsToInsert = new List<Survey_Option__c>();
        List<Survey_Option__c> optionsToUpdate = new List<Survey_Option__c>();
        Set<Id> retainedOptionIds = new Set<Id>();

        for (QuestionDTO q : questionDTOs) {
            if (q.Id == null) continue;

            if (q.options != null) {
                Integer order = 1;
                for (OptionDTO opt : q.options) {
                    if (String.isBlank(opt.label)) continue;

                    if (opt.Id != null && existingOptions.containsKey(opt.Id)) {
                        Survey_Option__c existing = existingOptions.get(opt.Id);
                        existing.Label__c = opt.label;
                        existing.Order__c = order++;
                        optionsToUpdate.add(existing);
                        retainedOptionIds.add(existing.Id);
                    } else {
                        Survey_Option__c newOpt = new Survey_Option__c(
                            Label__c = opt.label,
                            Order__c = order++,
                            Survey_Question__c = q.Id
                        );
                        optionsToInsert.add(newOpt);
                    }
                }
            }
        }

        if (!optionsToInsert.isEmpty()) insert optionsToInsert;
        if (!optionsToUpdate.isEmpty()) update optionsToUpdate;

        List<Survey_Option__c> optionsToDelete = new List<Survey_Option__c>();
        for (Id optId : existingOptions.keySet()) {
            if (!retainedOptionIds.contains(optId)) {
                optionsToDelete.add(existingOptions.get(optId));
            }
        }
        if (!optionsToDelete.isEmpty()) delete optionsToDelete;

        return survey.Id;
    }

    @AuraEnabled(cacheable=true)
    public static List<Survey__c> getAllSurveys() {
        try {
            List<Survey__c> surveys = [
                SELECT Id, Survey_Name__c, Description__c, Status__c, Category__c, CreatedDate
                FROM Survey__c
                WHERE Status__c IN ('Draft', 'Published')
                ORDER BY LastModifiedDate DESC
            ];
            return surveys;
        } catch (Exception e) {
            throw new AuraHandledException('Unable to load surveys: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getSurveyForPreview(Id surveyId) {
        try {
            Survey__c survey = [
                SELECT Id, Survey_Name__c, Description__c,
                       (SELECT Id, Label__c, Question_Type__c, Required__c, Order__c, Allow_Multiple__c,
                               (SELECT Id, Label__c, Order__c FROM Survey_Options__r ORDER BY Order__c ASC)
                        FROM Survey_Questions__r ORDER BY Order__c ASC)
                FROM Survey__c
                WHERE Id = :surveyId
                LIMIT 1
            ];

            List<Map<String, Object>> questionData = new List<Map<String, Object>>();
            for (Survey_Question__c q : survey.Survey_Questions__r) {
                questionData.add(new Map<String, Object>{
                    'Id' => q.Id,
                    'Label__c' => q.Label__c,
                    'Question_Type__c' => q.Question_Type__c,
                    'Required__c' => q.Required__c,
                    'Order__c' => q.Order__c,
                    'Allow_Multiple__c' => q.Allow_Multiple__c,
                    'Options' => q.Survey_Options__r
                });
            }

            return new Map<String, Object>{
                'survey' => survey,
                'questions' => questionData
            };
        } catch (Exception e) {
            throw new AuraHandledException('Failed to load survey: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteSurvey(Id surveyId) {
        try {
            List<Survey_Question__c> questions = [
                SELECT Id FROM Survey_Question__c
                WHERE Survey__c = :surveyId
            ];

            List<Survey_Option__c> options = [
                SELECT Id FROM Survey_Option__c
                WHERE Survey_Question__c IN :questions
            ];

            delete options;
            delete questions;
            delete [SELECT Id FROM Survey__c WHERE Id = :surveyId];
        } catch (Exception e) {
            throw new AuraHandledException('Failed to delete survey: ' + e.getMessage());
        }
    }
} 
